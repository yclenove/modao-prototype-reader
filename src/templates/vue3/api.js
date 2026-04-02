export function renderVueApi(model) {
  return `import type {
  ${model.typeNames.apiQuery},
  ${model.typeNames.apiResponse},
  ${model.typeNames.dialogForm},
} from '../types/${model.meta.routeName}.types';

export async function ${model.api.listFunctionName}(query: ${model.typeNames.apiQuery} = {}): Promise<${model.typeNames.apiResponse}> {
  void query;
  return {
    list: [],
    total: 0,
  };
}

export async function ${model.api.detailFunctionName}(id: string): Promise<${model.typeNames.dialogForm}> {
  return {
    title: id,
    remark: '',
  };
}

export async function ${model.api.saveFunctionName}(payload: ${model.typeNames.dialogForm}) {
  return {
    success: true,
    payload,
  };
}
`;
}
