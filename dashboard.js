/* AI 对话导出助手 — 工作台逻辑 */
(function () {
  "use strict";

  const core = globalThis.AIExportCore;
  const $ = (selector) => document.querySelector(selector);

  const els = {
    sourceArea: $("#sourceArea"),
    refreshTabs: $("#refreshTabs"),
    workspace: $("#workspace"),
    listMeta: $("#listMeta"),
    listIdle: $("#listIdle"),
    listLoading: $("#listLoading"),
    listError: $("#listError"),
    listErrorTitle: $("#listErrorTitle"),
    listErrorMessage: $("#listErrorMessage"),
    listErrorHint: $("#listErrorHint"),
    retryList: $("#retryList"),
    openSiteFromError: $("#openSiteFromError"),
    loadingHint: $("#loadingHint"),
    listContent: $("#listContent"),
    searchInput: $("#searchInput"),
    filterChips: Array.from(document.querySelectorAll(".chip[data-filter]")),
    selectAll: $("#selectAll"),
    selectAllText: $("#selectAllText"),
    selectionInfo: $("#selectionInfo"),
    loadedInfo: $("#loadedInfo"),
    warnings: $("#warnings"),
    conversationList: $("#conversationList"),
    loadMore: $("#loadMore"),
    modeGrid: $("#modeGrid"),
    formatGrid: $("#formatGrid"),
    optThinking: $("#optThinking"),
    optDate: $("#optDate"),
    optBom: $("#optBom"),
    exportSummary: $("#exportSummary"),
    exportBtn: $("#exportBtn"),
    exportBtnText: $("#exportBtnText"),
    exportProgress: $("#exportProgress"),
    progressLabel: $("#progressLabel"),
    progressPct: $("#progressPct"),
    progressBar: $("#progressBar"),
    progressDetail: $("#progressDetail"),
    cancelExport: $("#cancelExport"),
    exportResult: $("#exportResult"),
    toastHost: $("#toastHost"),
    confirmDialog: $("#confirmDialog"),
    confirmTitle: $("#confirmTitle"),
    confirmMessage: $("#confirmMessage"),
    versionLabel: $("#versionLabel")
  };

  const PACKAGE_INFO = {
    single: {
      label: "单个文件",
      desc: "所有选中对话合并成 1 个文件，适合直接阅读或整体检索。",
      files: 1
    },
    multi: {
      label: "多个文件",
      desc: "每条对话生成 1 个文件，放进同一个下载文件夹。",
      files: null
    },
    zip_single: {
      label: "单个 ZIP",
      desc: "每条对话一个文件，全部打包进 1 个 ZIP，适合备份。",
      files: 1
    },
    zip_multi: {
      label: "多个 ZIP",
      desc: "每条对话单独打包成 1 个 ZIP，适合分卷归档。",
      files: null
    }
  };

  const DEFAULT_SETTINGS = {
    format: "txt",
    package: "zip_single",
    includeThinking: false,
    includeDate: true,
    withBom: true
  };

  function migrateSettings(saved) {
    const next = Object.assign({}, DEFAULT_SETTINGS, saved || {});
    if (!saved || !saved.package) {
      const old = saved && saved.mode;
      if (old === "txt_single") { next.format = "txt"; next.package = "single"; }
      else if (old === "txt_multi") { next.format = "txt"; next.package = "multi"; }
      else if (old === "zip_multi") { next.package = "zip_multi"; }
      else if (old === "zip_single") { next.package = "zip_single"; }
    }
    delete next.mode;
    if (!core.FORMATS[next.format]) next.format = "txt";
    if (!PACKAGE_INFO[next.package]) next.package = "zip_single";
    return next;
  }

  const state = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    tabs: [],
    selectedTabId: null,
    tab: null,
    siteId: "",
    tabStatus: {},
    conversations: [],
    selected: new Set(),
    filter: "all",
    search: "",
    currentId: "",
    warnings: [],
    listLoaded: false,
    listLoading: false,
    listError: null,
    renderLimit: 120,
    exporting: false,
    cancelRequested: false,
    exportController: null,
    failedMetas: [],
    conversationCache: new Map(),
    lastTabRefresh: 0,
    lastResult: null
  };

  let listRequestSeq = 0;
  let sourceRequestSeq = 0;
  let searchTimer = null;
  let settingsTimer = null;

  function init() {
    els.versionLabel.textContent = "v" + core.VERSION;
    bindEvents();
    loadSettings().then(() => {
      syncSettingsUI();
      updateExportPanel();
    });
    renderSource();
    renderList();
    updateExportPanel();
    refreshTabs({ autoSelect: true }).catch((error) => {
      showToast("无法读取浏览器标签页：" + String(error && error.message || error), "error");
    });
    setupDebugTools();
  }

  /* ---------------- 设置 ---------------- */

  async function loadSettings() {
    try {
      if (!chrome.storage || !chrome.storage.local) return;
      const data = await chrome.storage.local.get("aiexport_settings");
      const saved = data && data.aiexport_settings;
      if (saved && typeof saved === "object") {
        state.settings = migrateSettings(saved);
      }
    } catch (e) { /* 默认值 */ }
  }

  function saveSettings() {
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => {
      try {
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ aiexport_settings: state.settings });
        }
      } catch (e) { /* ignore */ }
    }, 180);
  }

  function syncSettingsUI() {
    for (const input of els.formatGrid.querySelectorAll("input[name=exportFormat]")) {
      input.checked = input.value === state.settings.format;
    }
    for (const input of els.modeGrid.querySelectorAll("input[name=exportMode]")) {
      input.checked = input.value === state.settings.package;
    }
    els.optThinking.checked = !!state.settings.includeThinking;
    els.optDate.checked = !!state.settings.includeDate;
    els.optBom.checked = !!state.settings.withBom;
  }

  function setSettingsFromUI() {
    const format = els.formatGrid.querySelector("input[name=exportFormat]:checked");
    const pkg = els.modeGrid.querySelector("input[name=exportMode]:checked");
    if (format) state.settings.format = format.value;
    if (pkg) state.settings.package = pkg.value;
    state.settings.includeThinking = els.optThinking.checked;
    state.settings.includeDate = els.optDate.checked;
    state.settings.withBom = els.optBom.checked;
    saveSettings();
    updateExportPanel();
  }

  /* ---------------- 标签页与来源 ---------------- */

  async function refreshTabs(options) {
    const opts = options || {};
    if (state.exporting) return;
    let tabs = [];
    try {
      tabs = await chrome.tabs.query({});
    } catch (error) {
      throw error;
    }
    tabs = tabs
      .filter((tab) => tab && tab.url && core.siteFromUrl(tab.url))
      .sort((a, b) => {
        if (a.id === state.selectedTabId) return -1;
        if (b.id === state.selectedTabId) return 1;
        const la = a.lastAccessed || 0;
        const lb = b.lastAccessed || 0;
        if (la !== lb) return lb - la;
        return (b.active ? 1 : 0) - (a.active ? 1 : 0);
      });
    state.tabs = tabs;
    state.lastTabRefresh = Date.now();

    if (!tabs.length) {
      listRequestSeq++;
      state.selectedTabId = null;
      state.tab = null;
      state.siteId = "";
      state.conversations = [];
      state.selected.clear();
      state.currentId = "";
      state.warnings = [];
      state.listLoaded = false;
      state.listLoading = false;
      state.listError = null;
      state.conversationCache.clear();
      setListMode("idle");
      renderSource();
      renderList();
      updateExportPanel();
      return;
    }

    const queryTabId = Number(new URLSearchParams(location.search).get("tabId"));
    let nextId = state.selectedTabId;
    if (!nextId || !tabs.some((tab) => tab.id === nextId)) {
      if (queryTabId && tabs.some((tab) => tab.id === queryTabId)) nextId = queryTabId;
      else nextId = tabs[0].id;
    }
    const mustLoad = opts.autoSelect === true || opts.reload === true ||
      (nextId !== state.selectedTabId) || (!state.listLoaded && !state.listLoading);
    if (mustLoad) {
      await selectTab(nextId, { load: true, manual: opts.manual === true });
    } else {
      renderSource();
    }
  }

  async function selectTab(tabId, options) {
    const opts = options || {};
    if (state.exporting) {
      showToast("导出进行中，暂时不能切换来源。", "warn");
      return;
    }
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;
    const site = core.siteFromUrl(tab.url);
    if (!site) return;

    listRequestSeq++;
    state.selectedTabId = tabId;
    state.tab = tab;
    state.siteId = site.id;
    state.conversations = [];
    state.selected.clear();
    state.currentId = "";
    state.warnings = [];
    state.listLoaded = false;
    state.listError = null;
    state.renderLimit = 120;
    state.filter = "all";
    state.search = "";
    state.conversationCache.clear();
    if (els.searchInput) els.searchInput.value = "";
    renderSource();
    renderList();
    updateExportPanel();
    if (opts.load !== false) {
      await loadConversations();
    }
  }

  async function loadConversations() {
    if (!state.selectedTabId || state.exporting) return;
    const token = ++listRequestSeq;
    const tabId = state.selectedTabId;
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) {
      showListError(new core.AIExportError("TAB_CLOSED", "来源标签页已经关闭", "请重新打开 AI 网页，然后点击右上角刷新。"));
      return;
    }
    state.listLoading = true;
    state.listError = null;
    state.listLoaded = false;
    state.warnings = [];
    els.listMeta.textContent = "";
    els.loadingHint.textContent = "正在连接页面，请稍候…";
    setListMode("loading");
    updateExportPanel();

    try {
      const ping = await ensureContentScript(tabId, token);
      if (token !== listRequestSeq) return;
      if (!ping || !ping.ok || !ping.supported) {
        throw new core.AIExportError(
          "UNSUPPORTED",
          "当前标签页没有可读取的 AI 页面",
          "请在 Chrome / Edge 中打开 Kimi 或 DeepSeek 的网页版，并确认已经登录。"
        );
      }
      state.tabStatus[tabId] = Object.assign({}, state.tabStatus[tabId], ping, { errorCode: "" });
      renderSource();
      els.loadingHint.textContent = ping.hasToken
        ? "已检测到登录状态，正在读取全部历史对话…"
        : "正在尝试读取历史对话，如果失败请刷新原网页重新登录…";

      const response = await withTimeout(
        sendTab(tabId, { source: "aiexport", type: "AIEXPORT_LIST" }),
        240000,
        "读取历史对话超时。账号历史很多时可能需要更久，请稍后重试或分批处理。"
      );
      if (token !== listRequestSeq) return;
      if (!response) throw new core.AIExportError("NO_RESPONSE", "页面没有返回数据", "请刷新原网页后重试。");
      if (response.ok === false) throw errorFromPayload(response.error);

      const site = core.siteById(response.site || (core.siteFromUrl(tab.url) || {}).id || state.siteId);
      if (!site) throw new core.AIExportError("UNSUPPORTED", "无法识别这个网站", "");
      state.siteId = site.id;
      state.currentId = response.currentId || (site.currentId ? site.currentId(tab.url) : "");
      const beforeSelected = new Set(state.selected);
      state.conversations = (Array.isArray(response.conversations) ? response.conversations : [])
        .map((item) => normalizeConversationMeta(item, site, state.currentId))
        .filter((item) => item && item.id);
      state.conversations.sort(compareConversations);
      state.selected = new Set(state.conversations.filter((c) => beforeSelected.has(c.id)).map((c) => c.id));
      state.warnings = Array.isArray(response.warnings) ? response.warnings.filter(Boolean) : [];
      state.listLoaded = true;
      state.listLoading = false;
      state.listError = null;
      state.conversationCache.clear();
      state.renderLimit = 120;
      state.tabStatus[tabId] = Object.assign({}, state.tabStatus[tabId], {
        connected: true,
        hasToken: !!ping.hasToken,
        errorCode: "",
        lastLoadedAt: Date.now()
      });
      setListMode("content");
      renderSource();
      renderList();
      updateExportPanel();
      if (state.conversations.length) {
        showToast("已读取 " + state.conversations.length + " 条历史对话", "success");
      }
    } catch (error) {
      if (token !== listRequestSeq) return;
      if (error && error.code === "ABORTED") return;
      const safeError = error instanceof core.AIExportError
        ? error
        : new core.AIExportError("UNKNOWN", String(error && error.message || error), "请刷新原网页后重试。");
      state.listLoading = false;
      state.listLoaded = false;
      if (state.tabStatus[tabId]) {
        state.tabStatus[tabId].connected = false;
        state.tabStatus[tabId].errorCode = safeError.code || "ERROR";
        if (safeError.code === "AUTH") state.tabStatus[tabId].hasToken = false;
      }
      showListError(safeError);
      renderSource();
    }
  }

  function normalizeConversationMeta(raw, site, currentId) {
    if (!raw || raw.id === undefined || raw.id === null) return null;
    const id = String(raw.id);
    const fallbackSite = site || core.siteById(raw.site) || null;
    return {
      id,
      site: (fallbackSite && fallbackSite.id) || raw.site || state.siteId,
      title: String(raw.title || "").trim() || "未命名对话",
      updatedAt: Number(raw.updatedAt) || null,
      createdAt: Number(raw.createdAt) || null,
      pinned: !!raw.pinned,
      current: !!raw.current || id === currentId,
      placeholder: !!raw.placeholder,
      snippet: typeof raw.snippet === "string" ? raw.snippet : "",
      dom: !!raw.dom,
      url: raw.url || (fallbackSite && fallbackSite.conversationUrl ? fallbackSite.conversationUrl(id) : "")
    };
  }

  function compareConversations(a, b) {
    if (!!a.current !== !!b.current) return a.current ? -1 : 1;
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  }

  async function ensureContentScript(tabId, token) {
    const pingMessage = { source: "aiexport", type: "AIEXPORT_PING" };
    try {
      const ping = await sendTab(tabId, pingMessage);
      if (ping && ping.ok) return ping;
    } catch (e) { /* 还没注入，尝试主动注入 */ }
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["lib/core.js", "content.js"]
      });
    } catch (error) {
      throw new core.AIExportError(
        "INJECT",
        "无法在这个页面读取内容",
        "请确认这是一个普通的 AI 网页标签页，并刷新页面后再试。浏览器内部页面无法读取。",
        String(error && error.message || error)
      );
    }
    try {
      const ping = await withTimeout(sendTab(tabId, pingMessage), 15000, "页面脚本没有响应，请刷新原网页后重试。");
      if (ping && ping.ok) return ping;
      throw new core.AIExportError("NO_RESPONSE", "页面脚本没有响应", "请刷新原网页后重试。");
    } catch (error) {
      throw new core.AIExportError(
        "INJECT",
        "读取脚本没有响应",
        "请刷新原网页后再点击重试。刚安装扩展时，之前打开的网页通常需要刷新一次。",
        String(error && error.message || error)
      );
    }
  }

  function renderSource() {
    els.sourceArea.textContent = "";
    if (!state.tabs.length) {
      const empty = document.createElement("div");
      empty.className = "source-empty";
      const copy = document.createElement("div");
      copy.className = "source-empty-copy";
      const icon = document.createElement("span");
      icon.className = "source-empty-icon";
      icon.textContent = "+";
      const text = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = "还没有检测到已打开的 AI 网页";
      const desc = document.createElement("p");
      desc.textContent = "在新标签页打开并登录任意受支持的 AI 网站，再回到这里点刷新。刚安装扩展时，已打开的网页需要刷新一次。";
      text.append(title, desc);
      copy.append(icon, text);
      const actions = document.createElement("div");
      actions.className = "source-empty-actions";
      appendOpenSiteButtons(actions);
      empty.append(copy, actions);
      els.sourceArea.append(empty);
      updateSourceErrorAction();
      return;
    }

    const list = document.createElement("div");
    list.className = "source-list";
    for (const tab of state.tabs) {
      const site = core.siteFromUrl(tab.url);
      if (!site) continue;
      const status = state.tabStatus[tab.id] || {};
      const selected = tab.id === state.selectedTabId;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "source-card" + (selected ? " active" : "");
      button.dataset.tabId = String(tab.id);
      button.disabled = state.exporting;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.title = tab.title || site.name;

      const mark = document.createElement("span");
      mark.className = "site-mark";
      mark.style.setProperty("--mark-color", site.color || "#1d6b57");
      mark.textContent = site.mark || site.name.charAt(0);
      const copy = document.createElement("span");
      copy.className = "source-copy";
      const name = document.createElement("b");
      name.append(document.createTextNode(site.name));
      if (site.support === "experimental") {
        const tag = document.createElement("span");
        tag.className = "experimental-tag";
        tag.textContent = "实验";
        name.append(tag);
      } else if (site.support === "current") {
        const tag = document.createElement("span");
        tag.className = "experimental-tag current-only";
        tag.textContent = "当前页";
        name.append(tag);
      }
      const pageTitle = document.createElement("small");
      pageTitle.textContent = tab.title || site.description || "";
      copy.append(name, pageTitle);

      const statusEl = document.createElement("span");
      const statusInfo = sourceStatus(status, selected);
      statusEl.className = "source-state " + statusInfo.className;
      const dot = document.createElement("i");
      statusEl.append(dot, document.createTextNode(statusInfo.label));

      button.append(mark, copy, statusEl);
      list.append(button);
    }
    els.sourceArea.append(list);

    const quick = document.createElement("div");
    quick.className = "source-quick";
    const quickLabel = document.createElement("span");
    quickLabel.textContent = "没有看到目标网页？";
    quick.append(quickLabel);
    appendOpenSiteButtons(quick);
    els.sourceArea.append(quick);
    updateSourceErrorAction();
  }

  function sourceStatus(status, selected) {
    if (state.exporting && selected) return { label: "导出中", className: "warn" };
    if (status.errorCode === "AUTH") return { label: "需重新登录", className: "error" };
    if (status.errorCode) return { label: "读取失败", className: "error" };
    if (status.connected) return { label: "已连接", className: "ok" };
    if (status.dom) return { label: "当前页", className: "" };
    if (status.hasToken === false) return { label: "待登录", className: "warn" };
    if (status.hasToken === true) return { label: "已检测登录", className: "ok" };
    return { label: "已打开", className: "" };
  }

  function appendOpenSiteButtons(container) {
    const order = ["kimi", "deepseek", "chatgpt", "claude", "qwen", "doubao", "gemini", "grok", "wenxin", "hunyuan"];
    for (const id of order) {
      const site = core.siteById(id);
      if (site) container.append(makeOpenSiteButton(id, site.name));
    }
  }

  function makeOpenSiteButton(siteId, label) {
    const screenshotSite = core.siteById(siteId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button ghost";
    button.dataset.openSite = siteId;
    button.textContent = label;
    button.title = screenshotSite ? "打开 " + screenshotSite.name : label;
    return button;
  }

  async function openSite(siteId) {
    const site = core.siteById(siteId);
    if (!site) return;
    const existing = state.tabs.find((tab) => {
      const tabSite = core.siteFromUrl(tab.url);
      return tabSite && tabSite.id === siteId;
    });
    if (existing) {
      try {
        await chrome.tabs.update(existing.id, { active: true });
        if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
        return;
      } catch (e) { /* fall through to create */ }
    }
    await chrome.tabs.create({ url: site.loginUrl, active: true });
  }

  function updateSourceErrorAction() {
    if (!els.openSiteFromError) return;
    const site = core.siteById(state.siteId);
    els.openSiteFromError.textContent = site ? "打开 " + site.name : "打开网站";
    els.openSiteFromError.hidden = !site;
  }

  /* ---------------- 列表渲染 ---------------- */

  function setListMode(mode) {
    els.listIdle.hidden = mode !== "idle";
    els.listLoading.hidden = mode !== "loading";
    els.listError.hidden = mode !== "error";
    els.listContent.hidden = mode !== "content";
    els.workspace.setAttribute("aria-busy", mode === "loading" ? "true" : "false");
  }

  function showListError(error) {
    state.listError = error;
    els.listErrorTitle.textContent = errorTitle(error);
    els.listErrorMessage.textContent = error.message || "未知错误";
    const hint = error.hint || defaultHint(error);
    els.listErrorHint.textContent = hint;
    els.listErrorHint.hidden = !hint;
    setListMode("error");
    updateExportPanel();
    updateSourceErrorAction();
  }

  function errorTitle(error) {
    switch (error.code) {
      case "AUTH": return "需要重新登录";
      case "RATE_LIMIT": return "网站暂时限流";
      case "API_CHANGED": return "网站接口有了变化";
      case "INJECT": return "无法读取这个页面";
      case "TAB_CLOSED": return "来源标签页已关闭";
      case "TIMEOUT": return "读取超时";
      case "UNSUPPORTED": return "这个页面暂不支持";
      default: return "没能读取历史对话";
    }
  }

  function defaultHint(error) {
    if (error.code === "AUTH") return "打开原网站确认登录状态，刷新页面后再回来重试。";
    if (error.code === "API_CHANGED") return "可能需要更新扩展版本。你的原始对话仍保存在网站上，不会丢失。";
    return "请刷新原网页后再试。若问题持续出现，可以查看使用说明。";
  }

  function renderList() {
    if (!state.listLoaded) {
      if (!state.listLoading && !state.listError) setListMode("idle");
      return;
    }
    if (state.listError) return;
    setListMode("content");
    renderWarnings();
    if (!state.conversations.length) {
      els.listMeta.textContent = siteName() + " · 0 条";
      els.conversationList.textContent = "";
      const empty = document.createElement("div");
      empty.className = "no-results";
      const b = document.createElement("b");
      b.textContent = "账号里还没有历史对话";
      const p = document.createElement("span");
      p.textContent = "先和 AI 聊上几句，或确认登录的是正确的账号。";
      empty.append(b, p);
      els.conversationList.append(empty);
      els.selectAll.checked = false;
      els.selectAll.indeterminate = false;
      els.selectAll.disabled = true;
      els.selectionInfo.textContent = "已选 0 条";
      els.loadedInfo.textContent = "";
      els.loadMore.hidden = true;
      updateExportPanel();
      return;
    }

    const visible = getVisibleConversations();
    const selectedVisible = visible.filter((item) => state.selected.has(item.id));
    const allSelected = visible.length > 0 && selectedVisible.length === visible.length;
    els.selectAll.checked = allSelected;
    els.selectAll.indeterminate = selectedVisible.length > 0 && !allSelected;
    els.selectAll.disabled = visible.length === 0;
    els.selectAllText.textContent = state.filter === "all" ? "全选" : "全选筛选结果";
    els.selectionInfo.textContent = "已选 " + state.selected.size + " 条";
    els.listMeta.textContent = siteName() + " · " + state.conversations.length + " 条";

    const show = visible.slice(0, state.renderLimit);
    els.loadedInfo.textContent = visible.length
      ? (visible.length > show.length ? "显示 " + show.length + " / " + visible.length + " 条" : "共 " + visible.length + " 条")
      : "没有匹配结果";

    els.conversationList.textContent = "";
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "no-results";
      const b = document.createElement("b");
      b.textContent = state.filter === "selected" ? "还没有选中对话" : "没有找到匹配的对话";
      const p = document.createElement("span");
      p.textContent = state.filter === "selected" ? "在全部列表里勾选几条，它们会出现在这里。" : "换个关键词，或切换到「全部」看看。";
      empty.append(b, p);
      els.conversationList.append(empty);
      els.loadMore.hidden = true;
      updateExportPanel();
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const conversation of show) {
      fragment.append(buildConversationRow(conversation));
    }
    els.conversationList.append(fragment);
    els.loadMore.hidden = show.length >= visible.length;
    if (!els.loadMore.hidden) {
      els.loadMore.textContent = "显示更多对话（还有 " + (visible.length - show.length) + " 条）";
    }
    updateExportPanel();
  }

  function renderWarnings() {
    els.warnings.textContent = "";
    if (!state.warnings.length) return;
    for (const text of state.warnings) {
      const item = document.createElement("div");
      item.className = "warning-item";
      item.textContent = text;
      els.warnings.append(item);
    }
  }

  function buildConversationRow(conversation) {
    const selected = state.selected.has(conversation.id);
    const row = document.createElement("div");
    row.className = "conversation-row" + (selected ? " selected" : "");
    row.dataset.id = conversation.id;
    row.setAttribute("role", "listitem");
    row.setAttribute("aria-selected", selected ? "true" : "false");
    row.tabIndex = 0;

    const checkLabel = document.createElement("label");
    checkLabel.className = "check-label row-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selected;
    input.dataset.id = conversation.id;
    input.setAttribute("aria-label", "选择对话：" + conversation.title);
    const box = document.createElement("span");
    box.className = "custom-check";
    box.setAttribute("aria-hidden", "true");
    checkLabel.append(input, box);

    const main = document.createElement("div");
    main.className = "row-main";
    const titleLine = document.createElement("div");
    titleLine.className = "row-title";
    const title = document.createElement("span");
    title.className = "row-title-text";
    title.textContent = conversation.title;
    title.title = conversation.title;
    const tags = document.createElement("span");
    tags.className = "row-tags";
    if (conversation.current) tags.append(makeTag("当前", "current"));
    if (conversation.pinned) tags.append(makeTag("置顶", "pinned"));
    titleLine.append(title, tags);
    const sub = document.createElement("div");
    sub.className = "row-sub";
    const date = document.createElement("span");
    date.className = "row-date";
    date.textContent = friendlyDate(conversation.updatedAt);
    const snippet = document.createElement("span");
    snippet.className = "row-snippet";
    snippet.textContent = conversation.snippet || "";
    sub.append(date, snippet);
    main.append(titleLine, sub);

    const actions = document.createElement("div");
    actions.className = "row-actions";
    const download = document.createElement("button");
    download.type = "button";
    download.className = "row-download";
    download.dataset.action = "export-one";
    download.dataset.id = conversation.id;
    download.title = "只导出这条对话";
    download.setAttribute("aria-label", "只导出《" + conversation.title + "》");
    download.disabled = state.exporting;
    download.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16.5v2A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    actions.append(download);

    row.append(checkLabel, main, actions);
    return row;
  }

  function makeTag(text, className) {
    const tag = document.createElement("span");
    tag.className = "tag " + className;
    tag.textContent = text;
    return tag;
  }

  function friendlyDate(value) {
    const ms = Number(value);
    if (!ms) return "日期未知";
    const d = new Date(ms);
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (sameDay) return "今天 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) {
      return "昨天";
    }
    if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + "月" + d.getDate() + "日";
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function siteName() {
    const site = core.siteById(state.siteId);
    return site ? site.name : "AI";
  }

  function getVisibleConversations() {
    const query = state.search.trim().toLowerCase();
    return state.conversations.filter((conversation) => {
      if (state.filter === "pinned" && !conversation.pinned) return false;
      if (state.filter === "current" && !conversation.current) return false;
      if (state.filter === "selected" && !state.selected.has(conversation.id)) return false;
      if (query) {
        const haystack = [conversation.title, conversation.snippet, conversation.id].join("\n").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function getSelectedConversations() {
    return state.conversations.filter((conversation) => state.selected.has(conversation.id));
  }

  function toggleConversation(id, value) {
    if (value) state.selected.add(id);
    else state.selected.delete(id);
    const row = els.conversationList.querySelector('.conversation-row[data-id="' + cssEscape(id) + '"]');
    if (row) {
      const input = row.querySelector("input[type=checkbox]");
      row.classList.toggle("selected", value);
      row.setAttribute("aria-selected", value ? "true" : "false");
      if (input) input.checked = value;
    }
    if (state.filter === "selected") {
      renderList();
    } else {
      refreshSelectionSummary();
    }
  }

  function refreshSelectionSummary() {
    const visible = getVisibleConversations();
    const selectedVisible = visible.filter((item) => state.selected.has(item.id));
    const allSelected = visible.length > 0 && selectedVisible.length === visible.length;
    els.selectAll.checked = allSelected;
    els.selectAll.indeterminate = selectedVisible.length > 0 && !allSelected;
    els.selectAll.disabled = visible.length === 0;
    els.selectionInfo.textContent = "已选 " + state.selected.size + " 条";
    updateExportPanel();
  }

  function cssEscape(value) {
    if (globalThis.CSS && typeof CSS.escape === "function") return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  /* ---------------- 导出设置 ---------------- */

  function updateExportPanel() {
    const selected = getSelectedConversations();
    const count = selected.length;
    const pkg = state.settings.package;
    const info = PACKAGE_INFO[pkg] || PACKAGE_INFO.zip_single;
    const format = core.formatInfo(state.settings.format);
    const fileCount = info.files === null ? count : info.files;
    els.exportSummary.classList.remove("warn");
    els.exportSummary.textContent = "";

    const top = document.createElement("div");
    top.className = "summary-top";
    const label = document.createElement("span");
    label.textContent = count ? "已选 " + count + " 条对话" : "等待选择";
    const value = document.createElement("b");
    value.textContent = count ? fileCount + (pkg.startsWith("zip") ? " 个包" : " 个文件") + " · " + format.name : "—";
    top.append(label, value);
    const desc = document.createElement("p");
    if (!count) {
      desc.textContent = "从左侧勾选至少一条对话。";
    } else {
      desc.textContent = info.desc + " 当前格式：" + format.name + "（" + format.ext + "）。";
      if ((pkg === "zip_multi" || pkg === "multi") && count > 30) {
        els.exportSummary.classList.add("warn");
        desc.textContent = info.desc + " 将触发 " + count + " 次下载，建议改用单个压缩包。";
      }
    }
    els.exportSummary.append(top, desc);

    els.exportBtn.disabled = state.exporting || count === 0 || !state.listLoaded;
    els.exportBtnText.textContent = state.exporting
      ? "正在导出…"
      : count
        ? "导出 " + count + " 条对话"
        : "选择对话后导出";

    const lock = state.exporting;
    for (const input of els.formatGrid.querySelectorAll("input[name=exportFormat]")) input.disabled = lock;
    for (const input of els.modeGrid.querySelectorAll("input[name=exportMode]")) input.disabled = lock;
    for (const input of [els.optThinking, els.optDate, els.optBom]) input.disabled = lock;
    els.refreshTabs.disabled = lock;
  }

  function sourceFilenamePreview() {
    const site = core.siteById(state.siteId);
    return "AI对话导出/" + (site ? site.name : "AI") + "/";
  }

  /* ---------------- 导出流程 ---------------- */

  async function startExport(explicitList, options) {
    const opts = options || {};
    if (state.exporting) return;
    if (!state.selectedTabId) {
      showToast("请先选择一个对话来源。", "warn");
      return;
    }
    const list = (explicitList || getSelectedConversations()).slice();
    if (!list.length) {
      showToast("请先勾选要导出的对话。", "warn");
      return;
    }
    const pkg = state.settings.package;
    if (list.length > 30 && (pkg === "zip_multi" || pkg === "multi")) {
      const ok = await confirmAction(
        "会下载很多个文件",
        "当前设置会触发 " + list.length + " 次独立下载。浏览器可能询问是否允许下载多个文件，建议改用「单个 ZIP」。",
        "仍然分开下载"
      );
      if (!ok) return;
    }

    state.exporting = true;
    state.cancelRequested = false;
    state.exportController = new AbortController();
    state.failedMetas = [];
    state.lastResult = null;
    els.exportResult.hidden = true;
    els.exportResult.textContent = "";
    els.exportProgress.hidden = false;
    els.cancelExport.disabled = false;
    els.cancelExport.textContent = "取消";
    updateProgress(0, "准备读取对话…", "", 0);
    setExportingUI(true);

    const selectedSite = state.siteId;
    const exportedAt = Date.now();
    const settings = Object.assign({}, state.settings, { exportedAt });
    const successes = [];
    const failures = [];
    let downloaded = 0;
    let downloadFailures = [];

    try {
      const total = list.length;
      for (let i = 0; i < total; i++) {
        if (state.cancelRequested) throw new core.AIExportError("ABORTED", "导出已取消", "");
        const meta = list[i];
        const pct = Math.round((i / total) * 76);
        updateProgress(pct, "正在读取 " + (i + 1) + " / " + total, meta.title, i);
        let conversation = state.conversationCache.get(meta.id);
        if (!conversation) {
          try {
            conversation = await fetchConversationFromTab(meta);
            state.conversationCache.set(meta.id, conversation);
          } catch (error) {
            if (error && error.code === "ABORTED") throw error;
            failures.push({
              title: meta.title,
              message: (error && error.message) || "读取失败",
              hint: (error && error.hint) || "",
              meta
            });
            await delay(90);
            continue;
          }
        }
        if (state.cancelRequested) throw new core.AIExportError("ABORTED", "导出已取消", "");
        if (!conversation || !Array.isArray(conversation.messages) || !conversation.messages.length) {
          failures.push({
            title: meta.title,
            message: "没有可导出的文字消息",
            hint: "这条对话可能刚创建、为空，或服务端还没有同步。",
            meta
          });
        } else {
          const hasUser = conversation.messages.some((m) => m.role === "user");
          const hasAssistant = conversation.messages.some((m) => m.role === "assistant" && (m.text || m.thinking));
          if (hasUser && !hasAssistant) {
            failures.push({
              title: meta.title,
              message: "只识别到用户提问，没有识别到模型回答",
              hint: "请刷新原网页、确认回答已经生成完成，再重试；如果持续出现，请把该站点反馈给维护者。",
              meta
            });
          } else {
            successes.push(conversation);
          }
        }
        await delay(110);
      }

      if (state.cancelRequested) throw new core.AIExportError("ABORTED", "导出已取消", "");
      if (!successes.length) {
        finishExport({ successes: 0, failures, downloaded: 0, downloadFailures: [], siteId: selectedSite, cancelled: false });
        return;
      }

      updateProgress(80, "正在生成文件…", "准备打包 " + successes.length + " 条对话", total);
      await delay(40);
      const outcome = await packageAndDownload(successes, settings, selectedSite);
      downloaded = outcome.downloaded;
      downloadFailures = outcome.failures || [];
      if (state.cancelRequested) throw new core.AIExportError("ABORTED", "导出已取消", "");
      updateProgress(100, "导出完成", "", total);
      finishExport({
        successes: successes.length,
        failures,
        downloaded,
        downloadFailures,
        siteId: selectedSite,
        cancelled: false
      });
    } catch (error) {
      if (error && error.code === "ABORTED") {
        state.exporting = false;
        state.exportController = null;
        els.exportProgress.hidden = true;
        els.exportResult.hidden = true;
        setExportingUI(false);
        renderList();
        updateExportPanel();
        showToast("已取消导出，没有生成新的下载。", "warn");
        return;
      }
      failures.push({
        title: "导出过程",
        message: (error && error.message) || "未知错误",
        hint: (error && error.hint) || "",
        meta: null
      });
      finishExport({ successes: successes.length, failures, downloaded, downloadFailures, siteId: selectedSite, cancelled: false });
    }
  }

  async function fetchConversationFromTab(meta) {
    if (!state.selectedTabId) throw new core.AIExportError("TAB_CLOSED", "来源标签页已关闭", "请重新打开 AI 网页并读取历史。");
    const payload = {
      source: "aiexport",
      type: "AIEXPORT_FETCH",
      meta: {
        id: meta.id,
        title: meta.title,
        updatedAt: meta.updatedAt,
        createdAt: meta.createdAt,
        dom: !!meta.dom
      }
    };
    let response;
    try {
      response = await withTimeout(sendTab(state.selectedTabId, payload), 240000, "读取这条对话超时，请稍后再试。");
    } catch (error) {
      // 页面可能刷新过，内容脚本暂时不在；尝试补注入一次。
      await ensureContentScript(state.selectedTabId, listRequestSeq);
      response = await withTimeout(sendTab(state.selectedTabId, payload), 240000, "读取这条对话超时，请稍后再试。");
    }
    if (!response) throw new core.AIExportError("NO_RESPONSE", "页面没有返回对话内容", "请刷新原网页后重试。");
    if (response.ok === false) throw errorFromPayload(response.error);
    return response.conversation;
  }

  async function packageAndDownload(conversations, settings, siteId) {
    const pkg = settings.package;
    const fmt = core.normalizeFormat(settings.format);
    const format = core.formatInfo(fmt);
    const stamp = exportFolderStamp();
    const opts = {
      format: fmt,
      includeThinking: settings.includeThinking !== false,
      includeDate: settings.includeDate !== false,
      withBom: settings.withBom !== false,
      exportedAt: settings.exportedAt || Date.now()
    };
    const site = core.siteById(siteId);
    const siteLabel = site ? site.name : "AI";
    let downloaded = 0;
    const failures = [];
    const usedNames = new Set();

    if (pkg === "single") {
      updateProgress(86, "正在生成单个 " + format.name + " 文件…", "", 100);
      const output = core.buildSingleArchive(conversations, opts);
      await download(output.blob, core.downloadPath(siteId, output.filename));
      downloaded++;
      return { downloaded, failures };
    }

    if (pkg === "zip_single") {
      updateProgress(86, "正在打包单个 ZIP…", "", 100);
      const entries = core.buildArchiveEntries(conversations, opts);
      const blob = core.createZip(entries);
      const name = core.safeFilename("AI对话导出_" + siteLabel + "_" + conversations.length + "条_" + core.nowStamp(), 100) + ".zip";
      await download(blob, core.downloadPath(siteId, name));
      downloaded++;
      return { downloaded, failures };
    }

    if (pkg === "multi") {
      const folder = stamp;
      for (let i = 0; i < conversations.length; i++) {
        if (state.cancelRequested) throw new core.AIExportError("ABORTED", "导出已取消", "");
        const conversation = conversations[i];
        updateProgress(80 + Math.round(((i + 1) / conversations.length) * 19), "正在下载 " + format.name + " " + (i + 1) + " / " + conversations.length, conversation.title, 100);
        const output = core.buildSingleConversationExport(conversation, Object.assign({}, opts, { index: i }));
        const name = core.uniqueName(output.filename, usedNames);
        try {
          await download(output.blob, core.downloadPath(siteId, name, folder));
          downloaded++;
        } catch (error) {
          failures.push({ title: name, message: String(error && error.message || error), hint: "" });
        }
        await delay(60);
      }
      return { downloaded, failures };
    }

    // 多个 ZIP：每条对话一个 ZIP
    const folder = stamp + "_分卷";
    for (let i = 0; i < conversations.length; i++) {
      if (state.cancelRequested) throw new core.AIExportError("ABORTED", "导出已取消", "");
      const conversation = conversations[i];
      updateProgress(80 + Math.round(((i + 1) / conversations.length) * 19), "正在下载 ZIP " + (i + 1) + " / " + conversations.length, conversation.title, 100);
      const entry = core.buildArchiveEntries([conversation], Object.assign({}, opts, { baseIndex: i }))[0];
      const blob = core.createZip([entry]);
      const zipName = core.uniqueName(entry.name.replace(/\.[a-z0-9]+$/i, "") + ".zip", usedNames);
      try {
        await download(blob, core.downloadPath(siteId, zipName, folder));
        downloaded++;
      } catch (error) {
        failures.push({ title: zipName, message: String(error && error.message || error), hint: "" });
      }
      await delay(60);
    }
    return { downloaded, failures };
  }

  async function download(blob, filename) {
    if (!chrome.downloads || !chrome.downloads.download) {
      throw new Error("浏览器未提供下载接口");
    }
    const url = URL.createObjectURL(blob);
    try {
      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url,
          filename,
          conflictAction: "uniquify",
          saveAs: false
        }, (id) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) reject(new Error(lastError.message));
          else resolve(id);
        });
      });
      await waitForDownload(downloadId, 90000);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    }
  }

  function waitForDownload(downloadId, timeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { chrome.downloads.onChanged.removeListener(onChanged); } catch (e) { /* ignore */ }
        if (error) reject(error);
        else resolve();
      };
      const inspect = (item) => {
        if (!item) return;
        if (item.state === "complete") finish(null);
        else if (item.state === "interrupted") finish(new Error("浏览器未能保存文件" + (item.error ? "（" + item.error + "）" : "")));
      };
      const onChanged = (delta) => {
        if (!delta || delta.id !== downloadId) return;
        if (delta.state && delta.state.current === "complete") finish(null);
        else if ((delta.state && delta.state.current === "interrupted") || delta.error) {
          finish(new Error("浏览器未能保存文件" + (delta.error && delta.error.current ? "（" + delta.error.current + "）" : "")));
        }
      };
      try {
        chrome.downloads.onChanged.addListener(onChanged);
      } catch (e) {
        finish(new Error("无法监听下载状态：" + String(e && e.message || e)));
        return;
      }
      timer = setTimeout(() => finish(new Error("下载保存超时，请检查浏览器下载目录")), timeoutMs || 90000);
      try {
        chrome.downloads.search({ id: downloadId }, (items) => {
          void chrome.runtime.lastError;
          inspect(items && items[0]);
        });
      } catch (e) { /* 依赖 onChanged */ }
    });
  }

  function updateProgress(percent, label, detail, itemIndex) {
    const pct = Math.max(0, Math.min(100, Math.round(percent)));
    els.progressBar.style.width = pct + "%";
    els.progressPct.textContent = pct + "%";
    els.progressLabel.textContent = label || "准备中…";
    els.progressDetail.textContent = detail ? String(detail).slice(0, 80) : "";
    if (els.exportProgress.hidden) els.exportProgress.hidden = false;
  }

  function finishExport(result) {
    state.exporting = false;
    state.exportController = null;
    setExportingUI(false);
    els.cancelExport.disabled = false;
    els.cancelExport.textContent = "取消";
    state.failedMetas = result.failures.filter((f) => f.meta).map((f) => f.meta);
    const totalFailures = result.failures.length + (result.downloadFailures ? result.downloadFailures.length : 0);
    const allFailures = result.failures.concat(result.downloadFailures || []);

    els.exportProgress.hidden = true;
    renderExportResult(result, allFailures);
    renderList();
    renderSource();
    updateExportPanel();
    if (result.downloaded > 0) {
      const message = totalFailures
        ? "已保存 " + result.downloaded + " 个文件，" + totalFailures + " 项失败"
        : "已保存 " + result.downloaded + " 个文件";
      showToast(message, totalFailures ? "warn" : "success");
    } else {
      showToast("没有文件被下载，请查看失败原因。", "error");
    }
  }

  function renderExportResult(result, failures) {
    els.exportResult.hidden = false;
    els.exportResult.textContent = "";
    els.exportResult.className = "export-result" + (failures.length ? " error" : "");
    const head = document.createElement("div");
    head.className = "export-result-head";
    const title = document.createElement("strong");
    title.textContent = result.downloaded > 0
      ? (failures.length ? "部分导出完成" : "导出完成")
      : "导出没有完成";
    const count = document.createElement("span");
    count.textContent = result.downloaded + " 个文件";
    head.append(title, count);
    els.exportResult.append(head);

    const desc = document.createElement("p");
    if (result.downloaded > 0) {
      desc.textContent = "已成功读取 " + result.successes + " 条对话，并保存 " + result.downloaded + " 个文件到浏览器下载目录。";
    } else {
      desc.textContent = "没有生成下载文件。请根据下面的原因处理后重试。";
    }
    els.exportResult.append(desc);

    if (failures.length) {
      const list = document.createElement("ul");
      for (const failure of failures.slice(0, 12)) {
        const li = document.createElement("li");
        li.textContent = (failure.title ? "《" + failure.title + "》 " : "") + (failure.message || "未知错误") +
          (failure.hint ? "（" + failure.hint + "）" : "");
        list.append(li);
      }
      els.exportResult.append(list);
    }

    const actions = document.createElement("div");
    actions.className = "result-actions";
    const folderButton = document.createElement("button");
    folderButton.type = "button";
    folderButton.className = "result-link";
    folderButton.dataset.action = "open-folder";
    folderButton.textContent = "打开下载文件夹";
    actions.append(folderButton);
    if (state.failedMetas.length) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "result-link";
      retry.dataset.action = "retry-failed";
      retry.textContent = "重试失败项";
      actions.append(retry);
    }
    els.exportResult.append(actions);
  }

  function setExportingUI(active) {
    els.cancelExport.hidden = !active;
    els.refreshTabs.disabled = active;
    for (const tab of state.tabs) {
      const card = els.sourceArea.querySelector('.source-card[data-tab-id="' + cssEscape(tab.id) + '"]');
      if (card) card.disabled = active;
    }
    renderSource();
    renderList();
    updateExportPanel();
  }

  async function cancelExport() {
    if (!state.exporting) return;
    state.cancelRequested = true;
    if (state.exportController) state.exportController.abort();
    els.cancelExport.disabled = true;
    els.cancelExport.textContent = "正在停止…";
    els.progressLabel.textContent = "正在取消，等待当前请求结束…";
  }

  function showDownloadFolder() {
    try {
      if (chrome.downloads && chrome.downloads.showDefaultFolder) chrome.downloads.showDefaultFolder();
    } catch (e) {
      showToast("无法打开下载文件夹，请从浏览器下载记录中查看。", "warn");
    }
  }

  function exportFolderStamp() {
    const d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes());
  }

  /* ---------------- 交互绑定 ---------------- */

  function bindEvents() {
    els.refreshTabs.addEventListener("click", () => {
      refreshTabs({ manual: true, reload: true }).catch((error) => {
        showToast("刷新失败：" + String(error && error.message || error), "error");
      });
    });

    els.sourceArea.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-open-site]");
      if (openButton) {
        event.preventDefault();
        openSite(openButton.dataset.openSite).catch((error) => {
          showToast("打开网站失败：" + String(error && error.message || error), "error");
        });
        return;
      }
      const card = event.target.closest(".source-card");
      if (!card || card.disabled) return;
      const id = Number(card.dataset.tabId);
      if (!id) return;
      selectTab(id, { load: true });
    });

    els.retryList.addEventListener("click", () => loadConversations());
    els.openSiteFromError.addEventListener("click", () => {
      if (state.siteId) openSite(state.siteId);
    });

    els.searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = els.searchInput.value;
        state.renderLimit = 120;
        renderList();
      }, 110);
    });

    for (const chip of els.filterChips) {
      chip.addEventListener("click", () => {
        state.filter = chip.dataset.filter || "all";
        state.renderLimit = 120;
        for (const item of els.filterChips) item.classList.toggle("active", item === chip);
        renderList();
      });
    }

    els.selectAll.addEventListener("change", () => {
      const visible = getVisibleConversations();
      const allSelected = visible.length > 0 && visible.every((item) => state.selected.has(item.id));
      if (allSelected) {
        for (const item of visible) state.selected.delete(item.id);
      } else {
        for (const item of visible) state.selected.add(item.id);
      }
      renderList();
    });

    els.loadMore.addEventListener("click", () => {
      state.renderLimit += 120;
      renderList();
    });

    els.conversationList.addEventListener("click", (event) => {
      const downloadButton = event.target.closest(".row-download");
      if (downloadButton) {
        event.preventDefault();
        event.stopPropagation();
        const conversation = state.conversations.find((item) => item.id === downloadButton.dataset.id);
        if (conversation && !state.exporting) startExport([conversation]);
        return;
      }
      if (event.target.closest("input,button,label")) return;
      const row = event.target.closest(".conversation-row");
      if (!row) return;
      const id = row.dataset.id;
      toggleConversation(id, !state.selected.has(id));
    });

    els.conversationList.addEventListener("change", (event) => {
      const input = event.target.closest("input[type=checkbox][data-id]");
      if (!input) return;
      toggleConversation(input.dataset.id, input.checked);
    });

    els.conversationList.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest(".conversation-row");
      if (!row || event.target.closest("input,button")) return;
      event.preventDefault();
      toggleConversation(row.dataset.id, !state.selected.has(row.dataset.id));
    });

    els.formatGrid.addEventListener("change", setSettingsFromUI);
    els.modeGrid.addEventListener("change", setSettingsFromUI);
    for (const input of [els.optThinking, els.optDate, els.optBom]) {
      input.addEventListener("change", setSettingsFromUI);
    }

    els.exportBtn.addEventListener("click", () => startExport());
    els.cancelExport.addEventListener("click", cancelExport);

    els.exportResult.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (button.dataset.action === "open-folder") showDownloadFolder();
      if (button.dataset.action === "retry-failed") {
        if (!state.failedMetas.length || state.exporting) return;
        startExport(state.failedMetas.slice(), { retry: true });
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = (event.target && event.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || event.target.isContentEditable) return;
      if (els.listContent.hidden) return;
      event.preventDefault();
      els.searchInput.focus();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden || state.exporting) return;
      if (Date.now() - state.lastTabRefresh < 1200) return;
      refreshTabs({ autoSelect: state.conversations.length === 0 && !state.listLoading, silent: true }).catch(() => {});
    });

    chrome.runtime.onMessage.addListener((message, sender) => {
      if (!message || message.type !== "AIEXPORT_PROGRESS") return false;
      if (!state.listLoading || !sender.tab || sender.tab.id !== state.selectedTabId) return false;
      if (message.message) els.loadingHint.textContent = message.message;
      return false;
    });
  }

  /* ---------------- 错误、提示、工具 ---------------- */

  function errorFromPayload(payload) {
    if (!payload) return new core.AIExportError("UNKNOWN", "未知错误", "请刷新原网页后重试。");
    return new core.AIExportError(payload.code || "UNKNOWN", payload.message || "未知错误", payload.hint || "", payload.details || null);
  }

  function sendTab(tabId, message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new core.AIExportError("TIMEOUT", message || "操作超时", "请稍后重试。"));
      }, ms);
      promise.then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }, (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showToast(message, type) {
    const toast = document.createElement("div");
    toast.className = "toast " + (type || "");
    toast.textContent = message;
    els.toastHost.append(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(6px)";
      toast.style.transition = "180ms ease";
      setTimeout(() => toast.remove(), 200);
    }, type === "error" ? 5200 : 3200);
  }

  function confirmAction(title, message, okLabel) {
    const dialog = els.confirmDialog;
    if (!dialog || typeof dialog.showModal !== "function") {
      return Promise.resolve(window.confirm(title + "\n\n" + message));
    }
    if (dialog.open) dialog.close("cancel");
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    const ok = dialog.querySelector('button[value="ok"]');
    if (ok) ok.textContent = okLabel || "继续";
    dialog.returnValue = "cancel";
    return new Promise((resolve) => {
      const onClose = () => {
        dialog.removeEventListener("close", onClose);
        resolve(dialog.returnValue === "ok");
      };
      dialog.addEventListener("close", onClose);
      dialog.showModal();
    });
  }

  /* ---------------- 仅调试模式：注入演示数据 ---------------- */

  function setupDebugTools() {
    if (new URLSearchParams(location.search).get("debug") !== "1") return;
    window.AIExportUI = {
      state,
      render: () => { renderSource(); renderList(); updateExportPanel(); },
      showDemo: () => {
        const now = Date.now();
        state.siteId = "deepseek";
        state.selectedTabId = null;
        state.tabs = [];
        state.listLoaded = true;
        state.listLoading = false;
        state.listError = null;
        state.currentId = "demo-4";
        state.warnings = ["演示模式：这些数据不会真正下载。"];
        state.conversations = [
          { id: "demo-1", title: "如何把长对话导出成便于检索的文本", updatedAt: now - 3600e3, pinned: true, snippet: "先确认你要的是当前分支，还是包含所有被编辑过的版本。", site: "deepseek" },
          { id: "demo-2", title: "帮我梳理一份产品需求文档的结构", updatedAt: now - 86400e3 * 2, pinned: false, snippet: "背景、目标、用户故事、范围与非目标……", site: "deepseek" },
          { id: "demo-3", title: "关于苏州园林的一日游路线", updatedAt: now - 86400e3 * 5, pinned: false, snippet: "拙政园早上人少，狮子林可以放在午后。", site: "deepseek" },
          { id: "demo-4", title: "正在讨论的对话：周末读书清单", updatedAt: now - 600e3, pinned: false, current: true, snippet: "这周想读一些和城市空间有关的书。", site: "deepseek" },
          { id: "demo-5", title: "SQL 窗口函数在月度报表里的用法", updatedAt: now - 86400e3 * 9, pinned: false, snippet: "ROW_NUMBER 和 RANK 的区别，以及分区排序。", site: "deepseek" },
          { id: "demo-6", title: "给新项目起一个不那么普通的名字", updatedAt: now - 86400e3 * 16, pinned: false, snippet: "偏向自然意象，但不要过于文艺。", site: "deepseek" }
        ];
        state.selected = new Set(["demo-1", "demo-4"]);
        setListMode("content");
        renderSource();
        renderList();
        updateExportPanel();
      }
    };
    console.info("AI 对话导出助手调试模式已启用。运行 AIExportUI.showDemo() 可预览列表界面。");
  }

  init();
})();
