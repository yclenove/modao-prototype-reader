import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScopedSelection, buildScaffold, buildSummary } from './transform.js';

function createFixture() {
  return {
    projectTitle: 'Demo',
    totalScreens: 2,
    totalStates: 2,
    totalWidgets: 4,
    totalInteractions: 1,
    currentScreen: { cid: 'screen-b', name: 'Screen B' },
    screenTree: [
      {
        cid: 'root',
        name: 'Root',
        children: [
          { cid: 'screen-a', name: 'Screen A', children: [] },
          { cid: 'screen-b', name: 'Screen B', children: [] },
        ],
      },
    ],
    screens: [
      { cid: 'screen-a', name: 'Screen A' },
      { cid: 'screen-b', name: 'Screen B' },
    ],
    states: [
      { cid: 'state-a', screenMetaCid: 'screen-a', name: 'A', itemCount: 1, widgetCount: 1, interactionCount: 0 },
      { cid: 'state-b', screenMetaCid: 'screen-b', name: 'B', itemCount: 3, widgetCount: 2, interactionCount: 1 },
    ],
    widgets: [
      { cid: 'w1', screenMetaCid: 'screen-b', stateCid: 'state-b', normalizedType: 'button', text: 'Query', top: 100 },
      { cid: 'w2', screenMetaCid: 'screen-b', stateCid: 'state-b', normalizedType: 'table', text: '', top: 300 },
      { cid: 'w3', screenMetaCid: 'screen-b', stateCid: 'state-b', normalizedType: 'panel', text: '', top: 0 },
      { cid: 'w4', screenMetaCid: 'screen-a', stateCid: 'state-a', normalizedType: 'textual', text: 'Hello', top: 20 },
    ],
    interactions: [{ cid: 'i1', screenMetaCid: 'screen-b', stateCid: 'state-b', targetCid: 'screen-a' }],
    diagnostics: { warnings: [] },
  };
}

test('applyScopedSelection filters to a single screen', () => {
  const scoped = applyScopedSelection(createFixture(), {
    only: 'screen',
    screen: 'screen-b',
    screenName: '',
  });
  assert.equal(scoped.totalScreens, 1);
  assert.equal(scoped.screens[0].cid, 'screen-b');
  assert.equal(scoped.states.length, 1);
  assert.equal(scoped.widgets.length, 3);
});

test('buildSummary returns markdown and counts', () => {
  const summary = buildSummary(createFixture());
  assert.equal(summary.counts.screens, 2);
  assert.match(summary.markdown, /Current Screen/);
  assert.equal(summary.currentScreen.name, 'Screen B');
});

test('buildScaffold groups likely regions', () => {
  const scaffold = buildScaffold(createFixture());
  assert.equal(scaffold.page.cid, 'screen-b');
  assert.equal(scaffold.regions.tables.length, 1);
  assert.equal(scaffold.regions.filters.length, 1);
});
