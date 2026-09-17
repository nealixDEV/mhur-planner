'use strict';

// Safe, source-based MHUR catalog scanner. It builds every result in memory,
// validates the complete scrape, then writes only the managed data files.
const fs = require('fs');
const path = require('path');

const SITE = 'https://ultrarumble.com';
const ROLES = ['Assault', 'Strike', 'Rapid', 'Technical', 'Support'];
const ROLE_LABELS = {
  assault: 'Assault', defense: 'Assault',
  strike: 'Strike', power: 'Strike',
  rapid: 'Rapid', speed: 'Rapid',
  technical: 'Technical', technique: 'Technical',
  support: 'Support'
};
const DELAY_MS = 120;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function decodeHtml(value) {
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, code) => {
    const key = code.toLowerCase();
    if (key === 'amp') return '&';
    if (key === 'lt') return '<';
    if (key === 'gt') return '>';
    if (key === 'quot') return '"';
    if (key === 'apos') return "'";
    if (key === 'nbsp') return ' ';
    const number = key.startsWith('#x') ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    try { return Number.isFinite(number) ? String.fromCodePoint(number) : all; } catch (err) { return all; }
  });
}

function textContent(html) {
  return decodeHtml(String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')).trim();
}

function attributes(source) {
  const result = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = re.exec(source || ''))) result[match[1].toLowerCase()] = decodeHtml(match[2] || match[3] || match[4] || '');
  return result;
}

function safeSlug(value) {
  const slug = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 72);
  return slug || 'character';
}

function normalizeRole(value) {
  const raw = String(value || '').trim();
  return ROLES.includes(raw) ? raw : (ROLE_LABELS[raw.toLowerCase()] || '');
}

function absoluteUrl(url) {
  try { return new URL(decodeHtml(url), SITE + '/').href; } catch (err) { return ''; }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchHtml(url, fetchImpl) {
  const request = fetchImpl || globalThis.fetch;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await request(url, {
        headers: { 'User-Agent': 'MHUR-Planner-Catalog-Scanner/1.0 (+scheduled public data sync)' },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
      const html = await response.text();
      if (html.length < 300 || !/<html\b/i.test(html)) throw new Error('Unexpected page response for ' + url);
      return html;
    } catch (err) {
      lastError = err;
      if (attempt < 3) await sleep(attempt * 500);
    }
  }
  throw lastError || new Error('Could not fetch ' + url);
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await worker(items[index], index);
      if (DELAY_MS) await sleep(DELAY_MS);
    }
  });
  await Promise.all(runners);
  return output;
}

