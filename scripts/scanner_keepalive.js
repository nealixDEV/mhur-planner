'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Keep a 30-day margin before GitHub's 60-day inactivity pause for public repos.
const QUIET_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const HEARTBEAT_RELATIVE_PATH = '.github/scanner_heartbeat.json';

function refreshKeepalive(options) {
  options = options || {};
  const root = path.resolve(options.root || path.join(__dirname, '..'));
  const now = options.now === undefined ? Date.now() : Number(options.now);
  if (!Number.isFinite(now)) throw new Error('A valid clock time is required.');

  let lastActivityMs = options.lastActivityMs;
  if (lastActivityMs === undefined) {
    const latestCommit = execFileSync('git', ['log', '-1', '--format=%ct'], {
      cwd: root,
      encoding: 'utf8'
    }).trim();
    lastActivityMs = Number(latestCommit) * 1000;
  } else {
    lastActivityMs = Number(lastActivityMs);
  }

  if (Number.isFinite(lastActivityMs) && now - lastActivityMs < QUIET_PERIOD_MS) {
    return { updated: false, reason: 'Recent repository activity already keeps the schedule awake.' };
  }

  const heartbeatPath = path.join(root, HEARTBEAT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(heartbeatPath), { recursive: true });
  const record = {
    checkedAt: new Date(now).toISOString(),
    purpose: 'Keep the scheduled catalog scan active during quiet periods.'
  };
  const temporaryPath = heartbeatPath + '.tmp';
  fs.writeFileSync(temporaryPath, JSON.stringify(record, null, 2) + '\n');
  fs.renameSync(temporaryPath, heartbeatPath);
  return { updated: true, path: HEARTBEAT_RELATIVE_PATH, checkedAt: record.checkedAt };
}

if (require.main === module) {
  const result = refreshKeepalive();
  console.log(result.updated ? 'Scanner schedule keepalive refreshed.' : 'Scanner schedule keepalive not needed yet.');
}

module.exports = { refreshKeepalive, QUIET_PERIOD_MS };
