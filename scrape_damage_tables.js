const https = require('https');
const fs = require('fs');

const ROSTER_FILE = 'damage_export.json';
const OUT_JSON = 'damage_tables.json';
const OUT_CSV = 'damage_tables.csv';

const roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
const rosterByNum = new Map(roster.characters.map(c => [String(c.num), c]));

function fetchHtml(num) {
  return new Promise((resolve, reject) => {
    https.get(`https://ultrarumble.com/character/${num}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function stripTags(html) {
  return String(html || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTable(tableHtml) {
  const headers = [];
  for (const m of tableHtml.matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/g)) {
    headers.push(stripTags(m[1]));
  }

  const rows = [];
  for (const m of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const rowHtml = m[1];
    const cells = [];
    for (const c of rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)) {
      cells.push(stripTags(c[1]));
    }
    if (!cells.length) continue;
    const headerRow = headers.length && cells.length === headers.length && cells.join('|') === headers.join('|');
    if (!headerRow) rows.push(cells);
  }
  return { headers, rows };
}

function parseStatTable(block) {
  const out = {};
  const statsMatch = block.match(/<b>STATS<\/b>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (!statsMatch) return out;
  for (const row of statsMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [];
    for (const c of row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)) {
      cells.push(stripTags(c[1]));
    }
    if (cells.length >= 2) out[cells[0]] = cells[1];
  }
  return out;
}

function findLastMatch(text, re) {
  let m = null;
  for (const hit of text.matchAll(re)) m = hit;
  return m;
}

function extractTableAfter(block, marker) {
  const idx = block.indexOf(marker);
  if (idx < 0) return null;
  const tableMatch = block.slice(idx).match(/<table class="table text-center">([\s\S]*?)<\/table>/);
  if (!tableMatch) return null;
  const table = parseTable(tableMatch[1]);
  if (!table.headers.length && !table.rows.length) return null;
  return table;
}

function parseSkillBlock(block, kind) {
  const symbols = { alpha: '\u03b1', beta: '\u03b2', gamma: '\u03b3' };
  if (kind === 'special') {
    const h3 = findLastMatch(block, /<h3>([^<]+)<\/h3>/g);
    return {
      type: 'special',
      name: h3 ? stripTags(h3[1]) : '',
      baseTable: null,
      additionalTable: null,
      specialTable: extractTableAfter(block, 'Special Values')
    };
  }

  const sym = symbols[kind];
  const nameRe = new RegExp(`<b>Quirk Skill\\s*${sym}\\s*<\\/b>[\\s\\S]*?<b>([^<]+)<\\/b>`, 'g');
  const nm = findLastMatch(block, nameRe);
  const name = nm ? stripTags(nm[1]) : '';
  const baseTable = extractTableAfter(block, `Base ${sym} Values`);
  const additionalTable = extractTableAfter(block, `Additional ${sym} Damage Values`);
  if (!baseTable && !additionalTable) return null;

  return {
    type: kind,
    name,
    baseTable,
    additionalTable,
    specialTable: null
  };
}

function parseStyleBlocks(html) {
  const parts = html.split(/<b>Special Tuning Skill<\/b>/g);
  const blocks = [];
  for (let i = 1; i < parts.length; i++) {
    blocks.push(parts[i]);
  }
  return blocks;
}

function parseStyleData(block, rosterEntry, styleIndex) {
  const styleMeta = styleIndex === 0
    ? { name: rosterEntry.name, type: rosterEntry.role }
    : (rosterEntry.battleStyles[styleIndex - 1] || { name: `Style ${styleIndex + 1}`, type: rosterEntry.role });

  const stats = parseStatTable(block);
  const skillKinds = ['alpha', 'beta', 'gamma', 'special'];
  const skills = [];
  for (const kind of skillKinds) {
    const skill = parseSkillBlock(block, kind);
    if (skill) skills.push(skill);
  }

  return {
    styleIndex,
    styleName: styleMeta.name,
    styleType: styleMeta.type,
    stats,
    skills
  };
}

function tableRowsToCsvRows(entry, style) {
  const rows = [];
  for (const skill of style.skills) {
    const tables = [];
    if (skill.baseTable) tables.push({ kind: 'base', table: skill.baseTable });
    if (skill.additionalTable) tables.push({ kind: 'additional', table: skill.additionalTable });
    if (skill.specialTable) tables.push({ kind: 'special', table: skill.specialTable });
    for (const item of tables) {
      for (const row of item.table.rows) {
        rows.push({
          characterId: entry.id,
          characterNum: entry.num,
          characterName: entry.name,
          group: entry.group,
          role: entry.role,
          battleStyleName: style.styleName,
          battleStyleType: style.styleType,
          styleIndex: style.styleIndex,
          skillType: skill.type,
          tableKind: item.kind,
          skillName: skill.name,
          headers: JSON.stringify(item.table.headers),
          row: JSON.stringify(row)
        });
      }
    }
  }
  return rows;
}

async function main() {
  const output = {
    generatedAt: new Date().toISOString(),
    source: 'https://ultrarumble.com/characters',
    characterCount: roster.characters.length,
    characters: []
  };

  const csvRows = [];

  for (const entry of roster.characters) {
    const num = String(entry.num);
    try {
      const html = await fetchHtml(num);
      const expectedStyles = 1 + (entry.battleStyles ? entry.battleStyles.length : 0);
      const blocks = parseStyleBlocks(html).slice(0, expectedStyles);
      const styles = blocks.map((block, idx) => parseStyleData(block, entry, idx));

      output.characters.push({
        ...entry,
        damageStyles: styles
      });

      for (const style of styles) {
        csvRows.push(...tableRowsToCsvRows(entry, style));
      }

      console.log(`OK ${entry.id} (${num}): ${styles.length} style blocks`);
    } catch (err) {
      output.characters.push({
        ...entry,
        damageStyles: [],
        scrapeError: String(err && err.message ? err.message : err)
      });
      console.log(`FAIL ${entry.id} (${num}): ${err.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');

  const csvLines = [
    ['characterId','characterNum','characterName','group','role','battleStyleName','battleStyleType','styleIndex','skillType','tableKind','skillName','headers','row'].join(',')
  ];
  for (const row of csvRows) {
    csvLines.push([
      row.characterId,
      row.characterNum,
      row.characterName,
      row.group,
      row.role,
      row.battleStyleName,
      row.battleStyleType,
      row.styleIndex,
      row.skillType,
      row.tableKind,
      row.skillName,
      JSON.stringify(row.headers),
      JSON.stringify(row.row)
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  }
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'), 'utf8');

  console.log(`Saved ${OUT_JSON} and ${OUT_CSV}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
