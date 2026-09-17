'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { refreshKeepalive, QUIET_PERIOD_MS } = require('../scripts/scanner_keepalive');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mhur-scanner-keepalive-'));
const now = Date.parse('2026-09-17T12:00:00.000Z');
const heartbeatPath = path.join(root, '.github', 'scanner_heartbeat.json');

try {
  const first = refreshKeepalive({ root, now, lastActivityMs: now });
  assert.equal(first.updated, true, 'A missing keepalive record should be initialized.');
  assert.equal(JSON.parse(fs.readFileSync(heartbeatPath, 'utf8')).checkedAt, new Date(now).toISOString());

  const fresh = refreshKeepalive({ root, now: now + 5 * 24 * 60 * 60 * 1000, lastActivityMs: now });
  assert.equal(fresh.updated, false, 'Recent repository activity should not make extra commits.');

  const due = refreshKeepalive({ root, now: now + QUIET_PERIOD_MS, lastActivityMs: now });
  assert.equal(due.updated, true, 'A new keepalive should be written after a quiet month.');
  assert.equal(JSON.parse(fs.readFileSync(heartbeatPath, 'utf8')).checkedAt,
    new Date(now + QUIET_PERIOD_MS).toISOString());

  console.log('Scanner keepalive smoke tests passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
