'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const scanner = require('../scripts/cloud_scanner');

const REPO = path.resolve(__dirname, '..');

function readJson(root, file) { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '')); }
function writeJson(root, file, value) { fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function runInFixture(root, source) {
  const result = spawnSync(process.execPath, ['-e', source], { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 24 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('Catalog fixture process failed: ' + (result.stderr || result.stdout).slice(-3000));
  return result.stdout.trim();
}

async function getPage(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'MHUR-Planner-Scanner-Test/1.0' }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, 'Could not fetch test source ' + url);
  return response.text();
}

function copyFixture(source, target) {
  fs.mkdirSync(path.join(target, 'database'), { recursive: true });
  fs.cpSync(path.join(source, 'database'), path.join(target, 'database'), { recursive: true });
  const files = [
    'damage_export.json', 'damage_tables.json', 'damage_tables.csv', 'costume_slots_raw.json',
    'normal_tuning_parsed.json', 'special_tuning_parsed.json', 'character_image_manifest.json'
  ];
  if (fs.existsSync(path.join(source, 'content_store.js'))) files.push('content_store.js');
  for (const file of files) fs.copyFileSync(path.join(source, file), path.join(target, file));
}

function deleteFrom(array, predicate, label, required = false) {
  const index = array.findIndex(predicate);
  if (index === -1) {
    assert(!required, 'Test backup could not find ' + label);
    return null;
  }
  return array.splice(index, 1)[0];
}

async function main() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mhur-froppy-scan-'));
  const cleanupBase = path.resolve(os.tmpdir());
  try {
    copyFixture(REPO, tmpRoot);
    const currentIds = readJson(tmpRoot, 'database/character_ids.json');
    const currentDamage = readJson(tmpRoot, 'damage_export.json');
    const rosterHtml = await getPage('https://ultrarumble.com/characters');
    const costumesHtml = await getPage('https://ultrarumble.com/costumes');
    const roster = scanner.parseRosterPage(rosterHtml, currentIds, currentDamage);
    const idsWithNew = Object.assign({}, currentIds, Object.fromEntries(roster.map(item => [item.id, item.num])));
    const sourceCostumes = scanner.parseCostumeCards(costumesHtml, idsWithNew);
    const latestTsuyu = sourceCostumes.filter(item => item.characterId === 'tsuyu').slice(-1)[0];
    assert(latestTsuyu, 'The official costume list has no Tsuyu Asui entry.');

    const damageTables = readJson(tmpRoot, 'damage_tables.json');
    const tsuyuDamage = damageTables.characters.find(item => item.id === 'tsuyu');
    assert(tsuyuDamage, 'The fixture has no Tsuyu damage record.');
    const removedStyle = deleteFrom(tsuyuDamage.battleStyles, item => /Froppy Hopper/i.test(item.name), 'Strike Froppy battle style');
    const removedStyleData = deleteFrom(tsuyuDamage.damageStyles, item => /Froppy Hopper/i.test(item.styleName), 'Froppy Hopper skill/damage data');
    if (removedStyle) assert.equal(removedStyle.type, 'Strike', 'The backup was not the Strike Froppy style.');

    const damageExport = readJson(tmpRoot, 'damage_export.json');
    const tsuyuExport = damageExport.characters.find(item => item.id === 'tsuyu');
    deleteFrom(tsuyuExport.battleStyles, item => /Froppy Hopper/i.test(item.name), 'backup roster entry for Strike Froppy');

    const images = readJson(tmpRoot, 'character_image_manifest.json');
    const tsuyuImage = images.characters.find(item => item.id === 'tsuyu');
    const bannerIndex = tsuyuImage.styleBanners.findIndex(item => /Froppy Hopper/i.test(item.styleName));
    const removedBanner = bannerIndex >= 0 ? tsuyuImage.styleBanners.splice(bannerIndex, 1)[0] : null;

    const normals = readJson(tmpRoot, 'normal_tuning_parsed.json');
    const removedNormal = normals.filter(item => item.chara === '6' && item.role === 'Strike');
    writeJson(tmpRoot, 'normal_tuning_parsed.json', normals.filter(item => !(item.chara === '6' && item.role === 'Strike')));

    const specials = readJson(tmpRoot, 'special_tuning_parsed.json');
    const removedSpecial = specials.filter(item => item.chara === '6' && item.role === 'Strike');
    writeJson(tmpRoot, 'special_tuning_parsed.json', specials.filter(item => !(item.chara === '6' && item.role === 'Strike')));

    const costumeList = readJson(tmpRoot, 'database/costumes.json');
    const latestList = Array.isArray(costumeList.tsuyu) ? costumeList.tsuyu : (costumeList.tsuyu = []);
    const removedCostume = deleteFrom(latestList,
      item => item.name === latestTsuyu.name && String(item.rarity || 'R').toUpperCase() === latestTsuyu.rarity,
      'latest Tsuyu costume ' + latestTsuyu.name);
    const sourceSlots = readJson(tmpRoot, 'costume_slots_raw.json');
    const removedRawSlots = sourceSlots[latestTsuyu.id];
    delete sourceSlots[latestTsuyu.id];

    const backupDir = path.join(tmpRoot, 'backup');
    fs.mkdirSync(backupDir, { recursive: true });
    writeJson(tmpRoot, 'backup/removed_source_records.json', {
      battleStyle: removedStyle,
      battleStyleDamageAndSkills: removedStyleData,
      styleBanner: removedBanner,
      normalTunings: removedNormal,
      specialTunings: removedSpecial,
      latestCostume: removedCostume,
      latestCostumeSlots: removedRawSlots,
      officialCostumeSource: latestTsuyu
    });
    writeJson(tmpRoot, 'damage_tables.json', damageTables);
    writeJson(tmpRoot, 'damage_export.json', damageExport);
    writeJson(tmpRoot, 'character_image_manifest.json', images);
    writeJson(tmpRoot, 'database/costumes.json', costumeList);
    writeJson(tmpRoot, 'costume_slots_raw.json', sourceSlots);

    // If this checkout has the optional server catalog layer, verify that it
    // refreshes when the scanner changes source files. The cloud workflow also
    // runs on the clean public branch where this local-only layer may be absent.
    const hasContentStore = fs.existsSync(path.join(tmpRoot, 'content_store.js'));
    let longLivedStore = null;
    if (hasContentStore) {
      runInFixture(tmpRoot, "const store=require('./content_store'); store.publicCatalog(); console.log('old catalog ready');");
      longLivedStore = require(path.join(tmpRoot, 'content_store.js'));
      const beforeScanCatalog = longLivedStore.publicCatalog();
      const beforeScanTsuyu = beforeScanCatalog.damageTables.characters.find(item => item.id === 'tsuyu');
      assert(!beforeScanTsuyu.damageStyles.some(item => /Froppy Hopper/i.test(item.styleName)), 'The fixture unexpectedly still has the removed Froppy Hopper data.');
    }

    const scan = await scanner.scanAndApply({ root: tmpRoot });
    assert(scan.ok && scan.applied, 'The live source scan did not apply to the disposable test copy.');
    assert(scan.summary.characters >= 39 && scan.summary.battleStyles >= 62, 'The scan returned an incomplete roster/style set.');
    assert(scan.summary.skills >= 240, 'The scan returned too few character/style skills.');
    assert.equal(scan.summary.normalTunings, scan.summary.specialTunings, 'Normal and special tuning totals should both be complete.');
    assert(scan.changed.includes('damage_tables.json'), 'The missing battle-style data was not restored.');
    assert(scan.changed.includes('normal_tuning_parsed.json') && scan.changed.includes('special_tuning_parsed.json'), 'The tuning files were not rebuilt.');
    assert(scan.changed.includes('database/costumes.json') && scan.changed.includes('costume_slots_raw.json'), 'The missing outfit and slot map were not restored.');

    const restoredDamage = readJson(tmpRoot, 'damage_tables.json').characters.find(item => item.id === 'tsuyu');
    const hopper = restoredDamage.battleStyles.find(item => /Froppy Hopper/i.test(item.name));
    assert(hopper && hopper.type === 'Strike', 'Strike Froppy was not restored with the correct role.');
    const hopperData = restoredDamage.damageStyles.find(item => /Froppy Hopper/i.test(item.styleName));
    assert(hopperData, 'Froppy Hopper damage data was not restored.');
    const skillTypes = new Set(hopperData.skills.map(item => item.type));
    for (const type of ['alpha', 'beta', 'gamma', 'special']) assert(skillTypes.has(type), 'Froppy Hopper is missing ' + type + ' skill data.');
    assert(hopperData.skills.every(item => item.image && item.image.startsWith('https://ultrarumble.com/')), 'One or more Froppy Hopper skill images are missing.');
    for (const skill of hopperData.skills) {
      const response = await fetch(skill.image, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
      assert.equal(response.status, 200, 'Skill image is not reachable: ' + skill.image);
    }
    const beta = hopperData.skills.find(item => item.type === 'beta');
    const betaRows = beta.additionalTable.rows.filter(row => /Splash/.test(row[0] || ''));
    assert(betaRows.some(row => row[2] === '74') && betaRows.some(row => row[2] === '90'), 'Froppy Hopper splash damage levels did not scan correctly.');
    assert(beta.baseTable.rows.some(row => row.includes('6s')), 'Froppy Hopper beta reload at level 9 was not restored.');

    const wholeRoster = readJson(tmpRoot, 'damage_tables.json').characters;
    let tableCount = 0;
    for (const character of wholeRoster) {
      assert(character.damageStyles.length > 0, character.name + ' has no skill styles.');
      for (const style of character.damageStyles) {
        assert(style.skills.length >= 3, character.name + ' / ' + style.styleName + ' has too few skills.');
        for (const skill of style.skills) {
          const tables = [skill.baseTable, skill.additionalTable, skill.specialTable].filter(Boolean);
          for (const table of tables) {
            tableCount++;
            assert(table.headers.length > 0, character.name + ' / ' + style.styleName + ' / ' + skill.name + ' has no column names.');
            assert(table.rows.length > 0, character.name + ' / ' + style.styleName + ' / ' + skill.name + ' has no values.');
            const header = table.headers.map(value => String(value || '').trim().toLowerCase());
            assert(!table.rows.some(row => row.length === header.length &&
              row.every((value, index) => String(value || '').trim().toLowerCase() === header[index])),
            character.name + ' / ' + style.styleName + ' / ' + skill.name + ' includes its heading as a value row.');
          }
        }
        assert(style.skills.some(scanner.hasNonzeroDamageData),
          character.name + ' / ' + style.styleName + ' has no usable damage skill.');
      }
    }
    assert(tableCount > 350, 'The roster scan returned too few skill tables.');

    const restoredNormal = readJson(tmpRoot, 'normal_tuning_parsed.json');
    const normalEntry = restoredNormal.find(item => item.chara === '6' && /Froppy Hopper/i.test(item.name));
    assert(normalEntry && normalEntry.role === 'Strike' && (normalEntry.subEffects || []).some(effect => effect.skillName === 'GP Attack Power+'), 'Froppy Hopper normal tuning data was not restored.');
    const restoredSpecial = readJson(tmpRoot, 'special_tuning_parsed.json');
    assert(restoredSpecial.some(item => item.chara === '6' && /Froppy Hopper/i.test(item.name) && item.id), 'Froppy Hopper special tuning was not restored.');

    const restoredImage = readJson(tmpRoot, 'character_image_manifest.json').characters.find(item => item.id === 'tsuyu');
    const hopperBanner = restoredImage.styleBanners.find(item => item.styleName === 'Froppy Hopper' && /chara_banners\/601\.png$/.test(item.url));
    assert(hopperBanner, 'The Latest Releases Froppy Hopper banner was not restored.');
    assert.equal((await fetch(hopperBanner.url, { method: 'HEAD', signal: AbortSignal.timeout(20000) })).status, 200, 'The Froppy Hopper banner URL is not reachable.');

    const restoredCostumes = readJson(tmpRoot, 'database/costumes.json').tsuyu;
    const restoredOutfit = restoredCostumes.find(item => item.sourceId === latestTsuyu.id);
    assert(restoredOutfit && restoredOutfit.name === latestTsuyu.name, 'Tsuyu Asui latest costume was not restored.');
    assert.equal(restoredOutfit.slots.length, 10, 'The restored outfit does not have all 10 memory slots.');
    assert(restoredOutfit.sp1 && restoredOutfit.sp2, 'The restored outfit is missing one or both special slots.');
    assert(restoredOutfit.assets.thumbnailUrl, 'The restored costume is missing its thumbnail image URL.');
    assert.equal((await fetch(restoredOutfit.assets.thumbnailUrl, { method: 'HEAD', signal: AbortSignal.timeout(20000) })).status, 200, 'The latest costume thumbnail URL is not reachable.');
    assert(readJson(tmpRoot, 'costume_slots_raw.json')[latestTsuyu.id], 'The restored costume ID is not in the raw slot map.');

    const snapshot = readJson(tmpRoot, 'database/official_patch_snapshot.json');
    assert(snapshot.url.includes('/patch/'), 'The latest official patch notes were not saved.');

    if (hasContentStore) {
      // A fresh server process sees changed source files and syncs its durable catalog.
      const publicData = JSON.parse(runInFixture(tmpRoot, "const store=require('./content_store'); console.log(JSON.stringify(store.publicCatalog()));"));
      const publicTsuyu = publicData.characters.find(item => item.id === 'tsuyu');
      assert(publicTsuyu.battleStyles.some(item => item.name === 'Froppy Hopper' && item.type === 'Strike'), 'The published catalog did not pick up Strike Froppy.');
      assert(publicTsuyu.assets.styleBanners.some(item => item.styleName === 'Froppy Hopper'), 'The published catalog did not pick up the style banner.');
      assert(publicData.damageTables.characters.find(item => item.id === 'tsuyu').damageStyles.find(item => /Froppy Hopper/i.test(item.styleName)).skills.every(item => item.image), 'Published catalog lost the Froppy skill images.');
      assert(publicData.normalTunings.some(item => item.name && /Froppy Hopper/i.test(item.name)), 'Published catalog did not pick up the restored normal tuning.');
      assert(publicData.specialTunings.some(item => item.name && /Froppy Hopper/i.test(item.name)), 'Published catalog did not pick up the restored special tuning.');
      assert(publicData.costumes.some(item => item.characterId === 'tsuyu' && item.name === latestTsuyu.name), 'Published catalog did not pick up the restored latest costume.');

      // A running app process must notice scanner file changes rather than
      // serving its first in-memory catalog snapshot until a restart.
      const refreshedInProcess = longLivedStore.publicCatalog();
      const refreshedTsuyu = refreshedInProcess.damageTables.characters.find(item => item.id === 'tsuyu');
      const refreshedHopper = refreshedTsuyu.damageStyles.find(item => /Froppy Hopper/i.test(item.styleName));
      assert(refreshedHopper && refreshedHopper.skills.every(item => item.image), 'The running catalog did not refresh recovered Froppy skill data.');
      assert(refreshedHopper.skills.every(item => [item.baseTable, item.additionalTable, item.specialTable].filter(Boolean).every(table => table.headers.length > 0)),
        'The running catalog refreshed with skill tables that have no column names.');
    }

    console.log(JSON.stringify({
      passed: true,
      disposableBackup: path.join(backupDir, 'removed_source_records.json'),
      testedStyle: hopper.name,
      styleRole: hopper.type,
      skillImages: hopperData.skills.length,
      validatedRoster: { characters: wholeRoster.length, styles: scan.summary.battleStyles, skills: scan.summary.skills, tables: tableCount },
      restoredTunings: { normal: normalEntry.subEffects.map(effect => effect.skillName), special: restoredSpecial.find(item => item.chara === '6' && /Froppy Hopper/i.test(item.name)).skillName },
      restoredCostume: { id: latestTsuyu.id, name: restoredOutfit.name, memorySlots: restoredOutfit.slots.length, specialSlots: 2 },
      cloudCatalogSync: hasContentStore ? 'passed' : 'not used by clean repository baseline',
      longLivedCatalogRefresh: hasContentStore ? 'passed' : 'not used by clean repository baseline'
    }, null, 2));
  } finally {
    const target = path.resolve(tmpRoot);
    const relative = path.relative(cleanupBase, target);
    if (!relative.startsWith('mhur-froppy-scan-') || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Refusing to remove an unexpected scanner test path: ' + target);
    }
    fs.rmSync(target, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
