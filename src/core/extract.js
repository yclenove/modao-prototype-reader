import { DEFAULT_POLL_MS } from './constants.js';
import { ModaoReaderError } from './errors.js';
import { sleep } from './utils.js';

function isProtoSharingModaoUrl(href) {
  if (!href || typeof href !== 'string') return false;
  try {
    const u = new URL(href);
    if (!/modao\.cc$/i.test(u.hostname)) return false;
    return /\/proto\/[^/]+\/sharing\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function createProbeSummary(probe) {
  const hasProjectMetaEffective = Boolean(
    probe.hasProjectMetaEffective ?? probe.hasProjectMeta,
  );
  const hasRootProjectEffective = Boolean(
    probe.hasRootProjectEffective ?? probe.hasRootProject,
  );
  const effectiveDumpStateCount = Math.max(
    probe.dumpStateContainerCount ?? 0,
    probe.dumpDeepRuntimeCount ?? 0,
    probe.liveDeepRuntimeCount ?? 0,
  );
  const matchedSignals = [
    probe.hasMb ? 'mb' : null,
    probe.hasProjectExchange ? 'projectExchange' : null,
    probe.hasProjectStoreViaCurrent ? 'projectStoreViaCurrent' : null,
    hasRootProjectEffective ? 'rootProject' : null,
    hasProjectMetaEffective ? 'projectMeta' : null,
    probe.hasProjectStore ? 'projectStore' : null,
    probe.hasLocalDump ? 'localDump' : null,
    probe.hasScreenMetaList ? 'screenMetaList' : null,
    probe.screenCount > 0 || probe.dumpScreenCount > 0 ? 'screens' : null,
    probe.stateContainerCount > 0 || effectiveDumpStateCount > 0 ? 'runtimeStates' : null,
  ].filter(Boolean);

  let stage = 'booting';
  if (!probe.hasMb && !probe.hasProjectExchange) {
    stage = 'runtime_missing';
  } else if (
    probe.hasLocalDump &&
    probe.dumpScreenCount > 0 &&
    effectiveDumpStateCount > 0 &&
    (!probe.hasProjectStore || probe.stateContainerCount <= 0)
  ) {
    stage = 'dump_fallback_ready';
  } else if (
    isProtoSharingModaoUrl(probe.href) &&
    probe.hasMb &&
    hasRootProjectEffective &&
    Boolean(probe.currentScreenCid)
  ) {
    stage = 'proto_sharing_ready';
  } else if (probe.hasMb && !hasProjectMetaEffective && !probe.hasProjectExchange) {
    stage = 'runtime_shell_only';
  } else if (!hasRootProjectEffective || !hasProjectMetaEffective) {
    stage = 'project_loading';
  } else if (!probe.hasProjectStore && probe.hasProjectStoreViaCurrent) {
    stage = 'store_fallback_only';
  } else if (!probe.hasProjectStore) {
    stage = 'store_unavailable';
  } else if (!probe.hasScreenMetaList && probe.screenCount <= 0) {
    stage = 'screen_list_missing';
  } else if (probe.screenCount <= 0) {
    stage = 'screens_unavailable';
  } else if (probe.stateContainerCount <= 0 && effectiveDumpStateCount <= 0) {
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
    screenCount: Math.max(probe.screenCount, probe.dumpScreenCount ?? 0),
    stateContainerCount: Math.max(probe.stateContainerCount, effectiveDumpStateCount),
  };
}

export async function waitForPrototype(client, timeoutMs, options = {}) {
  const deadline = Date.now() + timeoutMs;
  const probes = [];

  while (Date.now() < deadline) {
    const probe = await client.evaluate(`(() => {
      const state = window.MB?.webpackInterface?.store?.getState?.();
      const current = state?.container?.current || {};
      const projectStoreViaCurrent = current.projectStore || null;
      const localDumpList = window.ProjectExchange?.generateLocalDump?.() || [];
      const normalizeArray = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') return Object.values(value);
        return [];
      };
      const pickFirstArray = (source, keys) => {
        if (!source || typeof source !== 'object') return [];
        for (const key of keys) {
          const value = source[key];
          if (Array.isArray(value) && value.length) return value;
        }
        return [];
      };
      const findRuntimeContainersDeep = (root) => {
        const found = [];
        const seen = new WeakSet();
        const walk = (node, depth) => {
          if (depth > 18 || node == null || typeof node !== 'object') return;
          if (seen.has(node)) return;
          seen.add(node);
          if (
            !Array.isArray(node) &&
            node.dataMap &&
            typeof node.dataMap === 'object' &&
            node.itemListMap &&
            typeof node.itemListMap === 'object'
          ) {
            found.push(node);
            return;
          }
          if (Array.isArray(node)) {
            for (const item of node) walk(item, depth + 1);
            return;
          }
          const keys = Object.keys(node);
          for (let i = 0; i < keys.length && i < 120; i += 1) {
            const k = keys[i];
            if (k === 'parent' || k === '__proto__') continue;
            try {
              walk(node[k], depth + 1);
            } catch (e) {}
          }
        };
        walk(root, 0);
        return found;
      };
      const upperCidFromCurrent = current.projectMeta?.upper_cid || null;
      const dumpCandidate =
        normalizeArray(localDumpList).find((item) => {
          return item?.projectMetaCid === current.projectMeta?.cid || item?.upperCid === upperCidFromCurrent;
        }) ||
        normalizeArray(localDumpList).find((item) => {
          return pickFirstArray(item, ['screenMetaList', 'localScreenMetaList', 'originalScreenMetaList', 'screens']).length > 0;
        }) ||
        normalizeArray(localDumpList)[0] ||
        null;
      const peekDumpMeta =
        dumpCandidate && (dumpCandidate.projectMeta || dumpCandidate.meta || dumpCandidate.project);
      const hasProjectMetaEffective = Boolean(
        current.projectMeta ||
          window.MB?.currentProjectMeta ||
          (peekDumpMeta &&
            typeof peekDumpMeta === 'object' &&
            (peekDumpMeta.cid || peekDumpMeta.title || peekDumpMeta.name)),
      );
      const hasRootProjectEffective = Boolean(
        current.rootProject ||
          window.MB?.currentProject ||
          dumpCandidate?.rootProject ||
          (dumpCandidate?.project && typeof dumpCandidate.project === 'object'),
      );
      const effectiveUpperCid =
        upperCidFromCurrent || peekDumpMeta?.upper_cid || dumpCandidate?.upperCid || null;
      const dumpScreenMetaList = pickFirstArray(dumpCandidate, [
        'screenMetaList',
        'localScreenMetaList',
        'originalScreenMetaList',
        'screens',
      ]);
      const dumpRuntimeStateList = pickFirstArray(dumpCandidate, [
        'runtimeStateList',
        'localScreenRuntimeStateList',
        'screenRuntimeStateList',
        'runtimeStates',
      ]);
      const dumpDeepRuntime = dumpCandidate ? findRuntimeContainersDeep(dumpCandidate) : [];
      const dumpDeepRuntimeCount = dumpDeepRuntime.length;
      const runtimeStateList = effectiveUpperCid
        ? window.ProjectExchange?.getLocalScreenRuntimeStateListByUpperCid?.(effectiveUpperCid)
        : null;
      const hasRootProject = Boolean(current.rootProject || window.MB?.currentProject);
      const hasMb = Boolean(window.MB);
      const hasProjectExchange = Boolean(window.ProjectExchange);
      const hasProjectMeta = Boolean(current.projectMeta || window.MB?.currentProjectMeta);
      const hasScreenMetaList = Array.isArray(current.screenMetaList) || Array.isArray(current.originalScreenMetaList);
      const hasProjectStore = Boolean(
        effectiveUpperCid ? window.ProjectExchange?.getProjectStoreByUpperCid?.(effectiveUpperCid) : null,
      );
      const hasProjectStoreViaCurrent = Boolean(projectStoreViaCurrent);
      const hasLocalDump = Boolean(dumpCandidate);
      const fallbackRuntimeStateList = current.runtimeStateList || projectStoreViaCurrent?.runtimeStateList || [];
      const liveDeepFromContainer = findRuntimeContainersDeep(state?.container || {});
      const liveDeepFromCurrent = findRuntimeContainersDeep(current);
      const liveDeepFromCommon = findRuntimeContainersDeep(state?.container?.common || {});
      const liveDeepFromComment = findRuntimeContainersDeep(state?.container?.comment || {});
      const liveDeepRuntime = [
        ...new Set([
          ...liveDeepFromContainer,
          ...liveDeepFromCurrent,
          ...liveDeepFromCommon,
          ...liveDeepFromComment,
        ]),
      ];
      const liveDeepRuntimeCount = liveDeepRuntime.length;
      return {
        title: document.title,
        readyState: document.readyState,
        hasMb,
        hasProjectExchange,
        hasRootProject,
        hasProjectMeta,
        hasRootProjectEffective,
        hasProjectMetaEffective,
        hasProjectStore,
        hasProjectStoreViaCurrent,
        hasLocalDump,
        hasScreenMetaList,
        screenCount: current.screenMetaList?.length || current.originalScreenMetaList?.length || 0,
        stateContainerCount: runtimeStateList?.length || fallbackRuntimeStateList?.length || 0,
        dumpScreenCount: dumpScreenMetaList.length,
        dumpStateContainerCount: dumpRuntimeStateList.length,
        dumpDeepRuntimeCount,
        liveDeepRuntimeCount,
        currentScreenCid: current.screenMeta?.cid || '',
        href: location.href,
      };
    })()`);
    probes.push({
      polledAt: new Date().toISOString(),
      ...probe,
      summary: createProbeSummary(probe),
    });

    const hasProjectMetaForReady = Boolean(
      probe.hasProjectMetaEffective ?? probe.hasProjectMeta,
    );
    const hasRootProjectForReady = Boolean(
      probe.hasRootProjectEffective ?? probe.hasRootProject,
    );

    const protoSharingReady =
      isProtoSharingModaoUrl(probe.href) &&
      probe.hasMb &&
      hasRootProjectForReady &&
      Boolean(probe.currentScreenCid);

    if (
      ((probe.screenCount > 0 &&
        probe.stateContainerCount > 0 &&
        hasRootProjectForReady &&
        hasProjectMetaForReady &&
        (probe.hasProjectStore || probe.hasProjectStoreViaCurrent)) ||
        (probe.hasLocalDump &&
          probe.dumpScreenCount > 0 &&
          Math.max(
            probe.dumpStateContainerCount || 0,
            probe.dumpDeepRuntimeCount || 0,
            probe.liveDeepRuntimeCount || 0,
          ) > 0 &&
          (hasProjectMetaForReady || probe.hasMb || probe.hasProjectExchange)) ||
        protoSharingReady)
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
    let projectMeta = current.projectMeta || window.MB?.currentProjectMeta || null;
    let rootProject = current.rootProject || window.MB?.currentProject || null;
    const screenGlue = current.screenGlue || window.MB?.currentScreenGlue || null;
    const projectShare = current.projectShare || null;
    const currentScreen = current.screenMeta || null;
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

    const pickFirstArray = (source, keys) => {
      if (!source || typeof source !== 'object') return [];
      for (const key of keys) {
        const value = source[key];
        if (Array.isArray(value) && value.length) return value;
      }
      return [];
    };

    const findRuntimeContainersDeep = (root) => {
      const found = [];
      const seen = new WeakSet();
      const walk = (node, depth) => {
        if (depth > 18 || node == null || typeof node !== 'object') return;
        if (seen.has(node)) return;
        seen.add(node);
        if (
          !Array.isArray(node) &&
          node.dataMap &&
          typeof node.dataMap === 'object' &&
          node.itemListMap &&
          typeof node.itemListMap === 'object'
        ) {
          found.push(node);
          return;
        }
        if (Array.isArray(node)) {
          for (const item of node) walk(item, depth + 1);
          return;
        }
        const keys = Object.keys(node);
        for (let i = 0; i < keys.length && i < 120; i += 1) {
          const k = keys[i];
          if (k === 'parent' || k === '__proto__') continue;
          try {
            walk(node[k], depth + 1);
          } catch (e) {}
        }
      };
      walk(root, 0);
      return found;
    };

    const upperCidHintFromMeta = projectMeta?.upper_cid ?? null;
    const dumpCandidate = normalizeArray(localDumpList).find((item) => {
      return (
        item?.projectMetaCid === projectMeta?.cid ||
        item?.upperCid === upperCidHintFromMeta ||
        item?.projectCid === rootProject?.cid
      );
    }) || normalizeArray(localDumpList).find((item) => {
      return pickFirstArray(item, ['screenMetaList', 'localScreenMetaList', 'originalScreenMetaList', 'screens']).length > 0;
    }) || normalizeArray(localDumpList)[0] || null;

    const dumpProjectMeta =
      dumpCandidate?.projectMeta ||
      dumpCandidate?.meta ||
      dumpCandidate?.project ||
      null;
    const dumpRootProject = dumpCandidate?.rootProject || dumpCandidate?.project || null;
    const dumpScreenMetaList = pickFirstArray(dumpCandidate, [
      'screenMetaList',
      'localScreenMetaList',
      'originalScreenMetaList',
      'screens',
    ]);
    const dumpRuntimeStateList = pickFirstArray(dumpCandidate, [
      'runtimeStateList',
      'localScreenRuntimeStateList',
      'screenRuntimeStateList',
      'runtimeStates',
    ]);
    const dumpScreenGlueList = pickFirstArray(dumpCandidate, [
      'localScreenGlueList',
      'screenGlueList',
      'screenGlues',
    ]);
    const dumpCurrentScreen =
      dumpCandidate?.currentScreen ||
      dumpScreenMetaList.find((item) => item?.cid === targetScreenCid) ||
      dumpScreenMetaList.find((item) => item?.cid === dumpCandidate?.currentScreenCid) ||
      null;

    projectMeta = projectMeta || dumpProjectMeta;
    rootProject = rootProject || dumpRootProject;
    const upperCid = projectMeta?.upper_cid || dumpCandidate?.upperCid || null;
    const projectStore =
      (upperCid ? window.ProjectExchange?.getProjectStoreByUpperCid?.(upperCid) : null) ||
      current.projectStore ||
      null;

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

    const localScreenMetaList =
      projectStore?.getLocalScreenMetaList?.() ||
      current.screenMetaList ||
      current.originalScreenMetaList ||
      dumpScreenMetaList ||
      [];
    const visibleScreenMetaList = current.screenMetaList || dumpScreenMetaList || [];
    const originalScreenMetaList =
      current.originalScreenMetaList ||
      localScreenMetaList ||
      dumpScreenMetaList ||
      [];
    const localScreenGlueList =
      projectStore?.getLocalScreenGlueList?.() ||
      current.projectStore?.getLocalScreenGlueList?.() ||
      dumpScreenGlueList ||
      [];
    const baseRuntimeStateList =
      projectStore?.getLocalScreenRuntimeStateList?.() ||
      current.runtimeStateList ||
      current.projectStore?.runtimeStateList ||
      (upperCid ? window.ProjectExchange?.getLocalScreenRuntimeStateListByUpperCid?.(upperCid) : []) ||
      dumpRuntimeStateList ||
      [];
    const deepRuntimeContainers = dumpCandidate ? findRuntimeContainersDeep(dumpCandidate) : [];
    const liveDeepRuntimeContainers = [
      ...findRuntimeContainersDeep(state?.container || {}),
      ...findRuntimeContainersDeep(current),
      ...findRuntimeContainersDeep(common),
      ...findRuntimeContainersDeep(comment),
    ];
    const mergedRuntimeStateList = normalizeArray(baseRuntimeStateList).slice();
    const mergedRuntimeSeen = new Set(mergedRuntimeStateList);
    const pushRuntimeContainer = (container) => {
      if (container && typeof container === 'object' && !mergedRuntimeSeen.has(container)) {
        mergedRuntimeStateList.push(container);
        mergedRuntimeSeen.add(container);
      }
    };
    for (const container of deepRuntimeContainers) pushRuntimeContainer(container);
    for (const container of liveDeepRuntimeContainers) pushRuntimeContainer(container);

    const states = [];
    const widgets = [];
    for (const screenStateContainer of mergedRuntimeStateList) {
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
    const sourceProjectMeta = normalizePrimitive(projectMeta || dumpProjectMeta);
    const sourceRootProject = normalizePrimitive(rootProject || dumpRootProject);
    const screenGlueSafe = normalizePrimitive(screenGlue);
    const currentScreenSafe =
      screens.find((screen) => screen.cid === currentScreen?.cid) ||
      screens.find((screen) => screen.cid === targetScreenCid) ||
      screens.find((screen) => screen.cid === dumpCurrentScreen?.cid) ||
      normalizeArray(originalScreenMetaList).map(pickScreen).find((screen) => screen.cid === targetScreenCid) ||
      null;

    return {
      title: document.title,
      href: location.href,
      visibleText: (document.body?.innerText || '').trim(),
      rootProject: sourceRootProject,
      projectMeta: (projectMeta || dumpProjectMeta)
        ? {
            cid: (projectMeta || dumpProjectMeta).cid ?? null,
            title: (projectMeta || dumpProjectMeta).title ?? (projectMeta || dumpProjectMeta).name ?? document.title,
            name: (projectMeta || dumpProjectMeta).name ?? null,
            width: (projectMeta || dumpProjectMeta).width ?? null,
            height: (projectMeta || dumpProjectMeta).height ?? null,
            upper_cid: (projectMeta || dumpProjectMeta).upper_cid ?? null,
            upper_type: (projectMeta || dumpProjectMeta).upper_type ?? null,
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
        extractionMode:
          mergedRuntimeStateList.length > 0 && normalizeArray(localScreenMetaList).length > 0
            ? 'runtime'
            : dumpCandidate
              ? 'dump_fallback'
              : 'runtime_partial',
        deepRuntimeContainerCount: deepRuntimeContainers.length,
        storeKeys: Object.keys(state || {}),
        currentKeys: Object.keys(current || {}),
        modelKeys: Object.keys(state.model || {}),
        mbKeys: Object.keys(window.MB || {}).slice(0, 80),
        projectExchangeKeys: Object.keys(window.ProjectExchange || {}).slice(0, 80),
        localScreenMetaCount: normalizeArray(localScreenMetaList).length,
        visibleScreenCount: screens.length,
        originalScreenCount: originalScreens.length,
        localScreenGlueCount: normalizeArray(localScreenGlueList).length,
        runtimeStateContainerCount: mergedRuntimeStateList.length,
        dumpKeys: dumpCandidate ? Object.keys(dumpCandidate) : [],
      },
    };
  })()`;
}
