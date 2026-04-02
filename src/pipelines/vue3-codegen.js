import fs from 'node:fs';
import { buildScaffold } from '../core/transform.js';
import { toAbsolutePath } from '../core/utils.js';
import { generateVue3Artifacts, writeVue3Artifacts } from '../generators/vue3/index.js';

export function loadScaffoldLikeInput(inputPath) {
  const absolutePath = toAbsolutePath(inputPath);
  const json = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const scaffold = json.page && json.regions ? json : buildScaffold(json);
  return {
    absolutePath,
    scaffold,
    sourceKind: json.page && json.regions ? 'scaffold' : 'export',
  };
}

export function runVue3CodegenPipeline(options) {
  const loaded = loadScaffoldLikeInput(options.input);
  const artifacts = generateVue3Artifacts(loaded.scaffold, options);
  const written = writeVue3Artifacts(artifacts, options.outDir);
  return {
    ...written,
    sourceKind: loaded.sourceKind,
    sourcePath: loaded.absolutePath,
  };
}
