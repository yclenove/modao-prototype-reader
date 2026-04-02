import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOptionsFromPayload } from './server.js';

test('buildOptionsFromPayload maps debug fields', () => {
  const options = buildOptionsFromPayload({
    url: 'https://modao.cc/app/demo',
    debug: true,
    probeOut: 'tmp/probe.json',
    timeoutMs: 2000,
  });

  assert.equal(options.url, 'https://modao.cc/app/demo');
  assert.equal(options.debug, true);
  assert.equal(options.probeOut, 'tmp/probe.json');
  assert.equal(options.timeoutMs, 2000);
});

test('buildOptionsFromPayload preserves defaults for generate route inputs indirectly', () => {
  const options = buildOptionsFromPayload({
    url: 'https://modao.cc/app/demo',
  });

  assert.equal(options.only, 'all');
  assert.equal(options.depth, 'basic');
});
