import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeReadArtifacts } from './service.js';

test('writeReadArtifacts persists probe output when requested', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'modao-reader-test-'));
  const result = {
    output: { projectTitle: 'Demo' },
    summary: { markdown: '# Demo' },
    scaffold: { page: { cid: 'screen-1' } },
    screenshotBase64: null,
    debug: { waitSummary: { stage: 'ready' }, probeHistory: [] },
    meta: { projectTitle: 'Demo' },
  };

  const written = await writeReadArtifacts(result, {
    out: path.join(tempDir, 'export.json'),
    screenshot: '',
    splitScreens: false,
    summaryOut: '',
    scaffoldOut: '',
    probeOut: path.join(tempDir, 'probe.json'),
  });

  assert.equal(fs.existsSync(path.join(tempDir, 'export.json')), true);
  assert.equal(fs.existsSync(path.join(tempDir, 'probe.json')), true);
  assert.equal(written.probeOut, path.join(tempDir, 'probe.json'));
});
