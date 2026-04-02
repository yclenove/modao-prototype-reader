import {
  INTERACTION_WARN_COUNT,
  SIZE_WARN_BYTES,
  WIDGET_WARN_COUNT,
} from './constants.js';
import { groupBy, pickByKeyword, stripHtmlTags, uniqueBy } from './utils.js';

export function buildTree(items) {
  const byId = new Map();
  for (const item of items) {
    byId.set(item.cid, { ...item, children: [] });
  }
  const roots = [];
  for (const item of byId.values()) {
    if (item.parent_cid && byId.has(item.parent_cid)) {
      byId.get(item.parent_cid).children.push(item);
    } else {
      roots.push(item);
    }
  }
  const sortChildren = (nodes) => {
    nodes.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);
  return roots;
}

export function buildStateTree(states) {
  const byScreen = new Map();
  for (const state of states) {
    const list = byScreen.get(state.screenMetaCid) ?? [];
    list.push(state);
    byScreen.set(state.screenMetaCid, list);
  }
  for (const list of byScreen.values()) {
    list.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  }
  return byScreen;
}

export function normalizeWidgetType(item) {
  const name = item.name || 'unknown';
  if (name === 'link') return 'interaction';
  if (name === 'group') return 'group';
  if (name === 'panel') return 'panel';
  if (name === 'table') return 'table';
  if (name === 'image_view') return 'image';
  if (name === 'svg_icon_path') return 'icon';
  if (name === 'mtext_input') return 'form_input';
  if (name === 'selection_control') return 'selection_control';
  if (name.startsWith('button')) return 'button';
  if (name.includes('text') || typeof item.text === 'string') return 'textual';
  return name;
}

export function extractVisibleTextFromWidgets(widgets) {
  const values = new Set();
  for (const widget of widgets) {
    const candidates = [
      typeof widget.text === 'string' ? widget.text : '',
      typeof widget.display_name === 'string' ? widget.display_name : '',
    ];
    if (widget.tableData?.data) {
      for (const row of widget.tableData.data) {
        for (const cell of row) {
          if (typeof cell === 'string' && cell.trim()) {
            values.add(cell.trim());
          }
        }
      }
    }
    if (widget.optionData && Array.isArray(widget.optionData)) {
      for (const option of widget.optionData) {
        if (typeof option === 'string' && option.trim()) {
          values.add(option.trim());
        }
        if (option?.text) {
          values.add(String(option.text).trim());
        }
      }
    }
    for (const candidate of candidates) {
      const cleaned = stripHtmlTags(candidate);
      if (cleaned) {
        values.add(cleaned);
      }
    }
  }
  return Array.from(values);
}

function getScreenBySelection(extracted, options) {
  const screens = extracted.screens;
  if (options.screen) {
    return screens.find((screen) => screen.cid === options.screen) ?? null;
  }
  if (options.screenName) {
    return pickByKeyword(screens, options.screenName, (screen) => screen.name);
  }
  if (options.only === 'current' || options.only === 'screen' || options.only === 'module') {
    return extracted.currentScreen ?? null;
  }
  return null;
}

