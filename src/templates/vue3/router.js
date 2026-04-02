export function renderVueRouter(model) {
  return `import type { RouteRecordRaw } from 'vue-router';
import ${model.route.pageComponentName} from '../pages/${model.route.pageComponentName}.vue';
import type { ${model.typeNames.routeMeta} } from '../types/${model.meta.routeName}.types';

export const ${model.route.routeConstantName}: RouteRecordRaw = {
  path: ${JSON.stringify(model.route.path)},
  name: ${JSON.stringify(model.route.name)},
  component: ${model.route.pageComponentName},
  meta: {
    title: ${JSON.stringify(model.meta.pageName)},
    fromModao: true,
  } satisfies ${model.typeNames.routeMeta},
};

export default ${model.route.routeConstantName};
`;
}