function parseRosterPage(html, currentIds, currentDamage) {
  const idByNumber = {};
  Object.keys(currentIds || {}).forEach(id => { idByNumber[String(currentIds[id])] = id; });
  (currentDamage && currentDamage.characters || []).forEach(item => {
    if (item && item.num !== undefined && item.id) idByNumber[String(item.num)] = item.id;
  });
  const usedIds = new Set(Object.keys(currentIds || {}));
  const cards = [];
  const styleCards = new Map();
  const seenNumbers = new Set();
  const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchors.exec(html))) {
    const attrs = attributes(match[1]);
    const href = attrs.href || '';
    const cardClass = attrs.class || '';
    const route = href.match(/^\/character\/(\d+)(?:#Variant-(\d+))?$/);
    if (!route || !/chara-list/.test(cardClass)) continue;
    const num = Number(route[1]);
    if (!Number.isInteger(num)) continue;
    const body = match[2];
    const img = body.match(/<img\b([^>]*)>/i);
    const imgAttrs = img ? attributes(img[1]) : {};
    const nameMatch = body.match(/<div\b[^>]*class="[^"]*card-footer name[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const name = textContent(nameMatch ? nameMatch[1] : imgAttrs.alt || '');
    const role = normalizeRole(attrs['data-role']);
    const group = String(attrs['data-class'] || '').toUpperCase() === 'VILLAIN' ? 'Villain' : 'Hero';
    assert(name && role, 'Roster card is missing its name or role for character ' + num);
    if (route[2]) {
      const index = Number(route[2]);
      if (!styleCards.has(num)) styleCards.set(num, []);
      styleCards.get(num).push({ index, name, role });
      continue;
    }
    if (seenNumbers.has(num)) continue;
    let id = idByNumber[String(num)];
    if (!id) {
      id = safeSlug(name);
      if (usedIds.has(id)) id = id + '_' + num;
      usedIds.add(id);
      idByNumber[String(num)] = id;
    }
    cards.push({ id, num, officialName: name, group, role, portrait: absoluteUrl(imgAttrs.src || ''), battleStyles: [] });
    seenNumbers.add(num);
  }
  cards.forEach(card => {
    card.battleStyles = (styleCards.get(card.num) || []).sort((a, b) => a.index - b.index);
    assert(new Set(card.battleStyles.map(item => item.index)).size === card.battleStyles.length, card.officialName + ' has duplicate battle-style indexes.');
  });
  assert(cards.length >= 1, 'Could not find character cards on /characters.');
  return cards;
}

function parseLatestReleases(homeHtml, roster) {
  const numMap = new Map(roster.map(item => [String(item.num), item]));
  const releases = [];
  const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchors.exec(homeHtml))) {
    const attrs = attributes(match[1]);
    const href = attrs.href || '';
    const route = href.match(/^\/character\/(\d+)(?:#Variant-(\d+))?$/);
    if (!route) continue;
    const img = match[2].match(/<img\b([^>]*)>/i);
    if (!img) continue;
    const imgAttrs = attributes(img[1]);
    const url = absoluteUrl(imgAttrs.src || '');
    if (!url || !/chara_banners\//i.test(url)) continue;
    const character = numMap.get(route[1]);
    if (!character) continue;
    releases.push({ characterId: character.id, characterNumber: character.num, styleIndex: route[2] ? Number(route[2]) : 0, url });
  }
  return releases;
}

function parseStyleTabs(html, baseRole) {
  const marker = html.indexOf('id="nav-tab"');
  if (marker < 0) return [{ index: 0, name: 'Original', role: baseRole, paneId: 'Variant-Default' }];
  const start = html.lastIndexOf('<div', marker);
  const end = html.indexOf('</div>', marker);
  if (start < 0 || end < 0) return [{ index: 0, name: 'Original', role: baseRole, paneId: 'Variant-Default' }];
  const nav = html.slice(start, end + 6);
  const tabs = [];
  const links = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = links.exec(nav))) {
    const attrs = attributes(match[1]);
    const pane = String(attrs.href || '').match(/^#(Variant-(?:Default|\d+))$/);
    if (!pane) continue;
    const index = pane[1] === 'Variant-Default' ? 0 : Number(pane[1].slice('Variant-'.length));
    const label = textContent(match[2]);
    if (!Number.isInteger(index) || !label) continue;
    tabs.push({ index, name: label, role: '', paneId: pane[1] });
  }
  if (!tabs.length) return [{ index: 0, name: 'Original', role: baseRole, paneId: 'Variant-Default' }];
  tabs.sort((a, b) => a.index - b.index);
  for (const tab of tabs) {
    const paneStart = html.search(new RegExp('<div\\b(?=[^>]*class="[^"]*\\btab-pane\\b)(?=[^>]*id="' + tab.paneId + '")[^>]*>', 'i'));
    if (paneStart >= 0) {
      const nextPane = html.indexOf('<div class="tab-pane', paneStart + 12);
      const pane = html.slice(paneStart, nextPane < 0 ? undefined : nextPane);
      const roleMatch = pane.match(/class="chSelect\s+([A-Za-z]+)"/i);
      tab.role = normalizeRole(roleMatch ? roleMatch[1] : '') || (tab.index === 0 ? baseRole : '');
    }
  }
  if (!tabs.some(tab => tab.index === 0)) tabs.unshift({ index: 0, name: 'Original', role: baseRole, paneId: 'Variant-Default' });
  assert(tabs.every(tab => tab.role), 'A character battle style is missing its role.');
  assert(new Set(tabs.map(tab => tab.index)).size === tabs.length, 'Duplicate battle-style tab indexes found.');
  return tabs;
}

function stripTags(value) { return textContent(value); }

function parseTable(tableHtml) {
  const headers = [];
  // The live site puts other attributes (for example class="text-start")
  // between `th` and `scope`. Keep the match flexible so a harmless markup
  // change does not turn every column list into an empty array.
  for (const match of tableHtml.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/gi)) {
    const scope = match[1].match(/\bscope\s*=\s*["']?([^"'\s>]+)/i);
    if (scope && !/^(col|colgroup)$/i.test(scope[1])) continue;
    if (scope) headers.push(stripTags(match[2]));
  }
  const rows = [];
  for (const rowMatch of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => stripTags(cell[1]));
    if (!cells.length) continue;
    if (headers.length && cells.length === headers.length && cells.join('|') === headers.join('|')) continue;
    rows.push(cells);
  }

  // Some official tables render their headings in <td> cells instead of
  // <th scope="col">. Recognize only known heading labels, move that first
  // row into `headers`, and keep it out of the level data.
  if (!headers.length && rows.length > 0) {
    const knownHeaders = new Set(['level', 'type', 'damage', 'body dmg', 'headshot dmg', 'ammo', 'use ammo', 'reload', 'down power', 'guard break', 'mode']);
    const candidate = rows[0].map(cell => String(cell || '').trim().toLowerCase().replace(/\s+/g, ' '));
    const hasColumnLabel = candidate.some(cell => ['level', 'type', 'damage', 'body dmg', 'ammo', 'reload'].includes(cell));
    if (candidate.length >= 2 && hasColumnLabel && candidate.every(cell => knownHeaders.has(cell))) {
      headers.push(...rows.shift());
    }
  }
  return { headers, rows };
}

function parseStatTable(block) {
  const result = {};
  const match = block.match(/<b>STATS<\/b>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!match) return result;
  for (const row of match[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => stripTags(cell[1]));
    if (cells.length >= 2) result[cells[0]] = cells[1];
  }
  return result;
}

function extractTableAfter(block, marker) {
  const at = block.indexOf(marker);
  if (at < 0) return null;
  const table = block.slice(at).match(/<table class="table text-center">([\s\S]*?)<\/table>/i);
  if (!table) return null;
  const parsed = parseTable(table[1]);
  return parsed.headers.length || parsed.rows.length ? parsed : null;
}

function findLastMatch(text, expression) {
  let last = null;
  for (const match of text.matchAll(expression)) last = match;
  return last;
}

function skillImage(block, from, markerIndex) {
  let end = block.length;
  const nextHeading = /<b>Quirk Skill\s*[αβγ]\s*<\/b>/g;
  nextHeading.lastIndex = markerIndex + 1;
  const match = nextHeading.exec(block);
  if (match) end = match.index;
  const region = block.slice(from < 0 ? markerIndex : from, end);
  const img = region.match(/<img\b([^>]*)>/i);
  if (!img) return '';
  return absoluteUrl(attributes(img[1]).src || '');
}

function parseSkillBlock(block, kind) {
  const symbols = { alpha: 'α', beta: 'β', gamma: 'γ' };
  if (kind === 'special') {
    const actionMarker = /<b>Special Action<\/b>/i.exec(block);
    const actionRegion = actionMarker ? block.slice(actionMarker.index) : block;
    const heading = /<h3>([^<]+)<\/h3>/i.exec(actionRegion);
    const table = extractTableAfter(block, 'Special Values');
    if (!table && !heading) return null;
    const name = heading ? stripTags(heading[1]) : 'Special Action';
    const img = actionRegion.match(/<img\b([^>]*)>/i);
    const image = img ? absoluteUrl(attributes(img[1]).src || '') : '';
    return { type: 'special', name, baseTable: null, additionalTable: null, specialTable: table, image };
  }
  const symbol = symbols[kind];
  const markerRe = new RegExp('<b>Quirk Skill\\s*' + symbol + '\\s*<\\/b>', 'g');
  const marker = findLastMatch(block, markerRe);
  const nameRe = new RegExp('<b>Quirk Skill\\s*' + symbol + '\\s*<\\/b>[\\s\\S]*?<b>([^<]+)<\\/b>', 'g');
  const nameMatch = findLastMatch(block, nameRe);
  const baseTable = extractTableAfter(block, 'Base ' + symbol + ' Values');
  const additionalTable = extractTableAfter(block, 'Additional ' + symbol + ' Damage Values');
  if (!baseTable && !additionalTable) return null;
  const image = marker ? skillImage(block, nameMatch ? nameMatch.index : marker.index, marker.index) : '';
  return { type: kind, name: nameMatch ? stripTags(nameMatch[1]) : '', baseTable, additionalTable, specialTable: null, image };
}

function parseStyleBlocks(html) {
  return html.split(/<b>Special Tuning Skill<\/b>/g).slice(1);
}

function parseStyleData(block, tab, characterName) {
  const skills = ['alpha', 'beta', 'gamma', 'special'].map(kind => parseSkillBlock(block, kind)).filter(Boolean);
  return { styleIndex: tab.index, styleName: tab.index === 0 ? characterName : tab.name, styleType: tab.role, stats: parseStatTable(block), skills };
}

function numberFromTable(skill) {
  if (!skill) return null;
  for (const table of [skill.baseTable, skill.additionalTable, skill.specialTable]) {
    if (!table || !table.headers || !table.rows) continue;
    const damageCol = table.headers.findIndex(header => /damage/i.test(header));
    if (damageCol < 0) continue;
    const row = table.rows.find(item => item.some(cell => /^Lv\.\s*1$/i.test(cell)) && item[damageCol]);
    if (!row) continue;
    const value = Number.parseFloat(String(row[damageCol]).replace(/,/g, ''));
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function hasNonzeroDamageData(skill) {
  if (!skill) return false;
  for (const table of [skill.baseTable, skill.additionalTable, skill.specialTable]) {
    if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) continue;
    const damageCol = table.headers.findIndex(header => /damage|dmg/i.test(header));
    if (damageCol < 0) continue;
    if (table.rows.some(row => {
      const value = row && row[damageCol];
      const number = Number.parseFloat(String(value === undefined ? '' : value).replace(/[^0-9.+-]/g, ''));
      return Number.isFinite(number) && number !== 0;
    })) return true;
  }
  return false;
}

function updateStatRecord(existing, card, baseStyle) {
  const record = Object.assign({}, existing || {});
  const stats = baseStyle.stats || {};
  const hp = Number(stats['Max Main Health']);
  const gp = Number(stats['Max Guard Point']);
  if (Number.isFinite(hp) && hp > 0) record.hp = hp;
  if (Number.isFinite(gp) && gp >= 0) record.gp = gp;
  record.id = card.id;
  record.num = card.num;
  record.udClass = card.role;
  if (!record.size && stats['Body Size']) record.size = stats['Body Size'];
  const skillMap = Object.fromEntries((baseStyle.skills || []).map(skill => [skill.type, numberFromTable(skill)]));
  for (const [field, kind] of [['alpha', 'alpha'], ['beta', 'beta'], ['gamma', 'gamma'], ['sa', 'special']]) {
    if (skillMap[kind] !== null && skillMap[kind] !== undefined) record[field] = skillMap[kind];
  }
  return record;
}

function serializeCsv(rows) {
  const columns = ['characterId','characterNum','characterName','group','role','battleStyleName','battleStyleType','styleIndex','skillType','tableKind','skillName','headers','row'];
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map(key => '"' + String(row[key] === undefined ? '' : row[key]).replace(/"/g, '""') + '"').join(','));
  return lines.join('\n') + '\n';
}

function tableRowsToCsvRows(character, style) {
  const rows = [];
  for (const skill of style.skills || []) {
    for (const [kind, table] of [['base', skill.baseTable], ['additional', skill.additionalTable], ['special', skill.specialTable]]) {
      if (!table) continue;
      for (const row of table.rows || []) rows.push({
        characterId: character.id, characterNum: character.num, characterName: character.name,
        group: character.group, role: character.role, battleStyleName: style.styleName,
        battleStyleType: style.styleType, styleIndex: style.styleIndex, skillType: skill.type,
        tableKind: kind, skillName: skill.name, headers: JSON.stringify(table.headers), row: JSON.stringify(row)
      });
    }
  }
  return rows;
}

function parseTunings(html, kind, priorSpecials) {
  const openTags = /<div class="(normalslots|uniqueslotter)"([^>]*)>/g;
  const blocks = [];
  let match;
  const starts = [];
  while ((match = openTags.exec(html))) starts.push({ kind: match[1] === 'normalslots' ? 'normal' : 'special', start: match.index, end: openTags.lastIndex, attrs: attributes(match[2]) });
  const infoRecords = [];
  for (let i = 0; i < starts.length; i++) {
    const current = starts[i];
    if (current.kind !== kind) continue;
    const end = starts[i + 1] ? starts[i + 1].start : html.length;
    const block = html.slice(current.start, end);
    const infoMatch = block.match(/<div class="slot-character-info">([\s\S]*?)<\/div>/i);
    const info = infoMatch ? infoMatch[1] : '';
    const nameMatch = info.match(/<strong><span[^>]*>([\s\S]*?)<\/span><\/strong>/i);
    const lines = [...info.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map(item => stripTags(item[1]));
    const effectLines = lines.filter(line => /[⏵▶→>]/.test(line));
    const splitEffect = line => {
      const parts = line.split(/\s*[⏵▶→>]\s*/);
      return { skillName: (parts[0] || '').trim(), skillDesc: (parts.slice(1).join(' ') || '').trim() };
    };
    let skillName = '';
    let skillDesc = '';
    let subEffects = [];
    if (kind === 'normal') {
      // Keep the legacy planner's tuning shape: its first arrow line is stored
      // under subEffects, which is what saved recommendations already use.
      const legacyLines = [...info.matchAll(/<span[^>]*>[^<]+<\/span>/g)].map(item => stripTags(item[0]));
      legacyLines.forEach((line, lineIndex) => {
        if (line && !line.includes('⏵')) return;
        const effect = splitEffect(line);
        if (lineIndex === 0) { skillName = effect.skillName; skillDesc = effect.skillDesc; }
        else subEffects.push(effect);
      });
    } else if (effectLines.length) {
      const effect = splitEffect(effectLines[0]);
      skillName = effect.skillName;
      skillDesc = effect.skillDesc;
    }
    const levels = [...block.matchAll(/Level\s+\d+:\s*[0-9.]+/g)].map(item => item[0]);
    const subLevelSections = [...block.matchAll(/<div class="sub-effect-levels">([\s\S]*?)<\/div>/gi)].map(section => [...section[1].matchAll(/Level\s+\d+:\s*[0-9.]+/g)].map(item => item[0]));
    const record = {
      chara: current.attrs['data-slotchara'] || '?',
      role: current.attrs['data-slotrole'] || '?',
      class: current.attrs['data-slotclass'] || '?',
      name: nameMatch ? stripTags(nameMatch[1]) : '',
      skillName,
      skillDesc,
      levels: kind === 'normal' ? levels.slice(0, 4) : levels.slice(0, 11),
      subEffects: kind === 'normal'
        ? subEffects.map((effect, effectIndex) => Object.assign(effect, { levels: subLevelSections[effectIndex] || levels.slice(0, 4) }))
        : [...block.matchAll(/Sub Effect \d+:\s*[0-9.]+/g)].map(item => item[0])
    };
    if (kind === 'special') {
      const key = [record.chara, record.name, record.skillName].join('|').toLowerCase();
      const prior = (priorSpecials || []).find(item => [item.chara, item.name, item.skillName].join('|').toLowerCase() === key);
      record.id = prior && prior.id ? prior.id : record.chara + '_' + safeSlug(record.skillName || record.name);
    }
    infoRecords.push(record);
  }
  return infoRecords;
}

function parseCostumeCards(html, characterIds) {
  const numToId = Object.fromEntries(Object.entries(characterIds || {}).map(([id, num]) => [String(num), id]));
  const records = [];
  const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchors.exec(html))) {
    const href = (attributes(match[1]).href || '').match(/^\/costume\/(\d+)$/);
    if (!href) continue;
    const id = href[1];
    const card = match[2];
    const data = card.match(/<div\b([^>]*)class="[^"]*chara-listing[^"]*"([^>]*)>/i);
    const cardAttrs = data ? Object.assign(attributes(data[1]), attributes(data[2])) : {};
    const characterNumber = String(cardAttrs['data-chara'] || '');
    const nameMatch = card.match(/<div\b[^>]*class="name"[^>]*title="([^"]+)"[^>]*>/i);
    const imageMatch = card.match(/<img\b[^>]*class="costumeImage"[^>]*>/i);
    const imageAttrs = imageMatch ? attributes(imageMatch[0]) : {};
    const rarityMatch = card.match(/rarity_(r_1star|sr_2star|pur_3star)/i);
    const alignmentMatch = card.match(/CostumeUnique2mark\s+(HERO|VILLAIN)/i);
    const name = textContent(nameMatch ? nameMatch[1] : '');
    const characterId = numToId[characterNumber];
    if (!name || !characterNumber || !characterId) continue;
    const rarityKey = rarityMatch ? rarityMatch[1].toLowerCase() : 'r_1star';
    records.push({
      id, characterId, characterNumber: Number(characterNumber), name,
      rarity: rarityKey.includes('3star') ? 'PUR' : rarityKey.includes('2star') ? 'SR' : 'R',
      alignment: alignmentMatch && alignmentMatch[1].toUpperCase() === 'VILLAIN' ? 'villain' : 'hero',
      thumbnailUrl: absoluteUrl(imageAttrs.src || '')
    });
  }
  return records;
}

function roleFromColor(color) {
  const hex = String(color || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  if (['00ff01','02db18','00ff00','00c800','00d000'].includes(hex)) return 'Support';
  if (['00cbe6','00c8ff','0084ff','00a0ff','0080ff','0064ff'].includes(hex)) return 'Rapid';
  if (['ffff00','ffd700','f5c800','ffdd00','ffc800'].includes(hex)) return 'Assault';
  if (['c913c9','8400ff','9400d3','c900c9','8000ff','a000ff'].includes(hex)) return 'Technical';
  if (['fc0102','ff0000','ff0001','fe0101'].includes(hex)) return 'Strike';
  return '';
}

function parseCostumeSlots(html) {
  const slots = Array(10).fill(null);
  const specials = {};
  const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchors.exec(html))) {
    const attrs = attributes(match[1]);
    const idMatch = String(attrs.id || '').match(/^((?:special)?slot)(\d+)-tab$/i);
    if (!idMatch) continue;
    const label = textContent(match[2]);
    const color = String(attrs.style || '').match(/background-color\s*:\s*(#[0-9a-f]{3,8})/i);
    const labelRole = label.match(/\b(Assault|Strike|Rapid|Technical|Support)\b/i);
    const role = roleFromColor(color ? color[1] : '') || normalizeRole(labelRole ? labelRole[1] : '');
    assert(role, 'Unknown role on costume slot ' + attrs.id);
    const alignMatch = label.match(/\(([VH])\)/i);
    const align = alignMatch ? (alignMatch[1].toUpperCase() === 'V' ? 'villain' : 'hero') : null;
    const record = { r: role };
    if (align) record.a = align;
    const num = Number(idMatch[2]);
    if (/^specialslot/i.test(idMatch[1])) specials[num] = record;
    else if (num >= 1 && num <= 10) slots[num - 1] = record;
  }
  assert(slots.every(Boolean), 'Costume detail page did not expose all 10 memory slots.');
  assert(specials[1] && specials[2], 'Costume detail page did not expose both special slots.');
  return { s: slots, sp1: specials[1], sp2: specials[2] };
}

function costumeSignature(item) {
  return [String(item.name || '').trim().toLowerCase(), String(item.rarity || 'R').toUpperCase()].join('|');
}

function parsePatchSnapshot(html, url, linkText) {
  const titleMatch = html.match(/<meta\b[^>]*property="og:title"[^>]*content="([^"]+)"/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
  const publishedMatch = html.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}(?:\s+at\s+[^<]+)?/i);
  const blocks = [];
  const blockRe = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockRe.exec(html))) {
    const value = textContent(match[2]);
    if (value && value.length <= 2400 && !blocks.includes(value)) blocks.push(value);
  }
  assert(blocks.length >= 3, 'Latest patch page did not contain enough readable notes.');
  const title = textContent(titleMatch ? titleMatch[1] : linkText || 'Latest patch notes');
  return { url, title, publishedAt: publishedMatch ? publishedMatch[0] : '', sections: blocks };
}