function collectSubtreeCids(screenTreeNode) {
  const cids = [];
  const walk = (node) => {
    cids.push(node.cid);
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(screenTreeNode);
  return cids;
}

function findTreeNodeByCid(nodes, cid) {
  for (const node of nodes) {
    if (node.cid === cid) {
      return node;
    }
    const nested = findTreeNodeByCid(node.children ?? [], cid);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function findModuleRoot(screenTree, screenCid) {
  const path = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      path.push(node);
      if (node.cid === screenCid) {
        return true;
      }
      if (walk(node.children ?? [])) {
        return true;
      }
      path.pop();
    }
    return false;
  };
  walk(screenTree);
  if (path.length <= 1) {
    return path[0] ?? null;
  }
  return path[1] ?? path[0] ?? null;
}

export function applyScopedSelection(output, options) {
  if (options.only === 'all' && !options.screen && !options.screenName) {
    return output;
  }

  const selectedScreen = getScreenBySelection(output, options);
  if (!selectedScreen) {
    output.diagnostics.warnings.push('Requested screen scope could not be resolved; returning full export.');
    return output;
  }

  let allowedScreenCids = [];
  if (options.only === 'current' || options.only === 'screen') {
    allowedScreenCids = [selectedScreen.cid];
  } else if (options.only === 'module') {
    const moduleRoot = findModuleRoot(output.screenTree, selectedScreen.cid);
    allowedScreenCids = moduleRoot ? collectSubtreeCids(moduleRoot) : [selectedScreen.cid];
  } else {
    allowedScreenCids = [selectedScreen.cid];
  }

  const allowedScreenCidSet = new Set(allowedScreenCids);
  const next = structuredClone(output);
  next.scope = {
    only: options.only,
    requestedScreenCid: options.screen || null,
    requestedScreenName: options.screenName || null,
    resolvedScreenCid: selectedScreen.cid,
    resolvedScreenName: selectedScreen.name,
    includedScreenCount: allowedScreenCidSet.size,
  };

  next.screens = next.screens.filter((screen) => allowedScreenCidSet.has(screen.cid));
  next.states = next.states.filter((state) => allowedScreenCidSet.has(state.screenMetaCid));
  if (next.widgets) {
    next.widgets = next.widgets.filter((widget) => allowedScreenCidSet.has(widget.screenMetaCid));
  }
  if (next.interactions) {
    next.interactions = next.interactions.filter((item) =>
      allowedScreenCidSet.has(item.screenMetaCid),
    );
  }
  if (next.categorizedWidgets) {
    for (const [key, items] of Object.entries(next.categorizedWidgets)) {
      next.categorizedWidgets[key] = items.filter((item) =>
        allowedScreenCidSet.has(item.screenMetaCid),
      );
    }
  }
  next.screenTree = buildTree(next.screens);
  if (next.visibility) {
    next.visibility.filteredFromScreenCount = output.screens.length;
  }
  next.totalScreens = next.screens.length;
  next.totalStates = next.states.length;
  next.totalWidgets = next.widgets?.length ?? 0;
  next.totalInteractions = next.interactions?.length ?? 0;
  next.currentScreen =
    next.screens.find((screen) => screen.cid === selectedScreen.cid) ?? next.screens[0] ?? null;
  next.currentState =
    next.currentScreen && next.states
      ? next.states.find((state) => state.screenMetaCid === next.currentScreen.cid) ?? null
      : null;
  return next;
}

export function buildOutput(extracted, options, url, targetScreenCid) {
  const screenTree = buildTree(extracted.screens);
  const stateTree = buildStateTree(extracted.states);
  const hiddenScreens = extracted.originalScreens.filter(
    (screen) => !extracted.visibleScreenCidSet.includes(screen.cid),
  );
  const dedupedWidgets = uniqueBy(extracted.widgets, (widget) =>
    [widget.screenMetaCid, widget.stateCid, widget.cid].join(':'),
  );
  const widgets = dedupedWidgets.map((widget) => ({
    ...widget,
    normalizedType: normalizeWidgetType(widget),
  }));

  const interactions = uniqueBy(
    widgets
      .filter((widget) => widget.normalizedType === 'interaction')
      .map((widget) => ({
        cid: widget.cid,
        screenMetaCid: widget.screenMetaCid,
        stateCid: widget.stateCid,
        sourceWidgetCids: widget.widget_cids ?? null,
        gesture: widget.gesture ?? null,
        actionType: widget.link_type ?? null,
        targetCid: widget.target_cid ?? null,
        targetStateCid: widget.targetstate_cid ?? null,
        targetWidgetCid: widget.widget_target_cid ?? null,
        screenTargetCid: widget.screen_target_cid ?? null,
        transition: widget.transition ?? null,
        scrollOffset: widget.scroll_offset ?? null,
        timer: widget.timer ?? null,
        reset: widget.reset ?? null,
        raw: options.depth === 'full' ? widget : undefined,
      })),
    (item) => [item.screenMetaCid, item.stateCid, item.cid].join(':'),
  );

  const unresolvedInteractions = interactions.filter(
    (item) =>
      item.targetCid &&
      !extracted.screens.some((screen) => screen.cid === item.targetCid) &&
      !extracted.states.some((state) => state.cid === item.targetCid),
  );

  const widgetGroups = groupBy(
    widgets.filter((widget) => widget.normalizedType !== 'interaction'),
    (widget) => widget.normalizedType,
  );
  const categorizedWidgets = Object.fromEntries(
    Array.from(widgetGroups.entries()).map(([key, value]) => [key, value]),
  );

  const imageAssets = widgets
    .filter((widget) => widget.image || widget.artboard_image_url)
    .map((widget) => ({
      cid: widget.cid,
      screenMetaCid: widget.screenMetaCid,
      stateCid: widget.stateCid,
      name: widget.name,
      display_name: widget.display_name ?? null,
      image: widget.image ?? null,
      artboard_image_url: widget.artboard_image_url ?? null,
      image_rect: widget.image_rect ?? null,
    }));

  const panels = widgets
    .filter((widget) => widget.normalizedType === 'panel')
    .map((widget) => ({
      cid: widget.cid,
      screenMetaCid: widget.screenMetaCid,
      stateCid: widget.stateCid,
      display_name: widget.display_name ?? null,
      panelScreenGlueCid: widget.screen_glue_cid ?? null,
      panelScreenMetaCid: widget.screen_meta_cid ?? null,
      panelScreenStateCid: widget.screen_state_cid ?? null,
      overflow_behavior: widget.overflow_behavior ?? null,
      scroll: widget.scroll ?? null,
    }));

  const tables = widgets
    .filter((widget) => widget.normalizedType === 'table')
    .map((widget) => ({
      cid: widget.cid,
      screenMetaCid: widget.screenMetaCid,
      stateCid: widget.stateCid,
      display_name: widget.display_name ?? null,
      tableData: widget.tableData ?? null,
    }));

  const forms = widgets
    .filter(
      (widget) =>
        widget.normalizedType === 'form_input' ||
        widget.normalizedType === 'selection_control',
    )
    .map((widget) => ({
      cid: widget.cid,
      screenMetaCid: widget.screenMetaCid,
      stateCid: widget.stateCid,
      name: widget.name,
      display_name: widget.display_name ?? null,
      text: widget.text ?? null,
      input_type: widget.input_type ?? null,
      optionData: widget.optionData ?? null,
      selectionControlType: widget.selectionControlType ?? null,
      disabled: widget.disabled ?? null,
    }));

  const textNodes = widgets
    .filter((widget) => widget.text || widget.display_name)
    .map((widget) => ({
      cid: widget.cid,
      screenMetaCid: widget.screenMetaCid,
      stateCid: widget.stateCid,
      name: widget.name,
      display_name: widget.display_name ?? null,
      text: typeof widget.text === 'string' ? stripHtmlTags(widget.text) : null,
      htmlText: typeof widget.text === 'string' ? widget.text : null,
      fontSize: widget.fs ?? null,
      textColor: widget.tc ?? widget.textColor ?? null,
      align: widget.ha ?? null,
      verticalAlign: widget.va ?? null,
      lineHeight: widget.lh ?? null,
    }));

  const screens = extracted.screens.map((screen) => ({
    ...screen,
    states: (stateTree.get(screen.cid) ?? []).map((state) => ({
      cid: state.cid,
      name: state.name,
      position: state.position,
      icon: state.icon,
      itemCount: state.itemCount,
      widgetCount: state.widgetCount,
      interactionCount: state.interactionCount,
    })),
    widgetCount: widgets.filter((widget) => widget.screenMetaCid === screen.cid).length,
    interactionCount: interactions.filter((item) => item.screenMetaCid === screen.cid).length,
  }));

  const output = {
    sourceUrl: url.toString(),
    fetchedAt: new Date().toISOString(),
    depth: options.depth,
    targetScreenCid: targetScreenCid || null,
    projectTitle:
      extracted.projectMeta?.title &&
      extracted.projectMeta.title !== '未命名原型' &&
      extracted.projectMeta.title !== '墨刀'
        ? extracted.projectMeta.title
        : extracted.title,
    totalScreens: screens.length,
    totalStates: extracted.states.length,
    totalWidgets: widgets.length,
    totalInteractions: interactions.length,
    currentScreen: extracted.currentScreen,
    currentState:
      extracted.currentScreen && stateTree.get(extracted.currentScreen.cid)
        ? stateTree.get(extracted.currentScreen.cid)[0] ?? null
        : null,
    project: {
      rootProject: extracted.rootProject,
      projectMeta: extracted.projectMeta,
      projectShare: extracted.projectShare,
      screenGlue: extracted.screenGlue,
      sourceProjectMeta: extracted.sourceProjectMeta,
    },
    projectMeta: extracted.projectMeta,
    projectShare: extracted.projectShare,
    screenTree,
    screens,
    states: extracted.states,
    widgets,
    widgetGroups: Object.fromEntries(
      Object.entries(categorizedWidgets).map(([key, value]) => [key, value.length]),
    ),
    categorizedWidgets:
      options.depth === 'basic'
        ? undefined
        : {
            groups: categorizedWidgets.group ?? [],
            panels,
            tables,
            forms,
            texts: textNodes,
            images: imageAssets,
          },
    interactions,
    assets: {
      images: imageAssets,
      panels,
      tables,
      artboards: extracted.originalScreens
        .filter((screen) => screen.artboard_id || screen.artboard_image_url)
        .map((screen) => ({
          cid: screen.cid,
          name: screen.name,
          artboard_id: screen.artboard_id ?? null,
          artboard_image_url: screen.artboard_image_url ?? null,
        })),
    },
    comments: {
      loadedProjectCid: extracted.commentState.loadedProjectCid ?? null,
      threadCountMap: extracted.commentState.screenCommentThreadCountMap ?? null,
      reachable:
        extracted.commentState.loadedProjectCid !== null ||
        extracted.commentState.screenCommentThreadCountMap !== null,
    },
    visibility: {
      visibleScreenCount: screens.length,
      originalScreenCount: extracted.originalScreens.length,
      hiddenScreenCount: hiddenScreens.length,
      hiddenScreens,
    },
    visibleText: extracted.visibleText,
    extractedTexts:
      options.depth === 'basic'
        ? undefined
        : {
            pageText: extractVisibleTextFromWidgets(widgets),
            widgetTextNodes: textNodes,
          },
    diagnostics: {
      runtimeProbe: extracted.diagnostics,
      sourceAvailability: {
        projectExchange: extracted.diagnostics.hasProjectExchange,
        projectStore: extracted.diagnostics.hasProjectStore,
        localDump: extracted.diagnostics.hasLocalDump,
        extractionMode: extracted.diagnostics.extractionMode ?? null,
        deepRuntimeContainers: extracted.diagnostics.deepRuntimeContainerCount ?? 0,
        comments:
          extracted.commentState.loadedProjectCid !== null ||
          extracted.commentState.screenCommentThreadCountMap !== null,
      },
      widgetTypeCounts: Object.fromEntries(
        Object.entries(categorizedWidgets).map(([key, value]) => [key, value.length]),
      ),
      duplicateWidgetCount: extracted.widgets.length - widgets.length,
      unresolvedInteractionCount: unresolvedInteractions.length,
      unresolvedInteractions,
      thresholds: {
        widgetWarnCount: WIDGET_WARN_COUNT,
        interactionWarnCount: INTERACTION_WARN_COUNT,
        sizeWarnBytes: SIZE_WARN_BYTES,
      },
      warnings: [
        hiddenScreens.length > 0
          ? `Found ${hiddenScreens.length} screens in original metadata that are not visible in the current share view.`
          : null,
        extracted.commentState.loadedProjectCid === null &&
        extracted.commentState.screenCommentThreadCountMap === null
          ? 'Comments were not available from the current public runtime state.'
          : null,
        widgets.length > WIDGET_WARN_COUNT
          ? `Widget count ${widgets.length} exceeds the warning threshold ${WIDGET_WARN_COUNT}.`
          : null,
        interactions.length > INTERACTION_WARN_COUNT
          ? `Interaction count ${interactions.length} exceeds the warning threshold ${INTERACTION_WARN_COUNT}.`
          : null,
      ].filter(Boolean),
    },
  };

  if (options.depth !== 'full') {
    delete output.comments.threadCountMap;
  }
  if (options.depth === 'basic') {
    delete output.widgets;
    delete output.interactions;
    delete output.assets;
    delete output.comments;
    delete output.categorizedWidgets;
    delete output.extractedTexts;
  }
  return output;
}

export function buildSummary(output) {
  const currentScreen = output.currentScreen;
  const currentScreenWidgets =
    output.widgets?.filter((widget) => widget.screenMetaCid === currentScreen?.cid) ?? [];
  const currentInteractions =
    output.interactions?.filter((item) => item.screenMetaCid === currentScreen?.cid) ?? [];
  const widgetGroups = groupBy(currentScreenWidgets, (widget) => widget.normalizedType);

  const summary = {
    projectTitle: output.projectTitle,
    scope: output.scope ?? null,
    currentScreen: currentScreen
      ? {
          cid: currentScreen.cid,
          name: currentScreen.name,
          size: `${currentScreen.width ?? '-'} x ${currentScreen.height ?? '-'}`,
        }
      : null,
    counts: {
      screens: output.totalScreens,
      states: output.totalStates,
      widgets: output.totalWidgets ?? 0,
      interactions: output.totalInteractions ?? 0,
    },
    currentScreenStructure: {
      states: output.states
        .filter((state) => state.screenMetaCid === currentScreen?.cid)
        .map((state) => ({
          cid: state.cid,
          name: state.name,
          itemCount: state.itemCount,
          widgetCount: state.widgetCount,
          interactionCount: state.interactionCount,
        })),
      widgetGroups: Object.fromEntries(
        Array.from(widgetGroups.entries()).map(([key, value]) => [key, value.length]),
      ),
      likelySections: inferLikelySections(currentScreenWidgets),
      primaryTexts: extractVisibleTextFromWidgets(currentScreenWidgets).slice(0, 50),
      interactionTargets: currentInteractions.slice(0, 50).map((item) => ({
        gesture: item.gesture,
        actionType: item.actionType,
        targetCid: item.targetCid,
        targetStateCid: item.targetStateCid,
      })),
    },
  };

  summary.markdown = buildSummaryMarkdown(summary);
  return summary;
}

function inferLikelySections(widgets) {
  return {
    filters: widgets.filter((widget) =>
      ['form_input', 'selection_control', 'button'].includes(widget.normalizedType),
    ).length,
    tables: widgets.filter((widget) => widget.normalizedType === 'table').length,
    panels: widgets.filter((widget) => widget.normalizedType === 'panel').length,
    images: widgets.filter((widget) => widget.normalizedType === 'image').length,
    buttons: widgets.filter((widget) => widget.normalizedType === 'button').length,
    textBlocks: widgets.filter((widget) => widget.normalizedType === 'textual').length,
  };
}

function buildSummaryMarkdown(summary) {
  const lines = [
    `# ${summary.projectTitle}`,
    '',
    '## Current Screen',
    summary.currentScreen
      ? `- ${summary.currentScreen.name} (${summary.currentScreen.cid})`
      : '- Not resolved',
    '',
    '## Counts',
    `- Screens: ${summary.counts.screens}`,
    `- States: ${summary.counts.states}`,
    `- Widgets: ${summary.counts.widgets}`,
    `- Interactions: ${summary.counts.interactions}`,
    '',
    '## Likely Sections',
  ];

  for (const [key, value] of Object.entries(summary.currentScreenStructure.likelySections)) {
    lines.push(`- ${key}: ${value}`);
  }

  lines.push('', '## Key Texts');
  for (const text of summary.currentScreenStructure.primaryTexts.slice(0, 20)) {
    lines.push(`- ${text}`);
  }
  return lines.join('\n');
}

export function buildScaffold(output) {
  const screen = output.currentScreen;
  const widgets = output.widgets?.filter((widget) => widget.screenMetaCid === screen?.cid) ?? [];
  const currentStates = output.states?.filter((state) => state.screenMetaCid === screen?.cid) ?? [];
  const currentInteractions =
    output.interactions?.filter((interaction) => interaction.screenMetaCid === screen?.cid) ?? [];
  const filterWidgets = widgets.filter((widget) =>
    ['form_input', 'selection_control', 'button'].includes(widget.normalizedType),
  );
  const tableWidgets = widgets.filter((widget) => widget.normalizedType === 'table');
  const dialogWidgets = widgets.filter((widget) => widget.normalizedType === 'panel');
  const mediaWidgets = widgets.filter((widget) => ['image', 'icon'].includes(widget.normalizedType));

  return {
    page: {
      cid: screen?.cid ?? null,
      name: screen?.name ?? null,
      width: screen?.width ?? null,
      height: screen?.height ?? null,
    },
    regions: {
      header: widgets.filter((widget) => widget.top !== null && widget.top < 180),
      filters: filterWidgets,
      tables: tableWidgets,
      dialogs: dialogWidgets,
      media: mediaWidgets,
    },
    states: currentStates,
    interactions: currentInteractions,
    widgetStats: {
      total: widgets.length,
      filters: filterWidgets.length,
      tables: tableWidgets.length,
      dialogs: dialogWidgets.length,
      media: mediaWidgets.length,
      interactions: currentInteractions.length,
    },
    suggestedComponents: {
      filters: filterWidgets.length > 0,
      table: tableWidgets.length > 0,
      dialog: dialogWidgets.length > 0,
      imageAssets: widgets.some((widget) => widget.normalizedType === 'image'),
      toolbar: widgets.some((widget) => widget.normalizedType === 'button'),
      summaryCards: widgets.filter((widget) => widget.normalizedType === 'textual').length >= 3,
    },
  };
}

export function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { message };
}

export function resolveScopeRoot(output, screenCid) {
  return findTreeNodeByCid(output.screenTree, screenCid);
}
