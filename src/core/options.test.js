import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReadArgs, parseServeArgs } from './options.js';

test('parseReadArgs supports debug and probe output', () => {
  const parsed = parseReadArgs([
    'https://modao.cc/app/demo',
    '--debug',
    '--probe-out',
    'tmp/probe.json',
    '--depth',
    'rich',
  ]);
  assert.equal(parsed.help, false);
  assert.equal(parsed.options.debug, true);
  assert.equal(parsed.options.probeOut, 'tmp/probe.json');
  assert.equal(parsed.options.depth, 'rich');
});

test('parseReadArgs rejects unknown arguments', () => {
  assert.throws(() => parseReadArgs(['https://modao.cc/app/demo', '--wat']), /Unknown argument/);
});

test('parseReadArgs supports local file mode', () => {
  const parsed = parseReadArgs([
    '--file',
    'examples/sample-export.json',
    '--depth',
    'basic',
  ]);
  assert.equal(parsed.help, false);
  assert.equal(parsed.options.file, 'examples/sample-export.json');
  assert.equal(parsed.options.depth, 'basic');
});

test('parseServeArgs parses custom port', () => {
  const parsed = parseServeArgs(['--port', '4000']);
  assert.equal(parsed.help, false);
  assert.equal(parsed.options.port, 4000);
});
