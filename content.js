/* AI 对话导出助手 — 内容脚本
 * 只在你打开的 Kimi / DeepSeek 页面内读取登录状态并调用同源接口。
 * 不把令牌发送到工作台，不向任何第三方服务器上传数据。
 */
(function () {
  "use strict";

  if (globalThis.__AI_EXPORT_CONTENT__) return;
  globalThis.__AI_EXPORT_CONTENT__ = true;

  const core = globalThis.AIExportCore;
  if (!core) return;

  function siteInfo() {
    const site = core.siteFromUrl(location.href);
    return site || null;
  }

  function sendProgress(payload) {
    try {
      chrome.runtime.sendMessage(Object.assign({
        source: "aiexport",
        type: "AIEXPORT_PROGRESS"
      }, payload), () => {
        void chrome.runtime.lastError;
      });
    } catch (e) {
      /* 页面卸载或扩展更新时忽略 */
    }
  }

  function makeContext() {
    const site = siteInfo();
    return {
      href: location.href,
      origin: location.origin,
      storage: window.localStorage,
      document: document,
      documentTitle: document.title,
      onProgress: (progress) => {
        sendProgress({
          site: site ? site.id : "",
          phase: progress.phase || "list",
          count: progress.count || 0,
          message: progress.message || ""
        });
      }
    };
  }

  function pingPayload() {
    const site = siteInfo();
    if (!site) {
      return { ok: true, supported: false, version: core.VERSION };
    }
    let auth = { hasToken: false };
    try {
      auth = core.authHint(site.id, window.localStorage, document);
    } catch (e) {
      auth = { hasToken: false };
    }
    return {
      ok: true,
      supported: true,
      site: site.id,
      siteName: site.name,
      version: core.VERSION,
      href: location.href,
      title: document.title,
      currentId: site.currentId(location.href),
      hasToken: auth.hasToken === undefined ? null : auth.hasToken,
      hasAuthHint: auth.hasToken !== undefined ? !!auth.hasToken : null,
      dom: !!auth.dom,
      support: site.support || "full",
      experimental: !!site.experimental
    };
  }

  async function handle(message) {
    if (!message || message.source !== "aiexport") return null;
    if (message.type === "AIEXPORT_PING") {
      return pingPayload();
    }
    const site = siteInfo();
    if (!site) {
      throw new core.AIExportError(
        "UNSUPPORTED",
        "当前标签页不是受支持的 AI 网站",
        "请先打开 Kimi 或 DeepSeek 的网页版。"
      );
    }
    if (message.type === "AIEXPORT_LIST") {
      const result = await core.listConversations(makeContext());
      return {
        ok: true,
        site: result.site,
        conversations: result.conversations,
        currentId: result.currentId,
        warnings: result.warnings || []
      };
    }
    if (message.type === "AIEXPORT_FETCH") {
      const meta = message.meta || {};
      if (!meta.id || typeof meta.id !== "string" || meta.id.length > 128) {
        throw new core.AIExportError("BAD_INPUT", "会话参数无效", "请重新读取会话列表后再试。");
      }
      const conversation = await core.fetchConversation(site.id, {
        id: meta.id,
        title: typeof meta.title === "string" ? meta.title.slice(0, 300) : "",
        updatedAt: Number(meta.updatedAt) || null,
        createdAt: Number(meta.createdAt) || null,
        dom: !!meta.dom
      }, makeContext());
      return { ok: true, conversation };
    }
    return null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.source !== "aiexport") return false;
    Promise.resolve()
      .then(() => handle(message))
      .then((result) => {
        if (result === null) return;
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ ok: false, error: core.serializeError(error) });
      });
    return true;
  });
})();
