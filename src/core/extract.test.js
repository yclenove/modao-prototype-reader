import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForPrototype } from './extract.js';

test('waitForPrototype returns probe history when ready', async () => {
  const probes = [
    {
      title: 'Loading',
      readyState: 'interactive',
      hasMb: true,
      hasProjectExchange: false,
      hasRootProject: false,
      hasProjectMeta: false,
      hasProjectStore: false,
      screenCount: 0,
      stateContainerCount: 0,
      currentScreenCid: '',
      href: 'https://modao.cc/app/demo',
    },
    {
      title: 'Ready',
      readyState: 'complete',
      hasMb: true,
      hasProjectExchange: true,
      hasRootProject: true,
      hasProjectMeta: true,
      hasProjectStore: true,
      screenCount: 2,
      stateContainerCount: 2,
      currentScreenCid: 'screen-1',
      href: 'https://modao.cc/app/demo',
    },
  ];
  const client = {
    async evaluate() {
      return probes.shift();
    },
  };

  const result = await waitForPrototype(client, 2500);
  assert.equal(result.summary.stage, 'ready');
  assert.equal(result.probes.length, 2);
});

test('waitForPrototype accepts dump fallback readiness', async () => {
  const client = {
    async evaluate() {
      return {
        title: 'Dump Ready',
        readyState: 'complete',
        hasMb: true,
        hasProjectExchange: true,
        hasRootProject: false,
        hasProjectMeta: false,
        hasProjectStore: false,
        hasProjectStoreViaCurrent: false,
        hasLocalDump: true,
        hasScreenMetaList: false,
        screenCount: 0,
        stateContainerCount: 0,
        dumpScreenCount: 3,
        dumpStateContainerCount: 2,
        currentScreenCid: 'screen-1',
        href: 'https://modao.cc/app/demo',
      };
    },
  };

  const result = await waitForPrototype(client, 2500);
  assert.equal(result.summary.stage, 'dump_fallback_ready');
  assert.equal(result.summary.screenCount, 3);
});

test('waitForPrototype accepts dump when runtime states exist only in deep scan', async () => {
  const client = {
    async evaluate() {
      return {
        title: 'Deep Dump Ready',
        readyState: 'complete',
        hasMb: true,
        hasProjectExchange: true,
        hasRootProject: false,
        hasProjectMeta: false,
        hasProjectStore: false,
        hasProjectStoreViaCurrent: false,
        hasLocalDump: true,
        hasScreenMetaList: false,
        screenCount: 0,
        stateContainerCount: 0,
        dumpScreenCount: 2,
        dumpStateContainerCount: 0,
        dumpDeepRuntimeCount: 1,
        currentScreenCid: '',
        href: 'https://modao.cc/app/demo',
      };
    },
  };

  const result = await waitForPrototype(client, 2500);
  assert.equal(result.summary.stage, 'dump_fallback_ready');
  assert.equal(result.summary.stateContainerCount, 1);
});

test('waitForPrototype accepts proto /sharing view without ProjectExchange', async () => {
  const client = {
    async evaluate() {
      return {
        title: '【框架】可视化大屏',
        readyState: 'complete',
        hasMb: true,
        hasProjectExchange: false,
        hasRootProject: true,
        hasProjectMeta: false,
        hasRootProjectEffective: true,
        hasProjectMetaEffective: false,
        hasProjectStore: false,
        hasProjectStoreViaCurrent: false,
        hasLocalDump: false,
        hasScreenMetaList: true,
        screenCount: 2,
        stateContainerCount: 0,
        dumpScreenCount: 0,
        dumpStateContainerCount: 0,
        dumpDeepRuntimeCount: 0,
        liveDeepRuntimeCount: 0,
        currentScreenCid: 'rbpTmDSZTmKDjsc45mzudB',
        href: 'https://modao.cc/proto/ceL566Xtcurc80FWjxL1d/sharing?view_mode=device&screen=rbpTmDSZTmKDjsc45mzudB',
      };
    },
  };

  const result = await waitForPrototype(client, 2500);
  assert.equal(result.summary.stage, 'proto_sharing_ready');
  assert.equal(result.probe.currentScreenCid, 'rbpTmDSZTmKDjsc45mzudB');
});

test('waitForPrototype exposes timeout diagnostics', async () => {
  const client = {
    async evaluate() {
      return {
        title: 'Denied',
        readyState: 'complete',
        hasMb: false,
        hasProjectExchange: false,
        hasRootProject: false,
        hasProjectMeta: false,
        hasProjectStore: false,
        hasProjectStoreViaCurrent: false,
        hasLocalDump: false,
        hasScreenMetaList: false,
        screenCount: 0,
        stateContainerCount: 0,
        dumpScreenCount: 0,
        dumpStateContainerCount: 0,
        currentScreenCid: '',
        href: 'https://modao.cc/app/demo',
      };
    },
  };

  await assert.rejects(
    waitForPrototype(client, 1, { debug: true }),
    (error) =>
      error.code === 'PROTOTYPE_TIMEOUT' &&
      error.details.debugEnabled === true &&
      Array.isArray(error.details.probeSummaries),
  );
});
