import test from 'node:test';
import assert from 'node:assert/strict';
import { assertModaoUrl, getTargetScreenCid } from './chrome.js';

test('assertModaoUrl accepts /app/ share links', () => {
  const url = assertModaoUrl('https://modao.cc/app/demo#screen=abc');
  assert.equal(url.pathname, '/app/demo');
});

test('assertModaoUrl accepts /proto/.../sharing links', () => {
  const url = assertModaoUrl(
    'https://modao.cc/proto/ceL566Xtcurc80FWjxL1d/sharing?view_mode=device&screen=rbpTmDSZTmKDjsc45mzudB',
  );
  assert.equal(url.pathname, '/proto/ceL566Xtcurc80FWjxL1d/sharing');
});

test('getTargetScreenCid reads screen from query when hash has no screen', () => {
  const url = new URL(
    'https://modao.cc/proto/x/sharing?screen=rbpTmDSZTmKDjsc45mzudB&canvasId=y',
  );
  assert.equal(getTargetScreenCid(url), 'rbpTmDSZTmKDjsc45mzudB');
});

test('getTargetScreenCid prefers hash screen over query', () => {
  const url = new URL('https://modao.cc/app/demo?screen=from-query#screen=from-hash');
  assert.equal(getTargetScreenCid(url), 'from-hash');
});
