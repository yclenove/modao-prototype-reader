import fs from 'node:fs';
import path from 'node:path';
import { buildPageModelFromScaffold } from '../../domain/page-model.js';
import { renderVuePage } from '../../templates/vue3/page.js';
import { renderVueApi, renderVueMock, renderVueTypes } from '../../templates/vue3/support.js';
import { toAbsolutePath, toJson } from '../../core/utils.js';

export function generateVue3Artifacts(scaffold, options = {}) {
  const model = buildPageModelFromScaffold(scaffold, options);
  return {
    model,
    files: [
      {
        relativePath: `${model.meta.componentName}.vue`,
        content: renderVuePage(model),
      },
      {
        relativePath: `${model.meta.componentName}.types.ts`,
        content: renderVueTypes(model),
      },
      {
        relativePath: `${model.meta.componentName}.mock.ts`,
        content: renderVueMock(model),
      },
      {
        relativePath: `${model.meta.componentName}.api.ts`,
        content: renderVueApi(model),
      },
      {
        relativePath: 'manifest.json',
        content: toJson({
          componentName: model.meta.componentName,
          routeName: model.meta.routeName,
          pageName: model.meta.pageName,
          generatedAt: new Date().toISOString(),
          files: [
            `${model.meta.componentName}.vue`,
            `${model.meta.componentName}.types.ts`,
            `${model.meta.componentName}.mock.ts`,
            `${model.meta.componentName}.api.ts`,
          ],
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
