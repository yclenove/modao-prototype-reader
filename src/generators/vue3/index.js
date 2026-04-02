import fs from 'node:fs';
import path from 'node:path';
import { buildPageModelFromScaffold } from '../../domain/page-model.js';
import { renderVueApi } from '../../templates/vue3/api.js';
import { renderVueComponent } from '../../templates/vue3/components.js';
import { renderVueMock } from '../../templates/vue3/mock.js';
import { renderVuePage } from '../../templates/vue3/page.js';
import { renderVueRouter } from '../../templates/vue3/router.js';
import { renderVueTypes } from '../../templates/vue3/types.js';
import { toAbsolutePath, toJson } from '../../core/utils.js';

export function generateVue3Artifacts(scaffold, options = {}) {
  const model = buildPageModelFromScaffold(scaffold, options);
  const files = [
    {
      relativePath: model.meta.fileName,
      content: renderVuePage(model),
    },
    ...model.components.map((component) => ({
      relativePath: `components/${component.fileName}`,
      content: renderVueComponent(model, component),
    })),
    {
      relativePath: `types/${model.meta.routeName}.types.ts`,
      content: renderVueTypes(model),
    },
    {
      relativePath: `mock/${model.meta.routeName}.mock.ts`,
      content: renderVueMock(model),
    },
    {
      relativePath: `api/${model.meta.routeName}.api.ts`,
      content: renderVueApi(model),
    },
    {
      relativePath: `router/${model.meta.routeName}.route.ts`,
      content: renderVueRouter(model),
    },
  ];

  return {
    model,
    files: [
      ...files,
      {
        relativePath: 'manifest.json',
        content: toJson({
          componentName: model.meta.componentName,
          routeName: model.meta.routeName,
          pageName: model.meta.pageName,
          routePath: model.route.path,
          generatedAt: new Date().toISOString(),
          components: model.components.map((component) => ({
            kind: component.kind,
            name: component.name,
            file: `components/${component.fileName}`,
          })),
          files: files.map((file) => file.relativePath),
        }),
      },
    ],
  };
}

export function writeVue3Artifacts(artifacts, outDir) {
  const absoluteOutDir = toAbsolutePath(outDir);
  fs.mkdirSync(absoluteOutDir, { recursive: true });
  for (const file of artifacts.files) {
    const outputPath = path.join(absoluteOutDir, file.relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, file.content, 'utf8');
  }
  return {
    outDir: absoluteOutDir,
    files: artifacts.files.map((file) => path.join(absoluteOutDir, file.relativePath)),
    componentName: artifacts.model.meta.componentName,
    routeName: artifacts.model.meta.routeName,
  };
}
