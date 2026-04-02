import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVue3Artifacts } from './index.js';

test('generateVue3Artifacts produces a split Vue module bundle', () => {
  const artifacts = generateVue3Artifacts(
    {
      page: { name: 'User List', width: 1440, height: 900 },
      regions: {
        header: [],
        filters: [{ cid: 'f1', text: 'Keyword' }],
        tables: [{ cid: 't1', display_name: 'Users Table' }],
        dialogs: [],
        media: [],
      },
      states: [{ cid: 's1', name: 'Default', itemCount: 1, widgetCount: 1, interactionCount: 0 }],
      interactions: [{ cid: 'i1', actionType: 'open' }],
      widgetStats: { total: 2, filters: 1, tables: 1, dialogs: 0, media: 0, interactions: 1 },
      suggestedComponents: { filters: true, table: true, dialog: false, imageAssets: false },
    },
    {},
  );

  assert.equal(artifacts.model.meta.componentName, 'UserList');
  assert.equal(artifacts.files.some((file) => file.relativePath === 'pages/UserListPage.vue'), true);
  assert.equal(
    artifacts.files.some((file) => file.relativePath === 'components/UserListPageFiltersPanel.vue'),
    true,
  );
  assert.equal(artifacts.files.some((file) => file.relativePath === 'router/user-list.route.ts'), true);
  const pageFile = artifacts.files.find((f) => f.relativePath === 'pages/UserListPage.vue');
  assert.ok(pageFile);
  assert.match(pageFile.content, /createUserListMockState/);
  assert.match(pageFile.content, /v-model="state\.filters"/);
  assert.match(pageFile.content, /:rows="state\.rows"/);
});
