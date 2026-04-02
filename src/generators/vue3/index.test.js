import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVue3Artifacts } from './index.js';

test('generateVue3Artifacts produces a Vue page bundle', () => {
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
      suggestedComponents: { filters: true, table: true, dialog: false, imageAssets: false },
    },
    {},
  );

  assert.equal(artifacts.model.meta.componentName, 'UserList');
  assert.equal(artifacts.files.some((file) => file.relativePath === 'UserList.vue'), true);
  assert.match(artifacts.files[0].content, /Generated From Modao Scaffold/);
});