function mergeStyleBanners(imageManifest, releases, tabsByNumber) {
  const byId = new Map((imageManifest.characters || []).map(item => [item.id, item]));
  for (const release of releases) {
    let image = byId.get(release.characterId);
    if (!image) {
      image = { id: release.characterId, name: '', characterNumber: release.characterNumber, rosterPng: '', fourKPng: '', banner: '', styleBanners: [] };
      imageManifest.characters.push(image);
      byId.set(release.characterId, image);
    }
    if (!release.styleIndex) {
      image.banner = release.url;
      continue;
    }
    const tab = (tabsByNumber[release.characterNumber] || []).find(item => item.index === release.styleIndex);
    if (!tab) continue;
    const banners = Array.isArray(image.styleBanners) ? image.styleBanners : (image.styleBanners = []);
    const existing = banners.find(item => Number(item.styleIndex) === release.styleIndex);
    const record = { styleIndex: release.styleIndex, styleName: tab.name, url: release.url };
    if (existing) Object.assign(existing, record);
    else banners.push(record);
  }
}

function readJson(root, relative, fallback) {
  const file = path.join(root, relative);
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (err) { return fallback; }
}

function addWrite(writes, root, relative, data) {
  writes.set(relative, { path: path.join(root, relative), text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n' });
}

function existingJsonText(root, relative) {
  try { return fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''); } catch (err) { return ''; }
}

function stableJsonValue(value) { return JSON.stringify(value); }

function setGeneratedAtOnlyWhenChanged(previous, next) {
  if (!previous || !previous.generatedAt) return next;
  const a = Object.assign({}, previous); const b = Object.assign({}, next);
  delete a.generatedAt; delete b.generatedAt;
  if (stableJsonValue(a) === stableJsonValue(b)) next.generatedAt = previous.generatedAt;
  return next;
}

async function scanAndApply(options) {
  options = options || {};
  const root = path.resolve(options.root || path.join(__dirname, '..'));
  const fetchImpl = options.fetch;
  const currentIndex = readJson(root, 'database/character_index.json', {});
  const currentIds = readJson(root, 'database/character_ids.json', {});
  const currentStats = readJson(root, 'database/characters.json', {});
  const currentDamage = readJson(root, 'damage_export.json', { characters: [] });
  const previousDamageTables = readJson(root, 'damage_tables.json', { characters: [] });
  const currentCostumes = readJson(root, 'database/costumes.json', {});
  const currentRawSlots = readJson(root, 'costume_slots_raw.json', {});
  const currentNormals = readJson(root, 'normal_tuning_parsed.json', []);
  const currentSpecials = readJson(root, 'special_tuning_parsed.json', []);
  const imageManifest = readJson(root, 'character_image_manifest.json', { characters: [] });
  const scrapeManifest = readJson(root, 'database/scrape_manifest.json', {});
  assert(fs.existsSync(path.join(root, 'database')), 'The target root does not have a database/ folder.');

  const [home, rosterHtml, costumeHtml, tuningHtml] = await Promise.all([
    fetchHtml(SITE + '/', fetchImpl), fetchHtml(SITE + '/characters', fetchImpl),
    fetchHtml(SITE + '/costumes', fetchImpl), fetchHtml(SITE + '/tuning', fetchImpl)
  ]);
  const cards = parseRosterPage(rosterHtml, currentIds, currentDamage);
  const releases = parseLatestReleases(home, cards);
  const sourceCostumes = parseCostumeCards(costumeHtml, Object.assign({}, currentIds, Object.fromEntries(cards.map(item => [item.id, item.num]))));
  assert(cards.length >= Object.keys(currentIndex).length - 1, 'The live roster is unexpectedly smaller than the local roster.');
  assert(sourceCostumes.length >= 1000, 'The costume page returned too few records; refusing to publish a partial catalog.');
  assert(releases.length >= 1, 'Could not find any character/style banners in the home page Latest Releases section.');

  const currentDamageByNum = new Map((currentDamage.characters || []).map(item => [String(item.num), item]));
  const currentTableByNum = new Map((previousDamageTables.characters || []).map(item => [String(item.num), item]));
  const cardData = await mapLimit(cards, 4, async card => {
    const page = await fetchHtml(SITE + '/character/' + card.num, fetchImpl);
    const tabs = [{ index: 0, name: 'Original', role: card.role, paneId: 'Variant-Default' }].concat(
      card.battleStyles.map(style => ({ index: style.index, name: style.name, role: style.role, paneId: 'Variant-' + style.index }))
    );
    const oldExport = currentDamageByNum.get(String(card.num)) || {};
    const oldCatalog = currentTableByNum.get(String(card.num)) || {};
    const displayName = (currentIndex[card.id] && (currentIndex[card.id].n || currentIndex[card.id].name)) || oldExport.name || card.officialName;
    const blocks = parseStyleBlocks(page);
    assert(blocks.length >= tabs.length, card.officialName + ': battle-style tabs (' + tabs.length + ') exceed available data sections (' + blocks.length + ').');
    // Some character pages also list costume variants as data blocks. Only
    // /characters cards marked with a battle-style link belong in the planner.
    const styles = blocks.slice(0, tabs.length).map((block, index) => parseStyleData(block, tabs[index], displayName));
    assert(styles.length >= 1 && styles[0].stats['Max Main Health'], card.officialName + ': base stats were not found.');
    for (let i = 0; i < styles.length; i++) {
      assert(styles[i].skills.length >= 3, card.officialName + ' / ' + styles[i].styleName + ': too few skills were parsed.');
      for (const skill of styles[i].skills) {
        assert(skill.name, card.officialName + ' / ' + styles[i].styleName + ': unnamed skill data found.');
        const tables = [skill.baseTable, skill.additionalTable, skill.specialTable].filter(Boolean);
        for (const table of tables) {
          assert(Array.isArray(table.headers) && table.headers.length > 0,
            card.officialName + ' / ' + styles[i].styleName + ' / ' + skill.name + ': table column names were not parsed.');
          assert(Array.isArray(table.rows) && table.rows.length > 0,
            card.officialName + ' / ' + styles[i].styleName + ' / ' + skill.name + ': table has no value rows.');
          const normalizedHeaders = table.headers.map(value => String(value || '').trim().toLowerCase());
          assert(!table.rows.some(row => Array.isArray(row) && row.length === normalizedHeaders.length &&
            row.every((value, index) => String(value || '').trim().toLowerCase() === normalizedHeaders[index])),
          card.officialName + ' / ' + styles[i].styleName + ' / ' + skill.name + ': table heading leaked into its value rows.');
        }
      }
      assert(styles[i].skills.some(hasNonzeroDamageData),
        card.officialName + ' / ' + styles[i].styleName + ': no skill has usable damage values.');
    }
    const battleStyles = tabs.filter(tab => tab.index > 0).map(tab => ({ name: tab.name, type: tab.role }));
    const charEntry = Object.assign({}, oldExport, { id: card.id, num: card.num, name: displayName, group: card.group, role: card.role, battleStyles });
    const damageRecord = Object.assign({}, oldCatalog, { id: card.id, num: card.num, name: displayName, group: card.group, role: card.role, battleStyles, damageStyles: styles });
    const stats = updateStatRecord(currentStats[card.id], card, styles[0]);
    charEntry.stats = Object.assign({}, oldExport.stats || {}, {
      hp: stats.hp, gp: stats.gp,
      alpha: stats.alpha === undefined ? null : stats.alpha,
      beta: stats.beta === undefined ? null : stats.beta,
      gamma: stats.gamma === undefined ? null : stats.gamma,
      sa: stats.sa === undefined ? null : stats.sa
    });
    return { card, tabs, styles, charEntry, damageRecord, stats, displayName, page };
  });

  const normal = parseTunings(tuningHtml, 'normal');
  const special = parseTunings(tuningHtml, 'special', currentSpecials);
  const expectedNormal = (tuningHtml.match(/<div class="normalslots"/g) || []).length;
  const expectedSpecial = (tuningHtml.match(/<div class="uniqueslotter"/g) || []).length;
  assert(normal.length >= 50 && normal.length === expectedNormal, 'Normal tuning scrape is incomplete: ' + normal.length + '/' + expectedNormal + '.');
  assert(special.length >= 50 && special.length === expectedSpecial, 'Special tuning scrape is incomplete: ' + special.length + '/' + expectedSpecial + '.');
  assert(normal.every(item => item.name && item.role && item.levels.length), 'Normal tuning data has missing names, roles, or values.');
  assert(special.every(item => item.name && item.skillName && item.role && item.levels.length), 'Special tuning data has missing names, roles, or values.');

  const newCostumes = [];
  const slotsById = Object.assign({}, currentRawSlots);
  const updatedCostumes = Object.assign({}, currentCostumes);
  const sourceByCharacter = new Map();
  for (const costume of sourceCostumes) {
    if (!sourceByCharacter.has(costume.characterId)) sourceByCharacter.set(costume.characterId, []);
    sourceByCharacter.get(costume.characterId).push(costume);
  }
  for (const [characterId, sourceItems] of sourceByCharacter) {
    const localItems = Array.isArray(updatedCostumes[characterId]) ? updatedCostumes[characterId].slice() : [];
    const counts = new Map();
    for (const item of localItems) {
      const signature = costumeSignature(item);
      counts.set(signature, (counts.get(signature) || 0) + 1);
    }
    const missing = [];
    for (const item of sourceItems) {
      const signature = costumeSignature(item);
      const count = counts.get(signature) || 0;
      if (count > 0) counts.set(signature, count - 1);
      else missing.push(item);
    }
    for (const item of missing) {
      let layout = slotsById[item.id];
      if (!layout || !Array.isArray(layout.s) || layout.s.length !== 10 || !layout.sp1 || !layout.sp2) {
        const html = await fetchHtml(SITE + '/costume/' + item.id, fetchImpl);
        layout = parseCostumeSlots(html);
      }
      assert(Array.isArray(layout.s) && layout.s.length === 10 && layout.sp1 && layout.sp2, 'Costume ' + item.id + ' has incomplete slot data.');
      slotsById[item.id] = layout;
      const entry = {
        idx: localItems.reduce((max, current, index) => Math.max(max, Number.isFinite(Number(current && current.idx)) ? Number(current.idx) : index), -1) + 1,
        name: item.name, rarity: item.rarity, align: item.alignment,
        slots: layout.s, sp1: layout.sp1, sp2: layout.sp2, sourceId: item.id,
        assets: item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}
      };
      localItems.push(entry);
      newCostumes.push({ id: item.id, characterId, name: item.name });
    }
    updatedCostumes[characterId] = localItems;
  }

  // Keep IDs stable when a source name changes only its punctuation or spacing.
  const seenSpecialIds = new Set();
  for (const item of special) {
    if (!item.id || seenSpecialIds.has(item.id)) item.id = item.chara + '_' + safeSlug(item.skillName || item.name) + '_' + safeSlug(item.name);
    seenSpecialIds.add(item.id);
  }

  const updatedIndex = Object.assign({}, currentIndex);
  const updatedIds = Object.assign({}, currentIds);
  const updatedStats = Object.assign({}, currentStats);
  const updatedDamageExport = Object.assign({}, currentDamage, { characters: [] });
  const updatedDamageTables = Object.assign({}, previousDamageTables, { characters: [] });
  const updatedImages = Object.assign({}, imageManifest, { characters: Array.isArray(imageManifest.characters) ? imageManifest.characters.slice() : [] });
  const tabsByNumber = {};
  const imageById = new Map(updatedImages.characters.map(item => [item.id, item]));
  const csvRows = [];
  let styleCount = 0;
  let skillCount = 0;
  let skillImageCount = 0;
  for (const result of cardData) {
    const { card, tabs, styles, charEntry, damageRecord, stats, displayName } = result;
    tabsByNumber[card.num] = tabs;
    styleCount += styles.length;
    for (const style of styles) {
      skillCount += style.skills.length;
      skillImageCount += style.skills.filter(skill => skill.image).length;
      csvRows.push(...tableRowsToCsvRows(charEntry, style));
    }
    updatedIndex[card.id] = Object.assign({}, updatedIndex[card.id] || {}, { id: card.id, g: card.group, role: card.role, n: displayName, characterNumber: card.num });
    updatedIds[card.id] = card.num;
    updatedStats[card.id] = stats;
    updatedDamageExport.characters.push(charEntry);
    updatedDamageTables.characters.push(damageRecord);
    let image = imageById.get(card.id);
    if (!image) {
      image = { id: card.id, name: displayName, characterNumber: card.num, rosterPng: '', fourKPng: '', banner: '', styleBanners: [] };
      updatedImages.characters.push(image);
      imageById.set(card.id, image);
    }
    image.name = displayName;
    image.characterNumber = card.num;
    if (card.portrait) image.rosterPng = card.portrait;
    const ogImage = result.page.match(/<meta\b[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImage) image.fourKPng = absoluteUrl(ogImage[1]);
  }
  updatedDamageExport.generatedAt = new Date().toISOString();
  updatedDamageTables.generatedAt = new Date().toISOString();
  setGeneratedAtOnlyWhenChanged(currentDamage, updatedDamageExport);
  setGeneratedAtOnlyWhenChanged(previousDamageTables, updatedDamageTables);
  updatedImages.characters.sort((a, b) => Number(a.characterNumber || 0) - Number(b.characterNumber || 0));
  mergeStyleBanners(updatedImages, releases, tabsByNumber);

  const patchLink = home.match(/<a\b([^>]*)href="(\/patch\/[^\"]+)"([^>]*)>([\s\S]*?)<\/a>/i);
  const patchSnapshot = patchLink
    ? parsePatchSnapshot(await fetchHtml(SITE + patchLink[2], fetchImpl), SITE + patchLink[2], textContent(patchLink[4]))
    : null;
  const previousPatch = readJson(root, 'database/official_patch_snapshot.json', null);
  const patchChanged = patchSnapshot && stableJsonValue(patchSnapshot) !== stableJsonValue(previousPatch);

  const tsuyu = updatedDamageTables.characters.find(item => item.id === 'tsuyu');
  if (tsuyu && (tsuyu.battleStyles || []).some(style => /Froppy Hopper/i.test(style.name))) {
    const hopper = (tsuyu.damageStyles || []).find(style => /Froppy Hopper/i.test(style.styleName));
    assert(hopper && hopper.skills.some(skill => /beta/i.test(skill.type)), 'Froppy Hopper is listed but its skill tables are incomplete.');
  }
  for (const item of updatedDamageTables.characters) {
    assert(item.damageStyles.length >= 1, item.name + ' has no damage/style data.');
    for (const style of item.damageStyles) assert(style.skills.length >= 3, item.name + ' / ' + style.styleName + ' is missing skill data.');
  }
  const uniqueSpecialIds = new Set(special.map(item => item.id));
  assert(uniqueSpecialIds.size === special.length, 'Special tuning IDs are not unique.');

  const writes = new Map();
  addWrite(writes, root, 'database/character_index.json', updatedIndex);
  addWrite(writes, root, 'database/character_ids.json', updatedIds);
  addWrite(writes, root, 'database/characters.json', updatedStats);
  addWrite(writes, root, 'database/costumes.json', updatedCostumes);
  addWrite(writes, root, 'database/scrape_manifest.json', scrapeManifest);
  addWrite(writes, root, 'damage_export.json', updatedDamageExport);
  addWrite(writes, root, 'damage_tables.json', updatedDamageTables);
  addWrite(writes, root, 'damage_tables.csv', serializeCsv(csvRows));
  addWrite(writes, root, 'costume_slots_raw.json', slotsById);
  addWrite(writes, root, 'normal_tuning_parsed.json', normal);
  addWrite(writes, root, 'special_tuning_parsed.json', special);
  addWrite(writes, root, 'character_image_manifest.json', updatedImages);
  if (patchSnapshot) addWrite(writes, root, 'database/official_patch_snapshot.json', patchSnapshot);

  const changedPaths = [];
  for (const [relative, write] of writes) {
    const previous = existingJsonText(root, relative);
    if (previous !== write.text) changedPaths.push(relative);
  }
  const dataChanged = changedPaths.some(file => file !== 'database/scrape_manifest.json');
  if (dataChanged || patchChanged) {
    const nextManifest = Object.assign({}, scrapeManifest);
    nextManifest.updatedAt = new Date().toISOString();
    nextManifest.source = SITE + '/costumes';
    nextManifest.sourceCount = sourceCostumes.length;
    nextManifest.damageTables = { generatedAt: updatedDamageTables.generatedAt, source: SITE + '/characters', characters: cardData.length, styleBlocks: styleCount, skillImages: skillImageCount, skills: skillCount, failedCharacters: [] };
    nextManifest.tunings = { source: SITE + '/tuning', normal: normal.length, special: special.length };
    nextManifest.latestReleases = releases;
    nextManifest.cloudScanner = { source: SITE, costumeRecords: sourceCostumes.length, newCostumes: newCostumes.length, characters: cardData.length, battleStyles: styleCount, normalTunings: normal.length, specialTunings: special.length, skillImages: skillImageCount, patchUrl: patchSnapshot ? patchSnapshot.url : '' };
    addWrite(writes, root, 'database/scrape_manifest.json', nextManifest);
  }

  const finalChangedPaths = [];
  for (const [relative, write] of writes) {
    const previous = existingJsonText(root, relative);
    if (previous !== write.text) finalChangedPaths.push(relative);
  }
  if (!options.dryRun && finalChangedPaths.length) {
    const originals = new Map();
    const completed = [];
    try {
      for (const relative of finalChangedPaths) {
        const write = writes.get(relative);
        fs.mkdirSync(path.dirname(write.path), { recursive: true });
        originals.set(relative, fs.existsSync(write.path) ? fs.readFileSync(write.path) : null);
        const temp = write.path + '.cloud-scan-tmp';
        fs.writeFileSync(temp, write.text, 'utf8');
        fs.renameSync(temp, write.path);
        completed.push(relative);
      }
    } catch (err) {
      for (const relative of completed.reverse()) {
        const write = writes.get(relative);
        const old = originals.get(relative);
        if (old === null) { try { fs.unlinkSync(write.path); } catch (ignore) {} }
        else { try { fs.writeFileSync(write.path, old); } catch (ignore) {} }
      }
      throw err;
    }
  }

  return {
    ok: true,
    applied: !options.dryRun,
    changed: finalChangedPaths,
    summary: {
      characters: cardData.length, battleStyles: styleCount, normalTunings: normal.length,
      specialTunings: special.length, costumesOnSource: sourceCostumes.length,
      costumesAdded: newCostumes, skillImages: skillImageCount, skills: skillCount,
      latestReleases: releases, patch: patchSnapshot && { title: patchSnapshot.title, url: patchSnapshot.url }
    }
  };
}

async function cli() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || !args.includes('--apply');
  const rootIndex = args.indexOf('--root');
  const root = rootIndex >= 0 ? args[rootIndex + 1] : undefined;
  const result = await scanAndApply({ root, dryRun });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) cli().catch(err => { console.error('Cloud catalog scan failed:', err && err.stack || err); process.exitCode = 1; });

module.exports = { scanAndApply, parseRosterPage, parseLatestReleases, parseStyleTabs, parseStyleData, parseTable, parseTunings, parseCostumeCards, parseCostumeSlots, parsePatchSnapshot, textContent, roleFromColor, hasNonzeroDamageData };
