export function renderVueTypes(model) {
  return `export interface ${model.typeNames.filterForm} {
  keyword: string;
  status: string;
}

export interface ${model.typeNames.tableRow} {
  id: string;
  title: string;
  status: string;
}

export interface ${model.typeNames.dialogForm} {
  title: string;
  remark: string;
}

export interface ${model.typeNames.apiQuery} {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface ${model.typeNames.apiResponse} {
  list: ${model.typeNames.tableRow}[];
  total: number;
}

export interface ${model.typeNames.routeMeta} {
  title: string;
  fromModao: true;
}

export interface ${model.typeNames.pageState} {
  pageTitle: string;
  routeName: string;
  filters: ${model.typeNames.filterForm};
  dialogVisible: boolean;
  states: Array<{
    cid: string | null;
    name: string | null;
    itemCount: number;
    widgetCount: number;
    interactionCount: number;
  }>;
  rows: ${model.typeNames.tableRow}[];
}
`;
}
