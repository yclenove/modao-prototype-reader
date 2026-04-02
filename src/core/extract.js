import { DEFAULT_POLL_MS } from './constants.js';
import { ModaoReaderError } from './errors.js';
import { sleep } from './utils.js';

function createProbeSummary(probe) {
  const matchedSignals = [
    probe.hasMb ? 'mb' : null,
    probe.hasProjectExchange ? 'projectExchange' : null,
    probe.hasRootProject ? 'rootProject' : null,
    probe.hasProjectMeta ? 'projectMeta' : null,
    probe.hasProjectStore ? 'projectStore' : null,
    probe.screenCount > 0 ? 'screens' : null,
    probe.stateContainerCount > 0 ? 'runtimeStates' : null,
  ].filter(Boolean);

  let stage = 'booting';
  if (!probe.hasMb && !probe.hasProjectExchange) {
    stage = 'runtime_missing';
  } else if (!probe.hasRootProject || !probe.hasProjectMeta) {
    stage = 'project_loading';
  } else if (!probe.hasProjectStore) {
    stage = 'store_unavailable';
  } else if (probe.screenCount <= 0) {
    stage = 'screens_unavailable';
  } else if (probe.stateContainerCount <= 0) {
    stage = 'state_containers_unavailable';
  } else {
    stage = 'ready';
  }

  return {
    stage,
    matchedSignals,
    title: probe.title,
    readyState: probe.readyState,
    currentScreenCid: probe.currentScreenCid,
    screenCount: probe.screenCount,
    stateContainerCount: probe.stateContainerCount,
  };
}

export async function waitForPrototype(client, timeoutMs, options = {}) {
  const deadline = Date.now() + timeoutMs;
  const probes = [];

  while (Date.now() < deadline) {
    const probe = await client.evaluate(`(() => {
      const state = window.MB?.webpackInterface?.store?.getState?.();
      const current = state?.container?.current || {};
      const upperCid = current.projectMeta?.upper_cid || null;
      const runtimeStateList = upperCid
        ? window.ProjectExchange?.getLocalScreenRuntimeStateListByUpperCid?.(upperCid)
        : null;
      const hasRootProject = Boolean(current.rootProject || window.MB?.currentProject);
      const hasMb = Boolean(window.MB);
      const hasProjectExchange = Boolean(window.ProjectExchange);
      const hasProjectMeta = Boolean(current.projectMeta || window.MB?.currentProjectMeta);
      const hasProjectStore = Boolean(
        upperCid ? window.ProjectExchange?.getProjectStoreByUpperCid?.(upperCid) : null,
      );
      return {
        title: document.title,
        readyState: document.readyState,
        hasMb,
        hasProjectExchange,
        hasRootProject,
        hasProjectMeta,
        hasProjectStore,
        screenCount: current.screenMetaList?.length || 0,
        stateContainerCount: runtimeStateList?.length || 0,
        currentScreenCid: current.screenMeta?.cid || '',
        href: location.href,
      };
    })()`);
    probes.push({
      polledAt: new Date().toISOString(),
      ...probe,
      summary: createProbeSummary(probe),
    });

    if (
      probe.screenCount > 0 &&
      probe.stateContainerCount > 0 &&
      probe.hasRootProject &&
      probe.hasProjectMeta &&
      probe.hasProjectStore
    ) {
      return {
        probe,
        probes,
        summary: createProbeSummary(probe),
      };
    }

    await sleep(DEFAULT_POLL_MS);
  }

  throw new ModaoReaderError(
    'PROTOTYPE_TIMEOUT',
    'Timed out waiting for Modao prototype data. The share link may be invalid, password-protected, or require permissions.',
    {
      timeoutMs,
      latestProbe: probes.at(-1) ?? null,
      probeCount: probes.length,
      probeSummaries: probes.slice(-5).map((item) => item.summary),
      debugEnabled: Boolean(options.debug),
    },
  );
}

export function buildBrowserExtractionScript({ depth, targetScreenCid }) {
  return `(() => {
    const depth = ${JSON.stringify(depth)};
    const targetScreenCid = ${JSON.stringify(targetScreenCid)};
    const state = window.MB?.webpackInterface?.store?.getState?.() || {};
    const current = state.container?.current || {};
    const common = state.container?.common || {};
    const comment = state.container?.comment || {};
    const rootProject = current.rootProject || window.MB?.currentProject || null;
    const projectMeta = current.projectMeta || window.MB?.currentProjectMeta || null;
    const screenGlue = current.screenGlue || window.MB?.currentScreenGlue || null;
    const projectShare = current.projectShare || null;
    const currentScreen = current.screenMeta || null;
    const upperCid = projectMeta?.upper_cid || null;
    const projectStore = upperCid ? window.ProjectExchange?.getProjectStoreByUpperCid?.(upperCid) : null;
    const localDumpList = window.ProjectExchange?.generateLocalDump?.() || [];

    const normalizeArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'object') return Object.values(value);
      return [];
    };

    const normalizePrimitive = (value) => {
      if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value ?? null;
      }
      if (Array.isArray(value)) {
        return value.slice(0, 500).map((item) => normalizePrimitive(item));
      }
      if (typeof value === 'object') {
        const output = {};
        for (const [key, item] of Object.entries(value)) {
          if (typeof item === 'function') continue;
          output[key] = normalizePrimitive(item);
        }
        return output;
      }
      return String(value);
    };

    const pickScreen = (screen) => ({
      cid: screen?.cid ?? null,
      mtime: screen?.mtime ?? null,
      name: screen?.name ?? null,
      ctime: screen?.ctime ?? null,
      parent_cid: screen?.parent_cid ?? null,
      position: screen?.position ?? 0,
      expanded: screen?.expanded ?? null,
      orientation: screen?.orientation ?? '',
      width: screen?.width ?? null,
      height: screen?.height ?? null,
      bgcolor: screen?.bgcolor ?? null,
      bgimage: screen?.bgimage ?? null,
      artboard_id: screen?.artboard_id ?? null,
      artboard_image_url: screen?.artboard_image_url ?? null,
      project_meta_cid: screen?.project_meta_cid ?? null,
      screen_glue_cid: screen?.screen_glue_cid ?? null,
      firstState: screen?.firstState
        ? {
            cid: screen.firstState.cid ?? null,
            name: screen.firstState.name ?? null,
            position: screen.firstState.position ?? 0,
            icon: screen.firstState.icon ?? null,
          }
        : null,
    });

    const pickStateMeta = (screenMetaCid, stateMeta, items) => {
      const safeItems = normalizeArray(items);
      const widgetCount = safeItems.filter((item) => item?.name !== 'link').length;
      const interactionCount = safeItems.filter((item) => item?.name === 'link').length;
      return {
        screenMetaCid,
        cid: stateMeta?.cid ?? null,
        mtime: stateMeta?.mtime ?? null,
        name: stateMeta?.name ?? null,
        position: stateMeta?.position ?? 0,
        fh: stateMeta?.fh ?? null,
        hh: stateMeta?.hh ?? null,
        icon: stateMeta?.icon ?? null,
        itemCount: safeItems.length,
        widgetCount,
        interactionCount,
      };
    };

    const pickWidget = (screenMetaCid, stateCid, item) => {
      const base = {
        screenMetaCid,
        stateCid,
        cid: item?.cid ?? null,
        mtime: item?.mtime ?? null,
        name: item?.name ?? 'unknown',
        display_name: item?.display_name ?? null,
        gid: item?.gid ?? null,
        link_cids: item?.link_cids ?? null,
        widget_cids: item?.widget_cids ?? null,
        target_cid: item?.target_cid ?? null,
        targetstate_cid: item?.targetstate_cid ?? null,
        widget_target_cid: item?.widget_target_cid ?? null,
        screen_target_cid: item?.screen_target_cid ?? null,
        link_type: item?.link_type ?? null,
        gesture: item?.gesture ?? null,
        transition: item?.transition ?? null,
        timer: item?.timer ?? null,
        reset: item?.reset ?? null,
        scroll_offset: item?.scroll_offset ?? null,
        menu_offset: item?.menu_offset ?? null,
        v: item?.v ?? null,
        locked: item?.locked ?? null,
        z: item?.z ?? null,
        o: item?.o ?? null,
        left: item?.left ?? null,
        top: item?.top ?? null,
        width: item?.width ?? null,
        height: item?.height ?? null,
        aspect_ratio: item?.aspect_ratio ?? null,
        ro: item?.ro ?? null,
        primary_fixed: item?.primary_fixed ?? null,
        text: typeof item?.text === 'string' ? item.text : null,
        fs: item?.fs ?? null,
        lh: item?.lh ?? null,
        ha: item?.ha ?? null,
        va: item?.va ?? null,
        td: item?.td ?? null,
        tc: item?.tc ?? item?.textColor ?? null,
        background: normalizePrimitive(item?.background ?? null),
        border: normalizePrimitive(item?.border ?? null),
        border_radius: item?.border_radius ?? null,
        border_visibility: normalizePrimitive(item?.border_visibility ?? null),
        fills: normalizePrimitive(item?.fills ?? null),
        box_shadow: item?.box_shadow ?? null,
        text_shadow: item?.text_shadow ?? null,
        image: item?.image ?? null,
        image_rect: normalizePrimitive(item?.image_rect ?? null),
        icon: item?.icon ?? null,
        path: item?.path ?? null,
        svgAttr: normalizePrimitive(item?.svgAttr ?? null),
        view_box: item?.view_box ?? null,
        input_type: item?.input_type ?? null,
        optionData: normalizePrimitive(item?.optionData ?? null),
        selectionControlType: item?.selectionControlType ?? null,
        disabled: item?.disabled ?? null,
        tableData: normalizePrimitive(item?.tableData ?? null),
        screen_glue_cid: item?.screen_glue_cid ?? null,
        screen_meta_cid: item?.screen_meta_cid ?? null,
        screen_state_cid: item?.screen_state_cid ?? null,
        overflow_behavior: item?.overflow_behavior ?? null,
        scroll: normalizePrimitive(item?.scroll ?? null),
      };

      if (depth === 'full') {
        base.raw = normalizePrimitive(item);
      }
      return base;
    };

    const localScreenMetaList = projectStore?.getLocalScreenMetaList?.() || current.screenMetaList || [];
    const visibleScreenMetaList = current.screenMetaList || [];
    const originalScreenMetaList = current.originalScreenMetaList || localScreenMetaList || [];
    const localScreenGlueList = projectStore?.getLocalScreenGlueList?.() || [];
    const localRuntimeStateList =
      projectStore?.getLocalScreenRuntimeStateList?.() ||
      (upperCid ? window.ProjectExchange?.getLocalScreenRuntimeStateListByUpperCid?.(upperCid) : []) ||
      [];

    const dumpCandidate = normalizeArray(localDumpList).find((item) => {
      return item?.projectMetaCid === projectMeta?.cid || !projectMeta?.cid;
    }) || normalizeArray(localDumpList)[0] || null;

    const states = [];
    const widgets = [];
    for (const screenStateContainer of normalizeArray(localRuntimeStateList)) {
      const screenMetaCid = screenStateContainer?.screenMetaCid ?? null;
      const dataMap = screenStateContainer?.dataMap || {};
      const itemListMap = screenStateContainer?.itemListMap || {};
      for (const stateCid of Object.keys(dataMap)) {
        const stateMeta = dataMap[stateCid];
        const items = normalizeArray(itemListMap[stateCid]);
        states.push(pickStateMeta(screenMetaCid, stateMeta, items));
        if (depth !== 'basic') {
          for (const item of items) {
            widgets.push(pickWidget(screenMetaCid, stateCid, item));
          }
        }
      }
    }

    const screens = normalizeArray(visibleScreenMetaList).map(pickScreen);
    const originalScreens = normalizeArray(originalScreenMetaList).map(pickScreen);
    const sourceProjectMeta = normalizePrimitive(projectMeta);
    const sourceRootProject = normalizePrimitive(rootProject);
    const screenGlueSafe = normalizePrimitive(screenGlue);
    const currentScreenSafe =
      screens.find((screen) => screen.cid === currentScreen?.cid) ||
      screens.find((screen) => screen.cid === targetScreenCid) ||
      null;

    return {
      title: document.title,
      href: location.href,
      visibleText: (document.body?.innerText || '').trim(),
      rootProject: sourceRootProject,
      projectMeta: projectMeta
        ? {
            cid: projectMeta.cid ?? null,
            title: projectMeta.title ?? projectMeta.name ?? document.title,
            name: projectMeta.name ?? null,
            width: projectMeta.width ?? null,
            height: projectMeta.height ?? null,
            upper_cid: projectMeta.upper_cid ?? null,
            upper_type: projectMeta.upper_type ?? null,
          }
        : null,
      sourceProjectMeta,
      projectShare: projectShare
        ? {
            cid: projectShare.cid ?? null,
            access_token: projectShare.access_token ?? null,
            project_cid: projectShare.project_cid ?? null,
            view_access: projectShare.view_access ?? null,
            password: projectShare.password ?? null,
            screen_visible_switch: Boolean(projectShare.screen_visible_switch),
            screen_visible_list: normalizeArray(projectShare.screen_visible_list),
            simulator_type: projectShare.simulator_type ?? null,
            comment_permission: projectShare.comment_permission ?? null,
            view_sticky: projectShare.view_sticky ?? null,
            sticky: projectShare.sticky ?? null,
            highlight: projectShare.highlight ?? null,
            view_count: projectShare.view_count ?? null,
          }
        : null,
      screenGlue: screenGlueSafe,
      currentScreen: currentScreenSafe,
      screens,
      originalScreens,
      visibleScreenCidSet: screens.map((screen) => screen.cid),
      localScreenGlues: normalizeArray(localScreenGlueList).map((glue) => normalizePrimitive(glue)),
      states,
      widgets,
      commentState: {
        loadedProjectCid: comment.loadedProjectCid ?? null,
        screenCommentThreadCountMap: normalizePrimitive(common.screenCommentThreadCountMap ?? null),
      },
      diagnostics: {
        hasProjectExchange: Boolean(window.ProjectExchange),
        hasProjectStore: Boolean(projectStore),
        hasLocalDump: Boolean(dumpCandidate),
        storeKeys: Object.keys(state || {}),
        currentKeys: Object.keys(current || {}),
        modelKeys: Object.keys(state.model || {}),
        mbKeys: Object.keys(window.MB || {}).slice(0, 80),
        projectExchangeKeys: Object.keys(window.ProjectExchange || {}).slice(0, 80),
        localScreenMetaCount: normalizeArray(localScreenMetaList).length,
        visibleScreenCount: screens.length,
        originalScreenCount: originalScreens.length,
        localScreenGlueCount: normalizeArray(localScreenGlueList).length,
        runtimeStateContainerCount: normalizeArray(localRuntimeStateList).length,
        dumpKeys: dumpCandidate ? Object.keys(dumpCandidate) : [],
      },
    };
  })()`;
}
