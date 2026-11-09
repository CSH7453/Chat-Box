/* AI 对话导出助手 — 共享核心
 * 这个文件同时运行在内容脚本和扩展工作台中，不依赖第三方库。
 * 所有对话数据只在本机内存中处理。
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AIExportCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.1.3";
  const MAX_PAGES = 240;
  const PAGE_DELAY_MS = 70;

  const SITES = {
    deepseek: {
      id: "deepseek",
      name: "DeepSeek",
      mark: "D",
      color: "#4d6bfe",
      soft: "#edf1ff",
      origin: "https://chat.deepseek.com",
      loginUrl: "https://chat.deepseek.com/",
      hosts: ["chat.deepseek.com"],
      description: "DeepSeek 网页版",
      support: "full",
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        const m = u.pathname.match(/\/a\/chat\/s\/([0-9a-f-]{20,64})/i) ||
          u.pathname.match(/\/chat\/s\/([0-9a-f-]{20,64})/i);
        return m ? m[1] : "";
      },
      conversationUrl(id) {
        return "https://chat.deepseek.com/a/chat/s/" + encodeURIComponent(id);
      }
    },
    kimi: {
      id: "kimi",
      name: "Kimi",
      mark: "K",
      color: "#1c1c1c",
      soft: "#f1efe9",
      origin: "https://www.kimi.com",
      loginUrl: "https://www.kimi.com/",
      hosts: ["www.kimi.com", "kimi.com", "kimi.moonshot.cn"],
      description: "Kimi 网页版",
      support: "full",
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        const m = u.pathname.match(/\/chat\/([0-9a-zA-Z_-]{16,64})/);
        return m ? m[1] : "";
      },
      conversationUrl(id) {
        return "https://www.kimi.com/chat/" + encodeURIComponent(id);
      }
    },
    chatgpt: {
      id: "chatgpt",
      name: "ChatGPT",
      mark: "G",
      color: "#0d8a72",
      soft: "#e8f5f1",
      origin: "https://chatgpt.com",
      loginUrl: "https://chatgpt.com/",
      hosts: ["chatgpt.com", "chat.openai.com"],
      description: "ChatGPT 网页版（实验）",
      support: "experimental",
      experimental: true,
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        const m = u.pathname.match(/\/c\/([0-9a-f-]{20,64})/i);
        return m ? m[1] : "";
      },
      conversationUrl(id) {
        return "https://chatgpt.com/c/" + encodeURIComponent(id);
      }
    },
    claude: {
      id: "claude",
      name: "Claude",
      mark: "C",
      color: "#c15f3c",
      soft: "#faeee8",
      origin: "https://claude.ai",
      loginUrl: "https://claude.ai/",
      hosts: ["claude.ai"],
      description: "Claude 网页版",
      support: "experimental",
      experimental: true,
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        const m = u.pathname.match(/\/chat\/([0-9a-f-]{20,64})/i);
        return m ? m[1] : "";
      },
      conversationUrl(id) {
        return "https://claude.ai/chat/" + encodeURIComponent(id);
      }
    },
    grok: {
      id: "grok",
      name: "Grok",
      mark: "G",
      color: "#1d1d1f",
      soft: "#f0f0ef",
      origin: "https://grok.com",
      loginUrl: "https://grok.com/",
      hosts: ["grok.com", "grok.x.ai", "chat.x.ai"],
      description: "Grok 网页版（当前对话）",
      support: "current",
      current: true,
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        const m = u.pathname.match(/\/(?:c|chat)\/([0-9a-f-]{20,64})/i);
        return m ? m[1] : "";
      },
      conversationUrl(id) {
        return "https://grok.com/c/" + encodeURIComponent(id);
      }
    },
    gemini: {
      id: "gemini",
      name: "Gemini",
      mark: "✦",
      color: "#4285f4",
      soft: "#eaf1fe",
      origin: "https://gemini.google.com",
      loginUrl: "https://gemini.google.com/app",
      hosts: ["gemini.google.com"],
      description: "Gemini 网页版（实验）",
      support: "experimental",
      experimental: true,
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        const m = u.pathname.match(/\/app\/([0-9a-zA-Z_-]{8,})/);
        return m ? m[1] : "";
      },
      conversationUrl(id) {
        return "https://gemini.google.com/app/" + encodeURIComponent(id);
      }
    },
    qwen: {
      id: "qwen",
      name: "千问",
      mark: "Q",
      color: "#615ced",
      soft: "#efedff",
      origin: "https://www.qianwen.com",
      loginUrl: "https://www.qianwen.com/",
      hosts: ["www.qianwen.com", "qianwen.com", "chat.qwen.ai"],
      description: "通义千问 / Qwen 网页版",
      support: "experimental",
      experimental: true,
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        const m = u.pathname.match(/\/(?:chat|c)\/([0-9a-zA-Z_-]{8,})/);
        return m ? m[1] : "";
      },
      conversationUrl(id) {
        return "https://www.qianwen.com/chat/" + encodeURIComponent(id);
      }
    },
    doubao: {
      id: "doubao",
      name: "豆包",
      mark: "豆",
      color: "#1664ff",
      soft: "#eaf1ff",
      origin: "https://www.doubao.com",
      loginUrl: "https://www.doubao.com/chat/",
      hosts: ["www.doubao.com", "doubao.com"],
      description: "豆包网页版",
      support: "experimental",
      experimental: true,
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        const m = u.pathname.match(/\/chat\/(?:bot\/chat\/)?([0-9a-zA-Z_-]{8,})/);
        return m ? m[1] : "";
      },
      conversationUrl(id) {
        return "https://www.doubao.com/chat/" + encodeURIComponent(id);
      }
    },
    wenxin: {
      id: "wenxin",
      name: "文心一言",
      mark: "文",
      color: "#2932e1",
      soft: "#eceeff",
      origin: "https://yiyan.baidu.com",
      loginUrl: "https://yiyan.baidu.com/",
      hosts: ["yiyan.baidu.com", "chat.baidu.com"],
      description: "文心一言网页版（当前对话）",
      support: "current",
      current: true,
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        return u.searchParams.get("chatId") || u.searchParams.get("conversationId") || "";
      },
      conversationUrl(id) {
        return "https://yiyan.baidu.com/?chatId=" + encodeURIComponent(id);
      }
    },
    hunyuan: {
      id: "hunyuan",
      name: "混元 / 元宝",
      mark: "混",
      color: "#0052d9",
      soft: "#e9f1ff",
      origin: "https://hunyuan.tencent.com",
      loginUrl: "https://hunyuan.tencent.com/",
      hosts: ["hunyuan.tencent.com", "yuanbao.tencent.com"],
      description: "混元 / 腾讯元宝网页版（当前对话）",
      support: "current",
      current: true,
      currentId(url) {
        const u = safeUrl(url);
        if (!u) return "";
        const m = u.pathname.match(/\/(?:chat|conversation)\/([0-9a-zA-Z_-]{8,})/);
        return m ? m[1] : "";
      },
      conversationUrl(id) {
        return "https://yuanbao.tencent.com/chat/" + encodeURIComponent(id);
      }
    }
  };

  class AIExportError extends Error {
    constructor(code, message, hint, details) {
      super(message);
      this.name = "AIExportError";
      this.code = code || "UNKNOWN";
      this.hint = hint || "";
      this.details = details || null;
    }
  }

  function fail(code, message, hint, details) {
    throw new AIExportError(code, message, hint, details);
  }

  function serializeError(error) {
    if (!error) return { code: "UNKNOWN", message: "发生未知错误" };
    return {
      code: error.code || "UNKNOWN",
      message: String(error.message || error),
      hint: error.hint || "",
      details: error.details || null
    };
  }

  function safeUrl(value) {
    try {
      return new URL(value);
    } catch (e) {
      return null;
    }
  }

  function siteFromUrl(url) {
    const u = safeUrl(url);
    if (!u) return null;
    for (const site of Object.values(SITES)) {
      if (site.hosts.includes(u.hostname)) return site;
    }
    return null;
  }

  function siteById(id) {
    return SITES[id] || null;
  }

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) return reject(abortError());
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(abortError());
        }, { once: true });
      }
    });
  }

  function abortError() {
    return new AIExportError("ABORTED", "操作已取消", "你可以随时重新开始导出。");
  }

  function isAbort(error) {
    return !!error && (error.code === "ABORTED" || error.name === "AbortError");
  }

  function nowMs() {
    return Date.now();
  }

  function toMs(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value <= 0) return null;
      return value < 100000000000 ? Math.round(value * 1000) : Math.round(value);
    }
    if (typeof value === "bigint") return Number(value) * 1000;
    if (typeof value === "object") {
      if (value.seconds !== undefined && value.seconds !== null) {
        const sec = Number(value.seconds);
        if (Number.isFinite(sec)) return sec * 1000 + Math.round((Number(value.nanos) || 0) / 1e6);
      }
      if (value.value !== undefined) return toMs(value.value);
      if (value.milliseconds !== undefined) {
        const ms = Number(value.milliseconds);
        return Number.isFinite(ms) ? ms : null;
      }
      return null;
    }
    const s = String(value).trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return toMs(Number(s));
    const parsed = Date.parse(s);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDate(value, withTime) {
    const ms = toMs(value);
    if (!ms) return "";
    const d = new Date(ms);
    const date = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    if (!withTime) return date;
    return date + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function formatDay(value) {
    return formatDate(value, false);
  }

  function nowStamp(date) {
    const d = date || new Date();
    return "" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      "_" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
  }

  function formatFileTime(ms) {
    return formatDate(ms, true).replace(/:/g, "：");
  }

  function safeFilename(value, maxLen) {
    let s = String(value === undefined || value === null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/[<>:"/\\|?*#%{}~&]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .trim();
    if (!s) s = "未命名对话";
    const limit = Math.max(12, maxLen || 64);
    if (s.length > limit) s = s.slice(0, limit).replace(/[.\s]+$/g, "");
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) s = "_" + s;
    return s;
  }

  function uniqueName(name, used) {
    let candidate = name;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      const dot = name.lastIndexOf(".");
      candidate = dot > 0
        ? name.slice(0, dot) + " (" + n + ")" + name.slice(dot)
        : name + " (" + n + ")";
      n++;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  }

  function readWrappedString(raw, keys) {
    if (raw === null || raw === undefined) return "";
    if (typeof raw === "object") {
      const list = keys && keys.length ? keys : ["value", "token", "accessToken", "access_token"];
      for (const key of list) {
        if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") {
          return typeof raw[key] === "string" ? raw[key].trim() : String(raw[key]);
        }
      }
      return "";
    }
    let s = String(raw).trim();
    if (!s) return "";
    if (s[0] === '"' && s[s.length - 1] === '"') {
      try { s = JSON.parse(s); } catch (e) { /* keep */ }
    }
    if (s[0] === "{" && s[s.length - 1] === "}") {
      try {
        const obj = JSON.parse(s);
        if (obj && typeof obj === "object") {
          const list = keys && keys.length ? keys : ["value", "token", "accessToken", "access_token"];
          for (const key of list) {
            if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
              return typeof obj[key] === "string" ? obj[key].trim() : String(obj[key]);
            }
          }
        }
      } catch (e) { /* raw string is the token */ }
    }
    return s.trim();
  }

  function getStorage(storage, key) {
    try {
      return storage ? storage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function getDeepSeekToken(ctx) {
    const raw = getStorage(ctx.storage, "userToken");
    const token = readWrappedString(raw, ["value", "token", "accessToken"]);
    if (!token || token.length < 20) {
      fail(
        "AUTH",
        "没有找到 DeepSeek 的登录令牌",
        "请先在这个浏览器里登录 chat.deepseek.com，并刷新该页面，然后重新读取。"
      );
    }
    return token;
  }

  function deepSeekDeviceId(ctx) {
    const raw = getStorage(ctx.storage, "deepseek-device-id:chat");
    const value = readWrappedString(raw, ["value", "id"]);
    if (value) return value;
    return "313ac2cc-39b3-4e37-88ca-9b4de3a33dc1";
  }

  function deepSeekHeaders(ctx) {
    const tz = -new Date().getTimezoneOffset() * 60;
    return {
      "Accept": "application/json",
      "Authorization": "Bearer " + getDeepSeekToken(ctx),
      "x-client-version": "2.5.0",
      "x-client-bundle-id": "com.deepseek.chat",
      "x-client-platform": "web",
      "x-client-locale": "zh_CN",
      "x-client-timezone-offset": String(tz),
      "x-device-id": deepSeekDeviceId(ctx),
      "Referer": (ctx.origin || SITES.deepseek.origin) + "/"
    };
  }

  function getKimiToken(ctx) {
    const keys = ["access_token", "accessToken", "kimi_access_token"];
    for (const key of keys) {
      const value = readWrappedString(getStorage(ctx.storage, key), ["value", "access_token", "accessToken", "token"]);
      if (value && value.length >= 16) return value;
    }
    try {
      const cookie = ctx.document && ctx.document.cookie ? ctx.document.cookie : "";
      const hit = cookie.split(/;\s*/).find((part) => /^(access_token|kimi_access_token|kimi-auth)=/.test(part));
      if (hit) {
        const value = decodeURIComponent(hit.slice(hit.indexOf("=") + 1));
        if (value.length >= 16) return value;
      }
    } catch (e) { /* ignore */ }
    return "";
  }

  function kimiDeviceHeaders(ctx) {
    const out = {};
    try {
      const raw = getStorage(ctx.storage, "volcano-token-info");
      const info = raw ? JSON.parse(raw) : null;
      if (info && typeof info === "object") {
        if (info.webId) out["x-msh-device-id"] = String(info.webId);
        if (info.ssid) out["x-msh-session-id"] = String(info.ssid);
        if (info.userId) out["X-Traffic-Id"] = String(info.userId);
      }
    } catch (e) { /* optional */ }
    return out;
  }

  function kimiHeaders(ctx) {
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Connect-Protocol-Version": "1",
      "x-msh-version": "2.3.0",
      "x-msh-platform": "web",
      "X-Language": "zh-CN",
      "R-Timezone": (function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai"; }
        catch (e) { return "Asia/Shanghai"; }
      })()
    };
    const token = getKimiToken(ctx);
    if (token) headers.Authorization = "Bearer " + token;
    return Object.assign(headers, kimiDeviceHeaders(ctx));
  }

  function authError(siteName, status, detail) {
    return new AIExportError(
      "AUTH",
      siteName + " 登录状态已失效" + (status ? "（HTTP " + status + "）" : ""),
      "请打开 " + siteName + " 页面确认仍处于登录状态，刷新页面后重新读取。扩展不会读取或保存你的密码。",
      detail || ""
    );
  }

  function parseResponseError(status, body) {
    if (body && typeof body === "object") {
      if (body.message) return String(body.message).slice(0, 400);
      if (body.msg) return String(body.msg).slice(0, 400);
      if (body.error) return String(body.error).slice(0, 400);
      if (body.detail) return String(body.detail).slice(0, 400);
      if (Array.isArray(body.details)) {
        const hit = body.details.find((d) => d && d.debug && d.debug.localizedMessage);
        if (hit) return String(hit.debug.localizedMessage.message || "").slice(0, 400);
      }
    }
    return String(body || "").slice(0, 300);
  }

  async function fetchJson(url, options) {
    const opts = options || {};
    const method = (opts.method || "GET").toUpperCase();
    const headers = Object.assign({
      "Accept": "application/json"
    }, opts.headers || {});
    let body = opts.body;
    if (body !== undefined && body !== null && typeof body !== "string" && !(body instanceof Blob) && !(body instanceof FormData)) {
      body = JSON.stringify(body);
      if (!headers["Content-Type"] && !headers["content-type"]) headers["Content-Type"] = "application/json";
    }
    const retries = Number.isFinite(opts.retries) ? opts.retries : 2;
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 45000;
    const externalSignal = opts.signal;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (externalSignal && externalSignal.aborted) throw abortError();
      const controller = new AbortController();
      let timedOut = false;
      const onAbort = () => controller.abort();
      if (externalSignal) externalSignal.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const res = await fetch(url, {
          method,
          headers,
          body,
          credentials: "include",
          signal: controller.signal,
          cache: "no-store"
        });
        const text = await res.text();
        let json = null;
        if (text) {
          try { json = JSON.parse(text); } catch (e) { json = null; }
        }
        if (res.status === 401 || res.status === 403) {
          throw authError(opts.siteName || "AI 网站", res.status, parseResponseError(res.status, json || text));
        }
        if (res.status === 429) {
          lastError = new AIExportError(
            "RATE_LIMIT",
            "请求太频繁，网站暂时限流",
            "请稍等 30 秒后重试。若选择了大量对话，可以分批导出。"
          );
          if (attempt < retries) {
            await sleep(1200 * (attempt + 1), externalSignal);
            continue;
          }
          throw lastError;
        }
        if (res.status >= 500) {
          lastError = new AIExportError(
            "SERVER",
            "网站服务暂时不可用（HTTP " + res.status + "）",
            "这不影响你的数据。稍后重试即可。",
            parseResponseError(res.status, json || text)
          );
          if (attempt < retries) {
            await sleep(900 * (attempt + 1), externalSignal);
            continue;
          }
          throw lastError;
        }
        if (!res.ok) {
          if (res.status === 404 && opts.allow404) {
            return { status: res.status, json, text, response: res };
          }
          throw new AIExportError(
            "HTTP_" + res.status,
            "网站接口返回异常（HTTP " + res.status + "）",
            opts.httpHint || "网站接口可能已更新。请刷新原网页后重试。",
            parseResponseError(res.status, json || text)
          );
        }
        if (json === null && text) {
          throw new AIExportError(
            "INVALID_RESPONSE",
            "网站返回了无法识别的数据",
            "可能有风控或代理页面拦截了请求。请刷新原网页后重试。",
            text.slice(0, 300)
          );
        }
        return { status: res.status, json: json || {}, text, response: res };
      } catch (error) {
        if (isAbort(error)) {
          if (externalSignal && externalSignal.aborted) throw abortError();
          throw new AIExportError("TIMEOUT", "读取超时", "网络较慢或网站响应超时。请稍后重试。");
        }
        if (error instanceof AIExportError) throw error;
        lastError = new AIExportError(
          "NETWORK",
          "连接网站失败",
          "请检查网络连接，并确认原网页可以正常打开。",
          String(error && error.message || error)
        );
        if (attempt < retries) {
          await sleep(700 * (attempt + 1), externalSignal);
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timer);
        if (externalSignal) externalSignal.removeEventListener("abort", onAbort);
      }
    }
    throw lastError || new AIExportError("UNKNOWN", "读取失败", "请稍后重试。");
  }

  async function fetchText(url, options) {
    const opts = options || {};
    const headers = Object.assign({ "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8" }, opts.headers || {});
    let res;
    try {
      res = await fetch(url, {
        method: opts.method || "GET",
        headers,
        body: opts.body,
        credentials: "include",
        cache: "no-store",
        signal: opts.signal
      });
    } catch (error) {
      if (opts.signal && opts.signal.aborted) throw abortError();
      fail("NETWORK", "连接 " + (opts.siteName || "网站") + " 失败", "请检查网络，并确认原网页可以正常打开。", String(error && error.message || error));
    }
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw authError(opts.siteName || "AI 网站", res.status, text.slice(0, 300));
    }
    if (!res.ok) {
      fail("HTTP_" + res.status, (opts.siteName || "网站") + " 返回异常（HTTP " + res.status + "）", opts.hint || "请刷新原网页后重试。", text.slice(0, 300));
    }
    return { text, status: res.status, url: res.url };
  }

  function unwrapDeepSeek(json) {
    if (!json || typeof json !== "object") {
      fail("INVALID_RESPONSE", "DeepSeek 返回了空数据", "请刷新 chat.deepseek.com 后重试。");
    }
    if (json.code !== undefined && json.code !== 0) {
      if ([40001, 40003, 401, 403].includes(json.code)) {
        throw authError("DeepSeek", null, json.msg || "");
      }
      fail(
        "API",
        "DeepSeek 接口报错：" + (json.msg || json.code),
        "请刷新 chat.deepseek.com 后重试；若持续出现，可能是接口已更新。"
      );
    }
    const inner = json.data && typeof json.data === "object" ? json.data : json;
    if (inner.biz_code !== undefined && inner.biz_code !== 0 && inner.biz_code !== null) {
      if ([40001, 40003].includes(inner.biz_code)) throw authError("DeepSeek", null, inner.biz_msg || "");
      fail(
        "API",
        "DeepSeek 返回业务错误：" + (inner.biz_msg || inner.biz_code),
        "请刷新 chat.deepseek.com 后重试。"
      );
    }
    return inner.biz_data || inner;
  }

  function deepSeekUrl(ctx, path, query) {
    const base = ctx.origin || SITES.deepseek.origin;
    const u = new URL(path, base);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) u.searchParams.set(key, String(value));
      }
    }
    return u.toString();
  }

  async function deepSeekPage(ctx, query) {
    const res = await fetchJson(deepSeekUrl(ctx, "/api/v0/chat_session/fetch_page", query), {
      headers: deepSeekHeaders(ctx),
      siteName: "DeepSeek",
      retries: 3,
      timeoutMs: 45000,
      signal: ctx.signal,
      httpHint: "DeepSeek 会话列表接口可能已更新，请打开网页确认历史记录仍可正常显示。"
    });
    const biz = unwrapDeepSeek(res.json);
    return {
      sessions: Array.isArray(biz.chat_sessions) ? biz.chat_sessions : [],
      hasMore: !!biz.has_more
    };
  }

  async function deepSeekList(ctx) {
    const byId = new Map();
    const warnings = [];
    const add = (sessions, pinnedDefault) => {
      for (const raw of sessions || []) {
        if (!raw || !raw.id) continue;
        const id = String(raw.id);
        if (byId.has(id)) continue;
        const updatedAt = toMs(raw.updated_at);
        byId.set(id, {
          id,
          site: "deepseek",
          title: String(raw.title || "").trim() || "未命名对话",
          updatedAt,
          createdAt: updatedAt,
          pinned: raw.pinned === undefined ? !!pinnedDefault : !!raw.pinned,
          snippet: "",
          url: SITES.deepseek.conversationUrl(id)
        });
      }
    };

    try {
      let anchor = 0;
      for (let page = 0; page < 12; page++) {
        const data = await deepSeekPage(ctx, {
          "gte_cursor.pinned": "true",
          "gte_cursor.updated_at": anchor,
          "count": 50
        });
        add(data.sessions, true);
        if (ctx.onProgress) ctx.onProgress({ phase: "list", count: byId.size, message: "已读取 " + byId.size + " 条会话" });
        if (!data.hasMore || !data.sessions.length) break;
        const next = Number(data.sessions[data.sessions.length - 1].updated_at) || 0;
        if (next <= anchor) break;
        anchor = next;
        await sleep(PAGE_DELAY_MS, ctx.signal);
      }
    } catch (error) {
      if (error.code === "AUTH" || error.code === "ABORTED") throw error;
      warnings.push("置顶会话读取失败，已继续读取普通会话。");
    }

    let anchor = "9999999999";
    let pages = 0;
    while (pages < MAX_PAGES) {
      pages++;
      const data = await deepSeekPage(ctx, {
        "lte_cursor.pinned": "false",
        "lte_cursor.updated_at": anchor,
        "count": 50
      });
      const before = byId.size;
      add(data.sessions, false);
      if (ctx.onProgress) ctx.onProgress({ phase: "list", count: byId.size, message: "已读取 " + byId.size + " 条会话" });
      if (!data.sessions.length || !data.hasMore) break;
      const next = String(data.sessions[data.sessions.length - 1].updated_at || "");
      if (!next || next === anchor || byId.size === before) break;
      anchor = next;
      await sleep(PAGE_DELAY_MS, ctx.signal);
    }
    if (pages >= MAX_PAGES) warnings.push("会话数量超过单次读取上限，可能只读取了最近的一部分。");

    const currentId = SITES.deepseek.currentId(ctx.href);
    if (currentId && !byId.has(currentId)) {
      byId.set(currentId, {
        id: currentId,
        site: "deepseek",
        title: "当前页面对话",
        updatedAt: nowMs(),
        createdAt: nowMs(),
        pinned: false,
        snippet: "当前正在查看的会话",
        current: true,
        url: SITES.deepseek.conversationUrl(currentId),
        placeholder: true
      });
      warnings.push("当前页面对话不在历史列表里，已单独加入；它可能刚刚创建或尚未同步。");
    }

    if (currentId && byId.has(currentId)) byId.get(currentId).current = true;
    const list = Array.from(byId.values());
    list.sort((a, b) => {
      if (!!a.current !== !!b.current) return a.current ? -1 : 1;
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return { site: "deepseek", conversations: list, currentId, warnings };
  }

  function normalizeRole(role) {
    const r = String(role || "").toLowerCase();
    if (r === "user" || r.includes("user")) return "user";
    if (r === "assistant" || r.includes("assistant")) return "assistant";
    if (r === "system" || r.includes("system")) return "system";
    if (r === "tool" || r.includes("tool")) return "tool";
    return "";
  }

  function flattenText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join("\n");
    if (typeof value === "object") {
      for (const key of ["content", "text", "value", "markdown", "plain_text", "plainText"]) {
        if (value[key] !== undefined) {
          const out = flattenText(value[key]);
          if (out) return out;
        }
      }
    }
    return "";
  }

  function deepSeekMessageTexts(message) {
    const fragments = Array.isArray(message.fragments) ? message.fragments : [];
    const requests = [];
    const responses = [];
    const thinks = [];
    const searches = [];
    for (const fragment of fragments) {
      if (!fragment) continue;
      const type = String(fragment.type || "").toUpperCase();
      const text = flattenText(fragment.content).trim();
      if (!text) continue;
      if (type === "THINK") thinks.push(text);
      else if (type === "SEARCH") searches.push(text);
      else if (type === "REQUEST") requests.push(text);
      else if (type === "RESPONSE") responses.push(text);
      else if (!type) responses.push(text);
    }
    const role = normalizeRole(message.role) || (requests.length && !responses.length ? "user" : "assistant");
    let text = role === "user" ? requests.join("\n\n") : responses.join("\n\n");
    if (!text && requests.length && responses.length) text = requests.concat(responses).join("\n\n");
    if (!text && fragments.length === 0) text = flattenText(message.content || message.text || "").trim();
    return { role, text, thinking: thinks.join("\n\n"), search: searches.join("\n\n") };
  }

  function collectAttachmentNames(source) {
    const names = [];
    const seen = new Set();
    const visit = (value, depth) => {
      if (!value || depth > 3) return;
      if (Array.isArray(value)) {
        value.forEach((v) => visit(v, depth + 1));
        return;
      }
      if (typeof value !== "object") return;
      const name = value.file_name || value.fileName || value.name || (value.meta && value.meta.name);
      if (name && typeof name === "string" && !seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
      for (const key of ["files", "attachments", "file", "meta"]) {
        if (value[key]) visit(value[key], depth + 1);
      }
    };
    visit(source, 0);
    return names;
  }

  function deepSeekNormalizeMessage(message) {
    const parsed = deepSeekMessageTexts(message);
    const attachments = collectAttachmentNames(message);
    return {
      id: String(message.message_id || message.id || ""),
      role: parsed.role,
      text: parsed.text,
      thinking: parsed.thinking,
      search: parsed.search,
      attachments,
      createdAt: toMs(message.inserted_at || message.created_at || message.create_time || message.createTime),
      status: message.status || ""
    };
  }

  function activeDeepSeekChain(session, messages) {
    const byId = new Map();
    for (const message of messages) {
      const id = String(message.message_id || message.id || "");
      if (id) byId.set(id, message);
    }
    const current = session && (session.current_message_id || session.currentMessageId);
    if (current !== undefined && current !== null && byId.has(String(current))) {
      const chain = [];
      const seen = new Set();
      let cur = String(current);
      while (cur && byId.has(cur) && !seen.has(cur) && chain.length < 20000) {
        seen.add(cur);
        chain.push(byId.get(cur));
        const parent = byId.get(cur).parent_id;
        cur = parent === undefined || parent === null ? "" : String(parent);
      }
      if (chain.length) return chain.reverse();
    }
    return messages.slice().sort((a, b) => {
      const ta = toMs(a.inserted_at || a.created_at) || 0;
      const tb = toMs(b.inserted_at || b.created_at) || 0;
      return ta - tb;
    });
  }

  async function deepSeekConversation(meta, ctx) {
    if (!meta || !meta.id) fail("BAD_INPUT", "缺少会话 ID", "请重新读取会话列表。");
    const res = await fetchJson(deepSeekUrl(ctx, "/api/v0/chat/history_messages", {
      chat_session_id: meta.id
    }), {
      headers: deepSeekHeaders(ctx),
      siteName: "DeepSeek",
      retries: 3,
      timeoutMs: 60000,
      signal: ctx.signal,
      httpHint: "DeepSeek 对话内容接口可能已更新，请刷新网页后重试。"
    });
    const biz = unwrapDeepSeek(res.json);
    const session = biz.chat_session || null;
    const messages = Array.isArray(biz.chat_messages) ? biz.chat_messages : [];
    if (!session && !messages.length) {
      fail(
        "NOT_FOUND",
        "这条对话读不到内容",
        "它可能已被删除，或当前账号无权访问。刷新网页后确认还能打开它。"
      );
    }
    const active = activeDeepSeekChain(session, messages);
    const normalized = active.map(deepSeekNormalizeMessage).filter((m) => m.text || m.thinking || m.attachments.length);
    return {
      id: meta.id,
      site: "deepseek",
      title: String((session && session.title) || meta.title || "未命名对话"),
      createdAt: toMs(session && (session.inserted_at || session.created_at)) || meta.createdAt || null,
      updatedAt: toMs(session && session.updated_at) || meta.updatedAt || null,
      url: SITES.deepseek.conversationUrl(meta.id),
      messages: normalized,
      totalMessages: messages.length,
      hiddenBranches: Math.max(0, messages.length - active.length),
      exportedAt: nowMs()
    };
  }

  const kimiServiceCache = new Map();

  async function kimiRpc(method, payload, ctx) {
    const base = ctx.origin || SITES.kimi.origin;
    const services = [
      "/apiv2/kimi.gateway.chat.v1.ChatService/",
      "/apiv2/kimi.chat.v1.ChatService/"
    ];
    const cached = kimiServiceCache.get(base);
    const ordered = cached ? [cached].concat(services.filter((s) => s !== cached)) : services;
    let last404 = null;
    for (const prefix of ordered) {
      const url = new URL(prefix + method, base).toString();
      const res = await fetchJson(url, {
        method: "POST",
        headers: kimiHeaders(ctx),
        body: payload,
        siteName: "Kimi",
        retries: 2,
        timeoutMs: 60000,
        signal: ctx.signal,
        allow404: true,
        httpHint: "Kimi 接口可能已更新，请刷新网页后重试。"
      });
      if (res.status === 404) {
        last404 = parseResponseError(404, res.json || res.text) || "HTTP 404";
        continue;
      }
      kimiServiceCache.set(base, prefix);
      const body = res.json || {};
      if (body.code && body.code !== 0) {
        if (String(body.code).toLowerCase().includes("unauthenticated")) {
          throw authError("Kimi", res.status, parseResponseError(res.status, body));
        }
        fail("API", "Kimi 接口报错：" + (body.message || body.code), "请刷新 Kimi 页面后重试。");
      }
      return body;
    }
    fail(
      "API_CHANGED",
      "没有找到可用的 Kimi 会话接口",
      "Kimi 的接口地址可能已经调整。请更新扩展，或暂时改用手动复制。",
      last404 || ""
    );
  }

  async function kimiList(ctx) {
    const byId = new Map();
    let pageToken = "";
    let pages = 0;
    const warnings = [];
    while (pages < MAX_PAGES) {
      pages++;
      const body = {
        projectId: "",
        query: "",
        includePinned: pages === 1,
        pageSize: 50,
        pageToken
      };
      const data = await kimiRpc("ListChats", body, ctx);
      const chats = Array.isArray(data.chats) ? data.chats : [];
      const pinned = Array.isArray(data.pinnedChats) ? data.pinnedChats : [];
      for (const raw of pinned.concat(chats)) {
        if (!raw || !raw.id) continue;
        const id = String(raw.id);
        if (byId.has(id)) {
          if (pinned.includes(raw)) byId.get(id).pinned = true;
          continue;
        }
        const updatedAt = toMs(raw.updateTime || raw.update_time);
        byId.set(id, {
          id,
          site: "kimi",
          title: String(raw.name || raw.title || "").trim() || "未命名对话",
          updatedAt,
          createdAt: toMs(raw.createTime || raw.create_time),
          pinned: !!raw.pinned || pinned.includes(raw),
          snippet: String(raw.messageContent || raw.message_content || "").trim().slice(0, 120),
          url: SITES.kimi.conversationUrl(id)
        });
      }
      if (ctx.onProgress) ctx.onProgress({ phase: "list", count: byId.size, message: "已读取 " + byId.size + " 条会话" });
      const next = data.nextPageToken || data.next_page_token || "";
      if (!next || next === pageToken) break;
      pageToken = next;
      await sleep(PAGE_DELAY_MS, ctx.signal);
    }
    if (pages >= MAX_PAGES) warnings.push("会话数量超过单次读取上限，可能只读取了最近的一部分。");

    let currentId = SITES.kimi.currentId(ctx.href);
    if (currentId && !byId.has(currentId)) {
      try {
        const data = await kimiRpc("GetChat", { chatId: currentId }, ctx);
        const chat = data.chat;
        if (chat && chat.id) {
          byId.set(String(chat.id), {
            id: String(chat.id),
            site: "kimi",
            title: String(chat.name || "当前页面对话"),
            updatedAt: toMs(chat.updateTime || chat.update_time) || nowMs(),
            createdAt: toMs(chat.createTime || chat.create_time),
            pinned: !!chat.pinned,
            current: true,
            snippet: "当前正在查看的会话",
            url: SITES.kimi.conversationUrl(String(chat.id))
          });
        }
      } catch (error) {
        if (error.code === "AUTH" || error.code === "ABORTED") throw error;
        warnings.push("当前页面对话未能加入列表，可能尚未同步。");
      }
    }

    if (currentId && byId.has(currentId)) byId.get(currentId).current = true;
    const list = Array.from(byId.values());
    list.sort((a, b) => {
      if (!!a.current !== !!b.current) return a.current ? -1 : 1;
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return { site: "kimi", conversations: list, currentId, warnings };
  }

  function kimiBlockTexts(message) {
    const blocks = Array.isArray(message.blocks) ? message.blocks : [];
    const text = [];
    const thinking = [];
    const attachments = [];
    const toolText = [];
    for (const block of blocks) {
      if (!block) continue;
      if (block.text) {
        const out = flattenText(block.text).trim();
        if (out) text.push(out);
      } else if (block.think) {
        const out = flattenText(block.think).trim();
        if (out) thinking.push(out);
      } else if (block.file) {
        const name = block.file.name || (block.file.meta && block.file.meta.name) || "";
        if (name) attachments.push(name);
      } else if (block.tool) {
        const contents = block.tool.contents;
        if (Array.isArray(contents)) {
          for (const item of contents) {
            if (item && item.text) {
              const out = flattenText(item.text).trim();
              if (out) toolText.push(out);
            }
          }
        }
      } else if (typeof block.content === "string") {
        text.push(block.content.trim());
      }
    }
    if (!text.length && toolText.length) text.push(toolText.join("\n\n"));
    if (!blocks.length) {
      const fallback = flattenText(message.content || message.text || "").trim();
      if (fallback) text.push(fallback);
    }
    return {
      text: text.join("\n\n"),
      thinking: thinking.join("\n\n"),
      attachments
    };
  }

  async function kimiConversation(meta, ctx) {
    if (!meta || !meta.id) fail("BAD_INPUT", "缺少会话 ID", "请重新读取会话列表。");
    const all = [];
    const seen = new Set();
    const seenTokens = new Set();
    let pageToken = "";
    let pages = 0;
    while (pages < MAX_PAGES) {
      pages++;
      const data = await kimiRpc("ListMessages", {
        chatId: meta.id,
        pageSize: 100,
        pageToken,
        direction: "DIRECTION_BACKWARD"
      }, ctx);
      const messages = Array.isArray(data.messages) ? data.messages : [];
      for (const raw of messages) {
        const id = String(raw.id || raw.messageId || "");
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        all.push(raw);
      }
      if (!messages.length) break;
      const next = data.nextPageToken || data.next_page_token || "";
      if (!next || next === pageToken || seenTokens.has(next)) break;
      seenTokens.add(next);
      pageToken = next;
      await sleep(PAGE_DELAY_MS, ctx.signal);
    }
    all.sort((a, b) => {
      const ta = toMs(a.createTime || a.create_time) || 0;
      const tb = toMs(b.createTime || b.create_time) || 0;
      return ta - tb;
    });
    const normalized = all.map((raw) => {
      const parsed = kimiBlockTexts(raw);
      return {
        id: String(raw.id || ""),
        role: normalizeRole(raw.role) || "assistant",
        text: parsed.text,
        thinking: parsed.thinking,
        search: "",
        attachments: parsed.attachments.concat(collectAttachmentNames(raw)).filter((v, i, a) => a.indexOf(v) === i),
        createdAt: toMs(raw.createTime || raw.create_time),
        status: raw.status || ""
      };
    }).filter((m) => m.text || m.thinking || m.attachments.length);
    return {
      id: meta.id,
      site: "kimi",
      title: String(meta.title || "未命名对话"),
      createdAt: meta.createdAt || null,
      updatedAt: meta.updatedAt || null,
      url: SITES.kimi.conversationUrl(meta.id),
      messages: normalized,
      totalMessages: all.length,
      hiddenBranches: 0,
      exportedAt: nowMs()
    };
  }

  function normalizeChatGptRole(role) {
    const r = normalizeRole(role);
    if (r) return r;
    return "assistant";
  }

  function chatGptToken(ctx) {
    const raw = getStorage(ctx.storage, "access_token") || getStorage(ctx.storage, "accessToken");
    const token = readWrappedString(raw, ["value", "accessToken", "access_token", "token"]);
    if (token && token.length > 20) return token;
    return "";
  }

  async function chatGptSession(ctx) {
    const res = await fetchJson(new URL("/api/auth/session", ctx.origin || SITES.chatgpt.origin).toString(), {
      siteName: "ChatGPT",
      retries: 1,
      signal: ctx.signal
    });
    if (!res.json || !res.json.accessToken) {
      fail("AUTH", "没有找到 ChatGPT 的登录状态", "请先登录 chatgpt.com，刷新页面后重试。");
    }
    return res.json;
  }

  async function chatGptHeaders(ctx) {
    const session = await chatGptSession(ctx);
    return {
      "Authorization": "Bearer " + session.accessToken,
      "Accept": "application/json",
      "OAI-Language": "zh-CN"
    };
  }

  async function chatGptList(ctx) {
    const headers = await chatGptHeaders(ctx);
    const byId = new Map();
    let offset = 0;
    const limit = 100;
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL("/backend-api/conversations", ctx.origin || SITES.chatgpt.origin);
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("order", "updated");
      const res = await fetchJson(url.toString(), {
        headers,
        siteName: "ChatGPT",
        retries: 2,
        signal: ctx.signal
      });
      const items = Array.isArray(res.json.items) ? res.json.items : [];
      for (const raw of items) {
        if (!raw || !raw.id) continue;
        const id = String(raw.id);
        if (byId.has(id)) continue;
        const updatedAt = toMs(raw.update_time) || toMs(raw.create_time);
        byId.set(id, {
          id,
          site: "chatgpt",
          title: String(raw.title || "").trim() || "未命名对话",
          updatedAt,
          createdAt: toMs(raw.create_time),
          pinned: false,
          snippet: "",
          url: SITES.chatgpt.conversationUrl(id)
        });
      }
      if (ctx.onProgress) ctx.onProgress({ phase: "list", count: byId.size, message: "已读取 " + byId.size + " 条会话" });
      const total = Number(res.json.total) || 0;
      offset += items.length;
      if (!items.length || (total && offset >= total) || items.length < limit) break;
      await sleep(PAGE_DELAY_MS, ctx.signal);
    }
    const currentId = SITES.chatgpt.currentId(ctx.href);
    const list = Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return { site: "chatgpt", conversations: list, currentId, warnings: [] };
  }

  async function chatGptConversation(meta, ctx) {
    const headers = await chatGptHeaders(ctx);
    const url = new URL("/backend-api/conversation/" + encodeURIComponent(meta.id), ctx.origin || SITES.chatgpt.origin);
    const res = await fetchJson(url.toString(), {
      headers,
      siteName: "ChatGPT",
      retries: 2,
      timeoutMs: 60000,
      signal: ctx.signal
    });
    const data = res.json || {};
    const mapping = data.mapping || {};
    const currentNode = data.current_node;
    const chain = [];
    const seen = new Set();
    let cur = currentNode;
    while (cur && mapping[cur] && !seen.has(cur) && chain.length < 20000) {
      seen.add(cur);
      chain.push(mapping[cur]);
      cur = mapping[cur].parent;
    }
    chain.reverse();
    const nodes = chain.length ? chain : Object.values(mapping);
    const messages = [];
    for (const node of nodes) {
      const m = node && node.message;
      if (!m) continue;
      const role = normalizeChatGptRole(m.author && m.author.role);
      const content = m.content && typeof m.content === "object" ? m.content : {};
      let text = "";
      if (Array.isArray(content.parts)) {
        text = content.parts.map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object") return flattenText(part.text !== undefined ? part.text : part);
          return "";
        }).filter(Boolean).join("\n\n");
      } else if (content.parts && typeof content.parts === "object") {
        text = flattenText(content.parts);
      } else if (typeof content.text === "string") {
        text = content.text;
      }
      if (!text.trim() && typeof m.text === "string") text = m.text;
      let thinking = "";
      const contentType = String(content.content_type || content.contentType || "").toLowerCase();
      if (/reason|think|thought/.test(contentType)) {
        thinking = text;
        text = "";
      }
      for (const key of ["thinking", "reasoning", "reasoning_summary", "reasoningSummary", "thoughts"]) {
        if (m[key]) {
          const value = flattenText(m[key]);
          if (value) thinking += (thinking ? "\n\n" : "") + value;
        }
      }
      const metadata = m.metadata && typeof m.metadata === "object" ? m.metadata : {};
      for (const key of ["reasoning_summary", "reasoning", "thinking", "thoughts"]) {
        if (metadata[key]) {
          const value = flattenText(metadata[key]);
          if (value && !thinking.includes(value)) thinking += (thinking ? "\n\n" : "") + value;
        }
      }
      if (!text.trim() && !thinking.trim()) continue;
      messages.push({
        id: String(m.id || node.id || ""),
        role,
        text: text.trim(),
        thinking: thinking.trim(),
        search: "",
        attachments: [],
        createdAt: toMs(m.create_time),
        status: ""
      });
    }
    return {
      id: meta.id,
      site: "chatgpt",
      title: String(data.title || meta.title || "未命名对话"),
      createdAt: toMs(data.create_time) || meta.createdAt || null,
      updatedAt: toMs(data.update_time) || meta.updatedAt || null,
      url: SITES.chatgpt.conversationUrl(meta.id),
      messages,
      totalMessages: messages.length,
      hiddenBranches: 0,
      exportedAt: nowMs()
    };
  }

  /* ======================= Claude ======================= */

  function claudeOrganizations(ctx) {
    const origin = ctx.origin || "https://claude.ai";
    return fetchJson(origin + "/api/organizations", {
      siteName: "Claude",
      retries: 2,
      signal: ctx.signal,
      httpHint: "请确认已登录 claude.ai。"
    }).then((res) => {
      const data = res.json || {};
      const list = Array.isArray(data) ? data : (Array.isArray(data.organizations) ? data.organizations : (Array.isArray(data.data) ? data.data : []));
      const orgs = list.map((org) => ({
        id: String((org && (org.uuid || org.id || org.organization_id)) || ""),
        name: String((org && (org.name || org.display_name)) || "")
      })).filter((org) => org.id);
      if (!orgs.length) {
        fail("AUTH", "没有找到 Claude 的组织信息", "请刷新 claude.ai 页面并确认仍处于登录状态。");
      }
      return orgs;
    });
  }

  async function claudeConversationList(ctx) {
    const orgs = await claudeOrganizations(ctx);
    const byId = new Map();
    let lastError = null;
    for (const org of orgs) {
      const paths = [
        "/api/organizations/" + encodeURIComponent(org.id) + "/chat_conversations",
        "/api/organizations/" + encodeURIComponent(org.id) + "/chat_conversations_v2"
      ];
      let ok = false;
      for (const path of paths) {
        try {
          const res = await fetchJson((ctx.origin || "https://claude.ai") + path, {
            siteName: "Claude",
            retries: 2,
            signal: ctx.signal,
            allow404: true,
            httpHint: "Claude 会话列表接口可能已更新，请刷新页面后重试。"
          });
          if (res.status === 404) continue;
          const payload = res.json || {};
          const list = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : (Array.isArray(payload.chat_conversations) ? payload.chat_conversations : []));
          for (const raw of list) {
            if (!raw) continue;
            const id = String(raw.uuid || raw.id || "");
            if (!id || byId.has(id)) continue;
            const updatedAt = toMs(raw.updated_at || raw.updatedAt);
            byId.set(id, {
              id,
              site: "claude",
              title: String(raw.name || raw.title || "").trim() || "未命名对话",
              updatedAt,
              createdAt: toMs(raw.created_at || raw.createdAt),
              pinned: !!raw.pinned,
              snippet: String(raw.summary || "").trim().slice(0, 120),
              url: SITES.claude.conversationUrl(id),
              orgId: org.id
            });
          }
          ok = true;
          break;
        } catch (error) {
          if (error.code === "AUTH" || error.code === "ABORTED") throw error;
          lastError = error;
        }
      }
      if (!ok && !byId.size) {
        if (lastError) throw lastError;
      }
    }
    if (!byId.size) {
      fail("EMPTY", "Claude 账号里还没有历史对话", "如果你刚安装扩展，请刷新 claude.ai 后再读取。");
    }
    const currentId = SITES.claude.currentId(ctx.href);
    if (currentId && byId.has(currentId)) byId.get(currentId).current = true;
    const list = Array.from(byId.values()).sort(compareConversationList);
    return { site: "claude", conversations: list, currentId, warnings: [] };
  }

  async function claudeConversation(meta, ctx) {
    const orgs = await claudeOrganizations(ctx);
    const orgId = meta.orgId || orgs[0].id;
    const res = await fetchJson((ctx.origin || "https://claude.ai") +
      "/api/organizations/" + encodeURIComponent(orgId) + "/chat_conversations/" + encodeURIComponent(meta.id), {
        siteName: "Claude",
        retries: 2,
        timeoutMs: 60000,
        signal: ctx.signal,
        httpHint: "Claude 对话接口可能已更新，请刷新页面后重试。"
      });
    const data = res.json || {};
    const rawMessages = Array.isArray(data.chat_messages) ? data.chat_messages : (Array.isArray(data.messages) ? data.messages : []);
    const messages = [];
    for (const raw of rawMessages) {
      const sender = String(raw.sender || raw.role || "").toLowerCase();
      const role = sender.includes("human") || sender === "user" ? "user" : (sender.includes("assistant") ? "assistant" : normalizeRole(sender));
      let text = "";
      let thinking = "";
      if (Array.isArray(raw.content)) {
        for (const part of raw.content) {
          if (!part || typeof part !== "object") continue;
          const partType = String(part.type || "").toLowerCase();
          const partText = flattenText(part.thinking !== undefined ? part.thinking : (part.text !== undefined ? part.text : part));
          if (partType.includes("thinking") || partType.includes("reasoning")) {
            if (partText) thinking += (thinking ? "\n\n" : "") + partText;
          } else if (partText && !partType.includes("tool")) {
            text += (text ? "\n\n" : "") + partText;
          }
        }
      } else {
        text = flattenText(raw.content || raw.text || "");
      }
      if (!thinking && raw.thinking) thinking = flattenText(raw.thinking);
      const attachments = [];
      if (Array.isArray(raw.attachments)) {
        for (const att of raw.attachments) if (att && (att.name || att.file_name)) attachments.push(att.name || att.file_name);
      }
      if (!text.trim() && !attachments.length) continue;
      messages.push({
        id: String(raw.uuid || raw.id || ""),
        role: role || "assistant",
        text: text.trim(),
        thinking: thinking.trim(),
        search: "",
        attachments,
        createdAt: toMs(raw.created_at || raw.updated_at),
        status: ""
      });
    }
    if (!messages.length) {
      fail("EMPTY", "这条 Claude 对话没有可导出的文字", "请确认网页里能打开它，或稍后再试。");
    }
    return {
      id: meta.id,
      site: "claude",
      title: String(data.name || data.title || meta.title || "未命名对话"),
      createdAt: toMs(data.created_at) || meta.createdAt || null,
      updatedAt: toMs(data.updated_at) || meta.updatedAt || null,
      url: SITES.claude.conversationUrl(meta.id),
      messages,
      totalMessages: messages.length,
      hiddenBranches: 0,
      exportedAt: nowMs()
    };
  }

  /* ======================= 千问 / Qwen ======================= */

  function qwenCookie(ctx, name) {
    try {
      const cookie = ctx.document && ctx.document.cookie ? ctx.document.cookie : "";
      const hit = cookie.split(/;\s*/).find((part) => part.startsWith(name + "="));
      if (hit) return decodeURIComponent(hit.slice(name.length + 1));
    } catch (e) { /* ignore */ }
    return "";
  }

  function qwenDeviceId(ctx) {
    return qwenCookie(ctx, "b-user-id") ||
      readWrappedString(getStorage(ctx.storage, "uc-stat-dn"), ["value", "id", "token"]) ||
      readWrappedString(getStorage(ctx.storage, "utdid"), ["value", "id", "token"]) ||
      "aiexport-" + Math.random().toString(36).slice(2, 12);
  }

  function qwenToken(ctx) {
    const direct = readWrappedString(getStorage(ctx.storage, "token"), ["value", "token", "access_token"]);
    if (direct && direct.length > 8) return direct;
    const cookieToken = qwenCookie(ctx, "token");
    return cookieToken || "";
  }

  function qwenCommonParams(ctx) {
    return {
      biz_id: "ai_qwen",
      chat_client: "h5",
      device: "pc",
      fr: "pc",
      pr: "qwen",
      ut: qwenDeviceId(ctx),
      la: "zh-CN",
      tz: "Asia/Shanghai",
      wv: "4.12.7",
      tq: "SD",
      ve: "4.12.7"
    };
  }

  function qwenHeaders(ctx) {
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Platform": "pc_tongyi",
      "X-DeviceId": qwenDeviceId(ctx),
      "prod_id": "tongyi",
      "Origin": ctx.origin || "https://www.qianwen.com",
      "Referer": ctx.href || "https://www.qianwen.com/"
    };
    const csrf = qwenCookie(ctx, "XSRF-TOKEN");
    if (csrf) headers["X-XSRF-TOKEN"] = csrf;
    if (/chat\.qwen\.ai$/i.test((safeUrl(ctx.origin || "") || {}).hostname || "")) {
      const token = qwenToken(ctx);
      if (token) headers.Authorization = "Bearer " + token;
    }
    return headers;
  }

  function qwenBaseUrls(ctx) {
    const host = (safeUrl(ctx.origin || "") || {}).hostname || "";
    const out = [];
    if (/qianwen\.com$/i.test(host)) {
      out.push("https://chat2-api.qianwen.com");
      if (ctx.origin) out.push(ctx.origin);
    } else {
      out.push(ctx.origin || "https://chat.qwen.ai");
    }
    out.push("https://chat.qwen.ai");
    return Array.from(new Set(out.filter(Boolean)));
  }

  function qwenUrl(base, path, ctx) {
    const u = new URL(path, base);
    for (const [key, value] of Object.entries(qwenCommonParams(ctx))) {
      if (!u.searchParams.has(key)) u.searchParams.set(key, String(value));
    }
    return u.toString();
  }

  async function qwenRequest(ctx, path, options) {
    const opts = options || {};
    let lastError = null;
    for (const base of qwenBaseUrls(ctx)) {
      const url = qwenUrl(base, path, ctx);
      try {
        const res = await fetchJson(url, {
          method: opts.method || "GET",
          headers: qwenHeaders(ctx),
          body: opts.body,
          siteName: "千问",
          retries: 1,
          timeoutMs: 45000,
          signal: ctx.signal,
          allow404: true,
          httpHint: "千问网页接口可能已更新，请刷新 qianwen.com 后重试。"
        });
        if (res.status === 404) continue;
        const json = res.json || {};
        if (json.success === false || (typeof json.httpCode === "number" && json.httpCode >= 400)) {
          const message = json.msg || json.message || "千问接口返回失败";
          if (json.httpCode === 401 || json.httpCode === 403 || /login|auth|未登录/i.test(message)) {
            throw authError("千问", json.httpCode, message);
          }
          throw new AIExportError("API", message, "请刷新 qianwen.com 后重试。");
        }
        return json;
      } catch (error) {
        if (error.code === "ABORTED") throw error;
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    fail("API_CHANGED", "没有找到可用的千问会话接口", "请刷新 www.qianwen.com 后重试；若持续失败，可能是接口已变更。");
  }

  function qwenNormalizeSession(raw, pinnedDefault) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.sessionId || raw.session_id || raw.id || "");
    if (!id) return null;
    return {
      id,
      site: "qwen",
      title: String(raw.summary || raw.title || raw.sessionTitle || raw.name || "").trim() || "未命名对话",
      updatedAt: toMs(raw.modifiedTime || raw.modified_time || raw.updateTime || raw.update_time || raw.modified_at),
      createdAt: toMs(raw.createTime || raw.create_time || raw.createdAt),
      pinned: !!(raw.top || raw.pinned || pinnedDefault),
      snippet: String(raw.summary || "").trim().slice(0, 120),
      url: SITES.qwen.conversationUrl(id)
    };
  }

  function qwenIsInternational(ctx) {
    const host = (safeUrl(ctx.origin || "") || {}).hostname || "";
    return host === "chat.qwen.ai" || host === "qwen.ai" || host === "chat.qwen.com";
  }

  function qwenIntlHeaders(ctx) {
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Platform": "pc_tongyi",
      "Origin": ctx.origin || "https://chat.qwen.ai",
      "Referer": ctx.href || "https://chat.qwen.ai/"
    };
    const token = qwenToken(ctx);
    if (token) headers.Authorization = "Bearer " + token;
    return headers;
  }

  async function qwenIntlRequest(ctx, path) {
    const res = await fetchJson((ctx.origin || "https://chat.qwen.ai") + path, {
      method: "GET",
      headers: qwenIntlHeaders(ctx),
      siteName: "千问",
      retries: 1,
      timeoutMs: 45000,
      signal: ctx.signal,
      allow404: true,
      httpHint: "千问接口可能已更新，请刷新 chat.qwen.ai 后重试。"
    });
    if (res.status === 404) fail("API_CHANGED", "没有找到可用的千问会话接口", "请刷新页面后重试。");
    const json = res.json || {};
    if (json.success === false) {
      const detail = json.data && (json.data.message || json.data.details);
      fail("API", "千问接口返回失败：" + (json.message || detail || "未知错误"), "请刷新 chat.qwen.ai 后重试。");
    }
    return json;
  }

  function qwenIntlNormalize(raw, pinnedDefault, ctx) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || raw.chat_id || "");
    if (!id) return null;
    return {
      id,
      site: "qwen",
      title: String(raw.title || raw.name || "").trim() || "未命名对话",
      updatedAt: toMs(raw.updated_at || raw.update_time || raw.updatedAt),
      createdAt: toMs(raw.created_at || raw.create_time || raw.createdAt),
      pinned: !!(raw.pinned || raw.top || pinnedDefault),
      snippet: "",
      url: "https://chat.qwen.ai/c/" + encodeURIComponent(id)
    };
  }

  async function qwenIntlList(ctx) {
    const byId = new Map();
    const warnings = [];
    try {
      const pinned = await qwenIntlRequest(ctx, "/api/v2/chats/pinned");
      const list = Array.isArray(pinned.data) ? pinned.data : (pinned.data && Array.isArray(pinned.data.items) ? pinned.data.items : []);
      for (const raw of list) {
        const item = qwenIntlNormalize(raw, true, ctx);
        if (item && !byId.has(item.id)) byId.set(item.id, item);
      }
    } catch (error) {
      if (error.code === "AUTH" || error.code === "ABORTED") throw error;
      warnings.push("千问置顶会话读取失败，已继续读取普通会话。");
    }
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await qwenIntlRequest(ctx, "/api/v2/chats/?page=" + page + "&exclude_project=true");
      const list = Array.isArray(data.data) ? data.data : (data.data && Array.isArray(data.data.items) ? data.data.items : []);
      if (!list.length) break;
      for (const raw of list) {
        const item = qwenIntlNormalize(raw, false, ctx);
        if (item && !byId.has(item.id)) byId.set(item.id, item);
      }
      if (ctx.onProgress) ctx.onProgress({ phase: "list", count: byId.size, message: "已读取 " + byId.size + " 条千问会话" });
      if (list.length < 60) break;
      await sleep(PAGE_DELAY_MS, ctx.signal);
    }
    const currentId = SITES.qwen.currentId(ctx.href);
    if (currentId && byId.has(currentId)) byId.get(currentId).current = true;
    const list = Array.from(byId.values()).sort(compareConversationList);
    if (!list.length) warnings.push("没有读取到千问历史会话；请确认当前网页账号里能看到记录。");
    return { site: "qwen", conversations: list, currentId, warnings };
  }

  async function qwenIntlConversation(meta, ctx) {
    const data = await qwenIntlRequest(ctx, "/api/v2/chats/" + encodeURIComponent(meta.id));
    const root = data.data || data;
    const chat = root.chat || root;
    const history = chat.history || root.history || {};
    const mapping = history.messages || {};
    const currentId = history.currentId || history.current_id || chat.currentId || root.currentId;
    const ordered = [];
    const seen = new Set();
    let cursor = currentId;
    while (cursor && mapping[cursor] && !seen.has(cursor)) {
      seen.add(cursor);
      ordered.push(mapping[cursor]);
      cursor = mapping[cursor].parentId || mapping[cursor].parent_id || null;
    }
    ordered.reverse();
    let nodes = ordered.length ? ordered : Object.values(mapping);
    if (!Array.isArray(nodes)) nodes = [];
    const messages = [];
    for (const node of nodes) {
      if (!node) continue;
      const role = normalizeRole(node.role) || "assistant";
      const content = node.content !== undefined ? node.content : node.content_list;
      const text = qwenContentText(content, 0);
      if (!text) continue;
      messages.push({
        id: String(node.id || node.message_id || ""),
        role,
        text,
        thinking: "",
        search: "",
        attachments: [],
        createdAt: toMs(node.timestamp || node.created_at || node.create_time),
        status: node.done === false ? "GENERATING" : ""
      });
    }
    if (!messages.length) {
      fail("EMPTY", "这条千问对话没有读到文字消息", "请打开网页确认对话还在，或稍后重试。");
    }
    return {
      id: meta.id,
      site: "qwen",
      title: chat.title || root.title || meta.title || "未命名对话",
      createdAt: meta.createdAt || null,
      updatedAt: meta.updatedAt || null,
      url: meta.url || ("https://chat.qwen.ai/c/" + encodeURIComponent(meta.id)),
      messages,
      totalMessages: messages.length,
      hiddenBranches: 0,
      exportedAt: nowMs()
    };
  }

  async function qwenConversationList(ctx) {
    const byId = new Map();
    const warnings = [];
    let nextToken = "";
    let pages = 0;

    // 置顶会话在独立接口中，普通分页接口可能不会返回它们。
    try {
      const topData = await qwenRequest(ctx, "/api/v1/session/top/list", {
        method: "POST",
        body: { sort_field: "modifiedTime", need_show_chat_list: true }
      });
      const topBody = topData.data || topData;
      const topItems = Array.isArray(topBody.items) ? topBody.items : (Array.isArray(topBody) ? topBody : []);
      for (const raw of topItems) {
        const item = qwenNormalizeSession(raw, true);
        if (item && !byId.has(item.id)) byId.set(item.id, item);
      }
    } catch (error) {
      if (error.code === "AUTH" || error.code === "ABORTED") throw error;
      warnings.push("千问置顶会话读取失败，已继续读取普通会话。");
    }

    for (let page = 0; page < MAX_PAGES; page++) {
      pages++;
      const data = await qwenRequest(ctx, "/api/v2/session/page/list", {
        method: "POST",
        body: {
          limit: 50,
          next_token: nextToken,
          sort_field: "modifiedTime",
          need_filter_tag: true
        }
      });
      const body = data.data || data;
      const list = Array.isArray(body.items) ? body.items : (Array.isArray(body.list) ? body.list : []);
      for (const raw of list) {
        const item = qwenNormalizeSession(raw, false);
        if (item && !byId.has(item.id)) byId.set(item.id, item);
      }
      if (ctx.onProgress) ctx.onProgress({ phase: "list", count: byId.size, message: "已读取 " + byId.size + " 条千问会话" });
      const next = body.next_token || body.nextToken || "";
      if (!next || next === nextToken) break;
      nextToken = next;
      await sleep(PAGE_DELAY_MS, ctx.signal);
    }
    if (pages >= MAX_PAGES) warnings.push("千问会话数量超过单次读取上限。");

    const currentId = SITES.qwen.currentId(ctx.href);
    if (currentId && byId.has(currentId)) byId.get(currentId).current = true;
    const list = Array.from(byId.values()).sort(compareConversationList);
    if (!list.length) warnings.push("没有读取到千问历史会话；请确认当前网页账号里能看到记录。");
    return { site: "qwen", conversations: list, currentId, warnings };
  }

  function qwenContentText(value, depth) {
    if (value === null || value === undefined || depth > 5) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
      return value.map((item) => qwenContentText(item, depth + 1)).filter(Boolean).join("\n\n").trim();
    }
    if (typeof value !== "object") return "";
    const parts = [];
    const push = (text) => {
      const t = String(text || "").trim();
      if (t && !parts.includes(t)) parts.push(t);
    };
    if (value.cardMap && typeof value.cardMap === "object") {
      for (const card of Object.values(value.cardMap)) {
        const text = qwenContentText(card, depth + 1);
        if (text) push(text);
      }
    }
    if (Array.isArray(value.cards)) {
      for (const card of value.cards) {
        if (!card || typeof card !== "object") continue;
        const mime = String(card.mimeType || card.mime_type || card.type || "").toLowerCase();
        if (/think|reason|thought/.test(mime)) continue;
        if (!mime || /text|markdown|plain/.test(mime)) push(qwenContentText(card.content !== undefined ? card.content : card.text, depth + 1));
      }
    }
    for (const key of ["content", "text", "answer", "markdown", "plain_text", "plainText", "message", "response", "output", "multiLoadIframe", "cardMap"]) {
      if (value[key] !== undefined && !(key === "content" && Array.isArray(value.cards))) {
        const text = qwenContentText(value[key], depth + 1);
        if (text) push(text);
      }
    }
    if (!parts.length && Array.isArray(value.cards)) {
      for (const card of value.cards) {
        if (card && typeof card === "object") {
          const text = qwenContentText(card.content !== undefined ? card.content : card, depth + 1);
          if (text) push(text);
        }
      }
    }
    return parts.join("\n\n").trim();
  }

  function qwenThinkingText(value, depth) {
    if (value === null || value === undefined || depth > 5) return "";
    if (typeof value === "string") return "";
    if (Array.isArray(value)) {
      return value.map((item) => qwenThinkingText(item, depth + 1)).filter(Boolean).join("\n\n").trim();
    }
    if (typeof value !== "object") return "";
    const parts = [];
    const push = (text) => {
      const t = String(text || "").trim();
      if (t && !parts.includes(t)) parts.push(t);
    };
    for (const key of ["thinking", "thinking_content", "thinkingContent", "reasoning", "reasoning_content", "reasoningContent", "thoughts", "thought"]) {
      if (value[key] !== undefined && typeof value[key] !== "object") push(value[key]);
      else if (value[key] && typeof value[key] === "object") push(qwenContentText(value[key], depth + 1));
    }
    if (Array.isArray(value.cards)) {
      for (const card of value.cards) {
        if (!card || typeof card !== "object") continue;
        const mime = String(card.mimeType || card.mime_type || card.type || "").toLowerCase();
        if (/think|reason|thought/.test(mime)) {
          push(qwenContentText(card.content !== undefined ? card.content : card.text, depth + 1));
        }
      }
    }
    for (const key of ["message", "response", "output", "answer", "content", "extraInfo", "extra_info", "multiLoadIframe", "cardMap"]) {
      if (value[key] && typeof value[key] === "object") {
        const text = qwenThinkingText(value[key], depth + 1);
        if (text) push(text);
      }
    }
    return parts.join("\n\n").trim();
  }

  function qwenArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return [];
      try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" ? [parsed] : []);
      } catch (e) { return []; }
    }
    if (value && typeof value === "object") {
      if (Array.isArray(value.list)) return value.list;
      if (Array.isArray(value.items)) return value.items;
      return Object.values(value);
    }
    return [];
  }

  function qwenAddMessage(all, seen, message) {
    if (!message || !message.text) return;
    const key = String(message.id || "") + "|" + message.role + "|" + message.text.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    all.push(message);
  }

  function qwenRecordMessages(record, all, seen) {
    if (!record || typeof record !== "object") return;
    const baseTime = toMs(record.create_time || record.update_time || record.createTime);
    const questions = qwenArray(record.questions);
    const recordAnswers = qwenArray(record.answers);
    const rawResponse = qwenArray(
      record.qwen_response_messages ||
      record.response_messages ||
      record.responses ||
      record.answer_messages ||
      record.messages
    );
    let userFound = false;
    let assistantFound = false;

    const addAnswer = (answer) => {
      if (answer === null || answer === undefined) return;
      if (typeof answer === "string") {
        const text = qwenContentText(answer, 0);
        if (!text) return;
        assistantFound = true;
        qwenAddMessage(all, seen, {
          id: String(record.req_id || record.reqId || ""),
          role: "assistant",
          text,
          thinking: qwenThinkingText(record, 0),
          search: "",
          attachments: [],
          createdAt: baseTime,
          status: ""
        });
        return;
      }
      if (typeof answer !== "object") return;
      const text = qwenContentText(answer.content !== undefined ? answer.content : answer, 0);
      if (!text) return;
      assistantFound = true;
      qwenAddMessage(all, seen, {
        id: String(answer.reqId || answer.req_id || record.req_id || ""),
        role: "assistant",
        text,
        thinking: qwenThinkingText(answer, 0) || qwenThinkingText(record, 0),
        search: "",
        attachments: [],
        createdAt: toMs(answer.create_time || answer.createTime) || baseTime,
        status: ""
      });
    };

    for (const question of questions) {
      if (!question || typeof question !== "object") continue;
      const text = qwenContentText(question.cards ? { cards: question.cards } : question, 0);
      if (text) {
        userFound = true;
        qwenAddMessage(all, seen, {
          id: String(question.reqId || question.req_id || record.req_id || ""),
          role: "user",
          text,
          thinking: "",
          search: "",
          attachments: [],
          createdAt: toMs(question.create_time || question.createTime) || baseTime,
          status: ""
        });
      }
      qwenArray(question.answers).forEach(addAnswer);
      if (question.answer) qwenArray(question.answer).forEach(addAnswer);
    }
    recordAnswers.forEach(addAnswer);
    if (record.answer) qwenArray(record.answer).forEach(addAnswer);

    // 旧版/部分记录直接返回请求消息与响应消息。
    if (!userFound) {
      const requests = qwenArray(record.request_messages || record.request_messages_list || record.requests);
      for (const msg of requests) {
        const text = qwenContentText(msg, 0);
        if (!text) continue;
        userFound = true;
        qwenAddMessage(all, seen, {
          id: String(msg.req_id || msg.reqId || record.req_id || ""),
          role: "user",
          text,
          thinking: "",
          search: "",
          attachments: [],
          createdAt: toMs(msg.create_time || msg.createTime) || baseTime,
          status: ""
        });
      }
    }
    if (!assistantFound) {
      for (const msg of rawResponse) {
        const text = qwenContentText(msg, 0);
        if (!text) continue;
        assistantFound = true;
        qwenAddMessage(all, seen, {
          id: String(msg.req_id || msg.reqId || record.req_id || ""),
          role: "assistant",
          text,
          thinking: qwenThinkingText(msg, 0),
          search: "",
          attachments: [],
          createdAt: toMs(msg.create_time || msg.createTime) || baseTime,
          status: ""
        });
      }
    }
    if (!userFound && !assistantFound) {
      const text = qwenContentText(record, 0);
      if (text) {
        qwenAddMessage(all, seen, {
          id: String(record.req_id || ""),
          role: normalizeRole(record.role) || "assistant",
          text,
          thinking: "",
          search: "",
          attachments: [],
          createdAt: baseTime,
          status: ""
        });
      }
    }
  }

  async function qwenConversation(meta, ctx) {
    const all = [];
    const seen = new Set();
    const seenPositions = new Set();
    let pos = "";
    let page = 1;
    let pages = 0;
    for (let i = 0; i < MAX_PAGES; i++) {
      pages++;
      const query = new URLSearchParams({
        session_id: meta.id,
        page_size: "5",
        page: String(page),
        forward: "false",
        include_pos: "false",
        return_response_messages: "true",
        event_filter: "all",
        fe_version: "1.0.0"
      });
      if (pos) query.set("pos", pos);
      const data = await qwenRequest(ctx, "/api/v1/session/msg/list?" + query.toString(), { method: "GET" });
      const body = data.data || data;
      const list = Array.isArray(body.list) ? body.list : (Array.isArray(body.record_list) ? body.record_list : []);
      if (!list.length) break;
      const beforeCount = all.length;
      for (const record of list) qwenRecordMessages(record, all, seen);
      if (ctx.onProgress) ctx.onProgress({ phase: "conversation", count: all.length, message: "已读取 " + all.length + " 条千问消息" });
      const last = list[list.length - 1] || {};
      const nextPos = body.next_page_pos || last.pos || "";
      const hasMore = body.have_next_page !== undefined ? !!body.have_next_page :
        (body.has_next_page !== undefined ? !!body.has_next_page :
          (body.have_more_record !== undefined ? !!body.have_more_record : !!nextPos));
      if (!hasMore) break;
      if (nextPos && seenPositions.has(String(nextPos))) break;
      if (nextPos) {
        seenPositions.add(String(nextPos));
        pos = String(nextPos);
      } else if (page > 1 && all.length === beforeCount) {
        break;
      }
      page++;
      await sleep(PAGE_DELAY_MS, ctx.signal);
    }
    if (pages >= MAX_PAGES) {
      // 不把上限静默当成完整结果；仍导出已读取部分，并在文件头提示。
      if (!all.length) fail("EMPTY", "这条千问对话没有读到文字消息", "请稍后重试。");
    }
    // 有时间的按时间排序；没有时间的保持服务端顺序。
    if (all.some((m) => m.createdAt)) all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!all.length) {
      fail("EMPTY", "这条千问对话没有读到文字消息", "请打开网页确认对话还在，或稍后重试。");
    }
    if (!all.some((m) => m.role === "assistant" && (m.text || m.thinking))) {
      try {
        const sessionRes = await qwenRequest(ctx, "/api/v1/session/get", {
          method: "POST",
          body: JSON.stringify({ session_id: meta.id })
        });
        const session = (sessionRes && sessionRes.data) || {};
        const lastPos = session.last_req_pos || session.last_complete_req_pos;
        if (lastPos) {
          const query = new URLSearchParams({
            session_id: meta.id,
            pos: String(lastPos),
            page_size: "5",
            page: "1",
            forward: "false",
            include_pos: "true",
            return_response_messages: "true",
            event_filter: "all",
            fe_version: "1.0.0"
          });
          const latest = await qwenRequest(ctx, "/api/v1/session/msg/list?" + query.toString(), { method: "GET" });
          const latestBody = latest.data || latest;
          const latestList = Array.isArray(latestBody.list) ? latestBody.list : (Array.isArray(latestBody.record_list) ? latestBody.record_list : []);
          for (const record of latestList) qwenRecordMessages(record, all, seen);
        }
      } catch (e) { /* keep the original result */ }
    }
    if (!all.some((m) => m.role === "assistant" && (m.text || m.thinking)) &&
        SITES.qwen.currentId(ctx.href) === meta.id) {
      try {
        const fallback = domConversation(SITES.qwen, meta, ctx);
        if (fallback.messages.some((m) => m.role === "assistant" && (m.text || m.thinking))) {
          fallback.warning = "历史接口没有返回模型回答，已从当前页面补全；" + (fallback.warning || "");
          return fallback;
        }
      } catch (e) { /* keep API result */ }
    }
    return {
      id: meta.id,
      site: "qwen",
      title: meta.title || "未命名对话",
      createdAt: meta.createdAt || null,
      updatedAt: meta.updatedAt || null,
      url: SITES.qwen.conversationUrl(meta.id),
      messages: all,
      totalMessages: all.length,
      hiddenBranches: 0,
      exportedAt: nowMs()
    };
  }

  /* ======================= 豆包 ======================= */

  function doubaoSequenceId() {
    try {
      if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) { /* ignore */ }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function doubaoUrl(ctx, path) {
    const u = new URL(path, ctx.origin || "https://www.doubao.com");
    const params = {
      version_code: "20800",
      language: "zh",
      device_platform: "web",
      aid: "497858",
      real_aid: "497858",
      pkg_type: "release_version",
      device_id: "7657474819050538546",
      pc_version: "3.26.3",
      region: "CN",
      sys_region: "CN",
      samantha_web: "1",
      web_platform: "browser",
      "use-olympus-account": "1",
      web_tab_id: "aiexport"
    };
    for (const [key, value] of Object.entries(params)) u.searchParams.set(key, value);
    return u.toString();
  }

  async function doubaoRequest(ctx, path, payload) {
    const body = Object.assign({}, payload, { sequence_id: doubaoSequenceId() });
    const res = await fetchJson(doubaoUrl(ctx, path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; encoding=utf-8",
        "Accept": "application/json, text/plain, */*",
        "Agw-Js-Conv": "str",
        "Origin": ctx.origin || "https://www.doubao.com",
        "Referer": ctx.href || "https://www.doubao.com/chat/"
      },
      body,
      siteName: "豆包",
      retries: 2,
      timeoutMs: 60000,
      signal: ctx.signal,
      httpHint: "豆包网页接口可能已更新，请刷新 www.doubao.com 后重试。"
    });
    const json = res.json || {};
    if (json.status_code && json.status_code !== 0 && json.status_code !== 1000) {
      fail("API", "豆包接口报错：" + (json.status_msg || json.status_code), "请刷新豆包页面后重试。");
    }
    return json;
  }

  function doubaoConversationCell(cell) {
    const conv = cell && cell.conversation ? cell.conversation : {};
    const id = String(conv.conversation_id || conv.id || "");
    if (!id) return null;
    const type = Number(conv.conversation_type || 0);
    let title = String(conv.name || conv.title || "").trim();
    if (!title && Array.isArray(conv.messages)) {
      for (const m of conv.messages) {
        if (Number(m.user_type) === 1) {
          for (const block of m.content_block || []) {
            if (Number(block.block_type) === 10000) {
              const t = block.content && block.content.text_block && block.content.text_block.text;
              if (t) { title = String(t); break; }
            }
          }
        }
        if (title) break;
      }
    }
    return {
      id,
      type,
      title: title.slice(0, 120) || "未命名豆包对话",
      updatedAt: toMs(conv.update_time || conv.updated_at || conv.create_time),
      createdAt: toMs(conv.create_time || conv.created_at),
      url: type === 5 ? "https://www.doubao.com/chat/bot/chat/" + encodeURIComponent(id) : SITES.doubao.conversationUrl(id)
    };
  }

  async function doubaoConversationList(ctx) {
    const byId = new Map();
    let convVersion = 0;
    let newestId = "";
    let warnings = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const json = await doubaoRequest(ctx, "/im/chain/recent_conv", {
        cmd: 3200,
        uplink_body: {
          pull_recent_conv_chain_uplink_body: {
            limit: 50,
            message_count_per_conv: 1,
            api_version: 1,
            conv_version: convVersion,
            direction: 2,
            option: {
              not_need_message: false,
              need_complete_conversation: true,
              need_coco_conversation: true,
              need_coco_bot: true
            }
          }
        },
        channel: 2,
        version: "1"
      });
      const dlb = (json.downlink_body || {}).pull_recent_conv_chain_downlink_body || {};
      const cells = Array.isArray(dlb.cells) ? dlb.cells : [];
      const real = cells.length > 1 ? cells.slice(0, -1) : cells;
      for (const cell of real) {
        const c = doubaoConversationCell(cell);
        if (c && !byId.has(c.id)) byId.set(c.id, Object.assign(c, { site: "doubao", pinned: false, snippet: "" }));
      }
      if (ctx.onProgress) ctx.onProgress({ phase: "list", count: byId.size, message: "已读取 " + byId.size + " 条豆包会话" });
      if (!dlb.has_more || cells.length <= 1) break;
      const lastConv = real.length ? real[real.length - 1].conversation : null;
      if (!lastConv) break;
      const next = Number(lastConv.conv_version) || 0;
      if (!next || next === convVersion) break;
      convVersion = next;
      await sleep(PAGE_DELAY_MS, ctx.signal);
    }
    // 补取最新一条（豆包的锚点分页行为）
    if (byId.size) {
      const json = await doubaoRequest(ctx, "/im/chain/recent_conv", {
        cmd: 3200,
        uplink_body: {
          pull_recent_conv_chain_uplink_body: {
            limit: 50,
            message_count_per_conv: 1,
            api_version: 1,
            conv_version: 0,
            direction: 3,
            option: {
              not_need_message: false,
              need_complete_conversation: true,
              need_coco_conversation: true,
              need_coco_bot: true
            }
          }
        },
        channel: 2,
        version: "1"
      });
      const dlb = (json.downlink_body || {}).pull_recent_conv_chain_downlink_body || {};
      const cells = Array.isArray(dlb.cells) ? dlb.cells : [];
      if (cells.length) {
        const newest = doubaoConversationCell(cells[0]);
        if (newest) {
          newestId = newest.id;
          if (!byId.has(newest.id)) byId.set(newest.id, Object.assign(newest, { site: "doubao", pinned: false, snippet: "" }));
        }
      }
    }
    const currentId = SITES.doubao.currentId(ctx.href);
    if (currentId && byId.has(currentId)) byId.get(currentId).current = true;
    if (!byId.size) warnings.push("豆包账号里还没有读取到历史对话。");
    const list = Array.from(byId.values()).reverse().sort(compareConversationList);
    if (newestId && !list.some((item) => item.updatedAt)) {
      const index = list.findIndex((item) => item.id === newestId);
      if (index > 0) list.unshift(list.splice(index, 1)[0]);
    }
    return { site: "doubao", conversations: list, currentId, warnings };
  }

  function doubaoMessageText(message) {
    let text = "";
    let thinking = "";
    const attachments = [];
    for (const block of message.content_block || []) {
      if (!block) continue;
      const type = Number(block.block_type);
      const textBlock = block.content && block.content.text_block;
      const thinkBlock = block.content && (block.content.think_block || block.content.thinking_block);
      const blockText = (textBlock && textBlock.text) || "";
      if (blockText) {
        const isThink = !!(block.is_think || block.is_reasoning || (textBlock && (textBlock.is_think || textBlock.is_reasoning)));
        if (isThink) thinking += (thinking ? "\n\n" : "") + blockText;
        else text += (text ? "\n\n" : "") + blockText;
      } else if (thinkBlock && thinkBlock.text) {
        thinking += (thinking ? "\n\n" : "") + thinkBlock.text;
      }
      if (type === 10052) {
        const atts = block.content && block.content.attachment_block && block.content.attachment_block.attachments;
        if (Array.isArray(atts)) {
          for (const att of atts) {
            const name = att.file_name || att.name;
            if (name) attachments.push(name);
          }
        }
      }
    }
    if (message.thinking) thinking += (thinking ? "\n\n" : "") + flattenText(message.thinking);
    if (!text) {
      text = flattenText(message.content || message.text || "");
      if (text && text.startsWith("{")) {
        try {
          const obj = JSON.parse(text);
          if (obj && typeof obj.text === "string") text = obj.text;
          if (obj && (!message.thinking && (obj.reasoning_content || obj.reasoning))) {
            thinking = flattenText(obj.reasoning_content || obj.reasoning);
          }
        } catch (e) { /* keep */ }
      }
    }
    return { text: text.trim(), thinking: thinking.trim(), attachments };
  }

  async function doubaoConversation(meta, ctx) {
    const all = new Map();
    let anchor = 9007199254740991;
    let empty = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const json = await doubaoRequest(ctx, "/im/chain/single", {
        cmd: 3100,
        uplink_body: {
          pull_singe_chain_uplink_body: {
            conversation_id: meta.id,
            anchor_index: anchor,
            conversation_type: Number(meta.type) || 3,
            direction: 1,
            limit: 20,
            ext: {},
            filter: { index_list: [] },
            evaluate_ab_params: "",
            evaluate_common_params: ""
          }
        },
        channel: 2,
        version: "1"
      });
      const dlb = (json.downlink_body || {}).pull_singe_chain_downlink_body || {};
      const messages = Array.isArray(dlb.messages) ? dlb.messages : [];
      if (!messages.length) {
        empty++;
        if (empty >= 2) break;
        continue;
      }
      let added = 0;
      let minIndex = anchor;
      for (const raw of messages) {
        const id = String(raw.message_id || raw.id || "");
        const index = Number(raw.index_in_conv) || 0;
        if (index < minIndex) minIndex = index;
        if (id && all.has(id)) continue;
        const parsed = doubaoMessageText(raw);
        if (!parsed.text && !parsed.attachments.length) continue;
        all.set(id || String(index), {
          id,
          role: Number(raw.user_type) === 1 ? "user" : "assistant",
          text: parsed.text,
          thinking: parsed.thinking,
          search: "",
          attachments: parsed.attachments,
          createdAt: toMs(raw.create_time || raw.createTime),
          status: ""
        });
        added++;
      }
      if (ctx.onProgress) ctx.onProgress({ phase: "conversation", count: all.size, message: "已读取 " + all.size + " 条豆包消息" });
      if (!added) break;
      anchor = minIndex;
      await sleep(40, ctx.signal);
    }
    const messages = Array.from(all.values()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!messages.length) {
      fail("EMPTY", "这条豆包对话没有读到文字消息", "请确认网页中仍能打开它，或稍后重试。");
    }
    return {
      id: meta.id,
      site: "doubao",
      title: meta.title || "未命名对话",
      createdAt: meta.createdAt || null,
      updatedAt: meta.updatedAt || null,
      url: meta.url || SITES.doubao.conversationUrl(meta.id),
      messages,
      totalMessages: messages.length,
      hiddenBranches: 0,
      exportedAt: nowMs()
    };
  }

  /* ======================= Gemini ======================= */

  const geminiSessionCache = new Map();

  function geminiExtractToken(html, name) {
    const patterns = [
      new RegExp('"' + name + '"\\s*:\\s*"([^"]+)"'),
      new RegExp(name + '\\\\?"\\s*:\\s*\\\\?"([^"\\\\]+)')
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) return m[1];
    }
    return "";
  }

  async function geminiSession(ctx) {
    const origin = "https://gemini.google.com";
    const cached = geminiSessionCache.get(ctx.origin || origin);
    if (cached && Date.now() - cached.cachedAt < 8 * 60 * 1000) return cached;
    const res = await fetchText(origin + "/app", {
      siteName: "Gemini",
      signal: ctx.signal,
      hint: "请先登录 gemini.google.com，并刷新页面。"
    });
    if (/accounts\\.google\\.com|ServiceLogin/i.test(res.url || "")) {
      throw authError("Gemini", null, "页面被重定向到 Google 登录页");
    }
    const at = geminiExtractToken(res.text, "SNlM0e");
    const bl = geminiExtractToken(res.text, "cfb2h");
    const sid = geminiExtractToken(res.text, "FdrFJe");
    if (!at) {
      throw authError("Gemini", null, "没有在页面中找到 Gemini 会话令牌");
    }
    const session = { at, bl, sid, cachedAt: Date.now() };
    geminiSessionCache.set(ctx.origin || origin, session);
    return session;
  }

  function geminiCollectRpc(array, out) {
    if (!Array.isArray(array)) return;
    if (array[0] === "wrb.fr" && typeof array[2] === "string") {
      try { out.push(JSON.parse(array[2])); } catch (e) { /* skip */ }
      return;
    }
    for (const item of array) geminiCollectRpc(item, out);
  }

  function geminiParseFrames(text) {
    const clean = String(text || "").replace(/^\)\]\}'\s*/, "");
    const out = [];
    const lines = clean.split(/\r?\n/);
    for (const line of lines) {
      const s = line.trim();
      const start = s.indexOf("[");
      if (start < 0) continue;
      try {
        const value = JSON.parse(s.slice(start));
        geminiCollectRpc(value, out);
      } catch (e) { /* length prefix or partial line */ }
    }
    if (!out.length) {
      const start = clean.indexOf("[[");
      if (start >= 0) {
        try { geminiCollectRpc(JSON.parse(clean.slice(start)), out); } catch (e) { /* ignore */ }
      }
    }
    return out;
  }

  async function geminiBatch(ctx, rpcId, payload, session) {
    const sess = session || await geminiSession(ctx);
    const url = new URL("https://gemini.google.com/_/BardChatUi/data/batchexecute");
    url.searchParams.set("rpcids", rpcId);
    url.searchParams.set("source-path", "/app");
    if (sess.bl) url.searchParams.set("bl", sess.bl);
    if (sess.sid) url.searchParams.set("f.sid", sess.sid);
    url.searchParams.set("hl", "zh-CN");
    url.searchParams.set("_reqid", String(100000 + Math.floor(Math.random() * 800000)));
    url.searchParams.set("rt", "c");
    const req = JSON.stringify([[[rpcId, JSON.stringify(payload), null, "generic"]]]);
    const body = new URLSearchParams();
    body.set("f.req", req);
    body.set("at", sess.at);
    const res = await fetchText(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        "X-Same-Domain": "1",
        "Origin": "https://gemini.google.com",
        "Referer": "https://gemini.google.com/"
      },
      body: body.toString(),
      siteName: "Gemini",
      signal: ctx.signal,
      hint: "Gemini 接口可能已更新，请刷新页面后重试。"
    });
    const parts = geminiParseFrames(res.text);
    if (!parts.length) {
      fail("INVALID_RESPONSE", "Gemini 返回了无法识别的数据", "请刷新 gemini.google.com 后重试。", res.text.slice(0, 300));
    }
    return parts;
  }

  async function geminiConversationList(ctx) {
    const byId = new Map();
    for (const pin of [1, 0]) {
      let token = "";
      for (let page = 0; page < 30; page++) {
        const parts = await geminiBatch(ctx, "MaZiqc", [13, token || null, [pin, null, 1]]);
        let nextToken = "";
        for (const partBody of parts) {
          if (!partBody) continue;
          const list = Array.isArray(partBody[2]) ? partBody[2] : [];
          for (const data of list) {
            if (!Array.isArray(data) || !data[0]) continue;
            const id = String(data[0]);
            if (byId.has(id)) continue;
            const ts = Array.isArray(data[5]) ? (Number(data[5][0]) * 1000 + Math.round((Number(data[5][1]) || 0) / 1e6)) : toMs(data[5]);
            byId.set(id, {
              id,
              site: "gemini",
              title: String(data[1] || "").trim() || "未命名对话",
              updatedAt: ts || null,
              createdAt: null,
              pinned: pin === 1 || !!data[2],
              snippet: "",
              url: SITES.gemini.conversationUrl(id)
            });
          }
          if (typeof partBody[1] === "string" && partBody[1]) nextToken = partBody[1];
        }
        if (ctx.onProgress) ctx.onProgress({ phase: "list", count: byId.size, message: "已读取 " + byId.size + " 条 Gemini 会话" });
        if (!nextToken || nextToken === token) break;
        token = nextToken;
        await sleep(PAGE_DELAY_MS, ctx.signal);
      }
    }
    const currentId = SITES.gemini.currentId(ctx.href);
    if (currentId && byId.has(currentId)) byId.get(currentId).current = true;
    const list = Array.from(byId.values()).sort(compareConversationList);
    return {
      site: "gemini",
      conversations: list,
      currentId,
      warnings: list.length ? [] : ["Gemini 没有返回历史对话；如果侧边栏里有记录，请刷新页面后重试。"]
    };
  }

  async function geminiConversation(meta, ctx) {
    const parts = await geminiBatch(ctx, "hNvQHb", [meta.id, 200, null, 1, [1], [4], null, 1]);
    let turns = null;
    for (const partBody of parts) {
      if (partBody && Array.isArray(partBody[0])) { turns = partBody[0]; break; }
    }
    if (!turns) {
      fail("EMPTY", "这条 Gemini 对话没有读到轮次", "可能接口结构已变化，请刷新页面后重试。");
    }
    const ordered = turns.slice().reverse();
    const messages = [];
    for (const turn of ordered) {
      const userText = turn && turn[2] && turn[2][0] && turn[2][0][0];
      if (typeof userText === "string" && userText.trim()) {
        messages.push({
          id: "",
          role: "user",
          text: userText.trim(),
          thinking: "",
          search: "",
          attachments: [],
          createdAt: null,
          status: ""
        });
      }
      const candidateList = turn && turn[3] && turn[3][0];
      if (Array.isArray(candidateList) && candidateList.length) {
        const candidate = candidateList[0];
        let text = candidate && candidate[1] && candidate[1][0];
        if ((!text || !String(text).trim()) && candidate) {
          text = candidate[22] && candidate[22][0];
        }
        const thoughts = candidate && candidate[37] && candidate[37][0] && candidate[37][0][0];
        if ((typeof text === "string" && text.trim()) || (typeof thoughts === "string" && thoughts.trim())) {
          messages.push({
            id: String(candidate[0] || ""),
            role: "assistant",
            text: typeof text === "string" ? text.trim() : "",
            thinking: typeof thoughts === "string" ? thoughts.trim() : "",
            search: "",
            attachments: [],
            createdAt: null,
            status: ""
          });
        }
      }
    }
    if (!messages.length) {
      fail("EMPTY", "这条 Gemini 对话没有可导出的文字", "请打开网页确认消息仍可显示。");
    }
    return {
      id: meta.id,
      site: "gemini",
      title: meta.title || "未命名对话",
      createdAt: null,
      updatedAt: meta.updatedAt || null,
      url: SITES.gemini.conversationUrl(meta.id),
      messages,
      totalMessages: messages.length,
      hiddenBranches: 0,
      exportedAt: nowMs()
    };
  }

  /* ======================= 当前页面 DOM 提取 ======================= */

  function cleanDomText(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/^(?:You said|User said|你说|用户说)\s*[:：]?\s*/i, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function domMessageCandidates(siteId, doc) {
    if (!doc || !doc.querySelectorAll) return [];
    const configs = {
      chatgpt: [
        { selector: "[data-message-author-role]", role: "auto" }
      ],
      claude: [
        { selector: '[data-testid="user-message"], .standard-markdown, .font-claude-response-body', role: "auto" }
      ],
      qwen: [
        { selector: 'main [class*="message"], main [class*="chat-round"]', role: "auto" }
      ],
      doubao: [
        { selector: 'main [data-testid*="message"], main [class*="message"]', role: "auto" }
      ],
      gemini: [
        { selector: "user-query", role: "user" },
        { selector: "model-response", role: "assistant" }
      ],
      grok: [
        { selector: '[data-testid="conversation-turn"]', role: "auto" },
        { selector: 'main [role="article"]', role: "auto" },
        { selector: 'main [class*="message"]', role: "auto" }
      ],
      wenxin: [
        { selector: 'main [class*="chat-item"]', role: "auto" },
        { selector: 'main [class*="message"]', role: "auto" },
        { selector: 'main [class*="dialog"]', role: "auto" }
      ],
      hunyuan: [
        { selector: 'main [data-testid*="message"]', role: "auto" },
        { selector: 'main [class*="message"]', role: "auto" },
        { selector: 'main [class*="chat-item"]', role: "auto" },
        { selector: 'main [class*="dialog"]', role: "auto" }
      ]
    };
    const groups = configs[siteId] || [];
    const collected = [];
    const seenNodes = new Set();
    for (const group of groups) {
      let nodes = [];
      try { nodes = Array.from(doc.querySelectorAll(group.selector)); } catch (e) { nodes = []; }
      for (const node of nodes) {
        if (!node || seenNodes.has(node)) continue;
        seenNodes.add(node);
        collected.push({ node, role: group.role });
      }
    }
    if (!collected.length) {
      const main = doc.querySelector("main") || doc.body;
      const fallback = cleanDomText(main ? (main.innerText || main.textContent || "") : "");
      return fallback ? [{ text: fallback, role: "assistant", fallback: true }] : [];
    }
    // 只保留最内层消息节点，避免一个消息容器被重复计算。
    const innermost = collected.filter((item) => !collected.some((other) => other !== item && item.node.contains(other.node)));
    const items = [];
    for (const item of innermost) {
      const text = cleanDomText(item.node.innerText || item.node.textContent || "");
      if (!text) continue;
      let role = item.role;
      if (role === "auto") {
        const hint = (item.node.getAttribute("data-message-author-role") || item.node.getAttribute("data-role") || item.node.className || "").toString().toLowerCase();
        if (/user|human|query|question|request/.test(hint)) role = "user";
        else if (/assistant|bot|answer|response|model|markdown|font-claude|ai/.test(hint)) role = "assistant";
        else role = "";
      }
      let thinking = "";
      try {
        if (item.node.querySelectorAll) {
          const thinkNodes = Array.from(item.node.querySelectorAll('[class*="thinking"], [class*="reasoning"], [class*="thought"], [data-testid*="thinking"]'));
          for (const thinkNode of thinkNodes) {
            const t = cleanDomText(thinkNode.innerText || thinkNode.textContent || "");
            if (t && t !== text && !thinking.includes(t)) thinking += (thinking ? "\n\n" : "") + t;
          }
        }
      } catch (e) { /* optional */ }
      items.push({ node: item.node, text, role, thinking });
    }
    // 自动判断失败时，按 DOM 顺序交替角色；但若所有节点都明确是同一角色，
    // 则保留事实，交给下面的整页兜底补上缺失的一侧。
    if (items.length && items.every((item) => !item.role)) {
      items.forEach((item, index) => { item.role = index % 2 === 0 ? "user" : "assistant"; });
    }
    // 页面通常按时间顺序渲染；用 DOM 顺序排序比选择器分组顺序可靠。
    items.sort((a, b) => {
      try {
        const pos = a.node.compareDocumentPosition(b.node);
        if (pos & 4) return -1; // DOCUMENT_POSITION_FOLLOWING
        if (pos & 2) return 1;  // DOCUMENT_POSITION_PRECEDING
      } catch (e) { /* ignore */ }
      return 0;
    });
    return items;
  }

  function domDocumentTitle(site, doc) {
    const raw = String((doc && doc.title) || "").replace(/\s*[-|·]\s*(Gemini|Grok|文心一言|腾讯元宝|混元|豆包|Qwen|千问).*$/i, "").trim();
    return raw || (site ? site.name + " 当前对话" : "当前对话");
  }

  function domCurrentList(site, ctx) {
    const title = domDocumentTitle(site, ctx.document);
    const id = site.currentId(ctx.href) || "current-page";
    return {
      site: site.id,
      conversations: [{
        id,
        site: site.id,
        title,
        updatedAt: nowMs(),
        createdAt: null,
        pinned: false,
        current: true,
        snippet: "当前页面中已加载的对话",
        url: ctx.href,
        dom: true
      }],
      currentId: id,
      warnings: [
        site.name + " 当前仅支持导出「当前页面」中已加载的对话；完整历史请先在网页中打开对应会话，或等待后续版本适配。"
      ]
    };
  }

  function domConversation(site, meta, ctx) {
    let candidates = domMessageCandidates(site.id, ctx.document);
    if (!candidates.length) {
      fail("EMPTY", "当前页没有读取到可见消息", "请先打开一条具体对话，并向下滚动让消息加载出来，再重试。");
    }
    const hasUser = candidates.some((item) => item.role === "user");
    const hasAssistant = candidates.some((item) => item.role === "assistant");
    let warning = "当前页模式只包含页面上已加载的消息；长对话请先滚动到最早一条再导出。";
    if (!hasAssistant) {
      // 某些站点使用大量 CSS Module 类名，无法可靠识别角色。此时用整页
      // 正文补齐回答侧，避免出现“只有提问、没有回答”的不完整导出。
      const main = ctx.document.querySelector("main") || ctx.document.body;
      const fullText = cleanDomText(main ? (main.innerText || main.textContent || "") : "");
      if (fullText && fullText.length > (candidates.map((item) => item.text).join("").length * 0.8)) {
        candidates = candidates.concat([{ text: fullText, role: "assistant", fallback: true }]);
        warning += " 未能从页面结构中识别回答气泡，已追加一份整页文字快照。";
      }
    }
    if (!hasUser) {
      const main = ctx.document.querySelector("main") || ctx.document.body;
      const fullText = cleanDomText(main ? (main.innerText || main.textContent || "") : "");
      if (fullText) {
        candidates = [{ text: fullText, role: "user", fallback: true }].concat(candidates);
        warning += " 未能识别提问气泡，已追加一份整页文字快照。";
      }
    }
    const messages = candidates.map((item, index) => ({
      id: "dom-" + (index + 1),
      role: item.role || "assistant",
      text: item.text,
      thinking: item.thinking || "",
      search: "",
      attachments: [],
      createdAt: null,
      status: ""
    }));
    return {
      id: meta.id,
      site: site.id,
      title: meta.title || domDocumentTitle(site, ctx.document),
      createdAt: null,
      updatedAt: nowMs(),
      url: ctx.href,
      messages,
      totalMessages: messages.length,
      hiddenBranches: 0,
      warning,
      exportedAt: nowMs()
    };
  }

  function compareConversationList(a, b) {
    if (!!a.current !== !!b.current) return a.current ? -1 : 1;
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  }

  async function listConversations(ctx) {
    const site = siteFromUrl(ctx.href);
    if (!site) {
      fail("UNSUPPORTED", "当前页面不是受支持的 AI 网站", "请打开受支持的 AI 网页版后再读取。");
    }
    if (site.support === "current") return domCurrentList(site, ctx);
    try {
      if (site.id === "deepseek") return await deepSeekList(ctx);
      if (site.id === "kimi") return await kimiList(ctx);
      if (site.id === "chatgpt") return await chatGptList(ctx);
      if (site.id === "claude") return await claudeConversationList(ctx);
      if (site.id === "qwen") return qwenIsInternational(ctx) ? await qwenIntlList(ctx) : await qwenConversationList(ctx);
      if (site.id === "doubao") return await doubaoConversationList(ctx);
      if (site.id === "gemini") return await geminiConversationList(ctx);
    } catch (error) {
      if (error && (error.code === "AUTH" || error.code === "ABORTED" || error.code === "UNSUPPORTED")) throw error;
      const fallback = domCurrentList(site, ctx);
      fallback.warnings.unshift("读取 " + site.name + " 完整历史失败，已切换为当前页模式：" + (error && error.message || error));
      return fallback;
    }
    fail("UNSUPPORTED", "暂不支持这个网站", "这个站点尚未适配。");
  }

  async function fetchConversation(siteId, meta, ctx) {
    const site = siteById(siteId);
    if (!site) fail("UNSUPPORTED", "暂不支持这个网站", "");
    if (meta && meta.dom) return domConversation(site, meta, ctx);
    try {
      let conversation = null;
      if (siteId === "deepseek") conversation = await deepSeekConversation(meta, ctx);
      else if (siteId === "kimi") conversation = await kimiConversation(meta, ctx);
      else if (siteId === "chatgpt") conversation = await chatGptConversation(meta, ctx);
      else if (siteId === "claude") conversation = await claudeConversation(meta, ctx);
      else if (siteId === "qwen") conversation = qwenIsInternational(ctx) ? await qwenIntlConversation(meta, ctx) : await qwenConversation(meta, ctx);
      else if (siteId === "doubao") conversation = await doubaoConversation(meta, ctx);
      else if (siteId === "gemini") conversation = await geminiConversation(meta, ctx);
      if (!conversation) fail("UNSUPPORTED", "暂不支持这个网站的对话读取", "");
      const hasAssistant = Array.isArray(conversation.messages) && conversation.messages.some((m) => m.role === "assistant" && (m.text || m.thinking));
      if (!hasAssistant && site.currentId && meta && site.currentId(ctx.href) === meta.id) {
        try {
          const fallback = domConversation(site, meta, ctx);
          if (fallback.messages.some((m) => m.role === "assistant" && (m.text || m.thinking))) {
            fallback.warning = "网站接口没有返回模型回答，已从当前页面补全；" + (fallback.warning || "");
            return fallback;
          }
        } catch (e) { /* keep API result */ }
      }
      return conversation;
    } catch (error) {
      if (error && (error.code === "AUTH" || error.code === "ABORTED")) throw error;
      const fallbackSites = ["chatgpt", "claude", "gemini", "qwen", "doubao"];
      if (fallbackSites.includes(siteId) && site.currentId && meta && site.currentId(ctx.href) === meta.id) {
        try {
          const fallback = domConversation(site, meta, ctx);
          fallback.warning = "读取网站接口失败，已改为导出当前页面已加载的消息：" + (error && error.message || error);
          return fallback;
        } catch (domError) { /* 让原始错误继续抛出 */ }
      }
      throw error;
    }
  }

  function authHint(siteId, storage, document) {
    if (siteId === "deepseek") {
      const token = readWrappedString(getStorage(storage, "userToken"), ["value", "token"]);
      return { hasToken: token.length >= 20 };
    }
    if (siteId === "kimi") {
      return { hasToken: !!getKimiToken({ storage, document }) };
    }
    if (siteId === "chatgpt") {
      const token = chatGptToken({ storage });
      return { hasToken: !!token, sessionCookie: !!(document && document.cookie) };
    }
    if (siteId === "qwen") {
      return { hasToken: !!qwenToken({ storage, document }) };
    }
    if (["grok", "gemini", "wenxin", "hunyuan"].includes(siteId)) {
      return { hasToken: true, dom: true };
    }
    if (["claude", "doubao"].includes(siteId)) {
      return { hasToken: null, cookieAuth: true };
    }
    return { hasToken: null };
  }

  function roleLabel(role, siteName) {
    if (role === "user") return "用户";
    if (role === "system") return "系统";
    if (role === "tool") return "工具";
    return siteName || "AI";
  }

  const FORMATS = {
    txt: { id: "txt", name: "TXT", ext: ".txt", mime: "text/plain;charset=utf-8" },
    md: { id: "md", name: "Markdown", ext: ".md", mime: "text/markdown;charset=utf-8" },
    json: { id: "json", name: "JSON", ext: ".json", mime: "application/json;charset=utf-8" }
  };

  function normalizeFormat(format) {
    const value = String(format || "txt").toLowerCase();
    if (value === "markdown" || value === "md") return "md";
    if (value === "json") return "json";
    return "txt";
  }

  function formatInfo(format) {
    return FORMATS[normalizeFormat(format)] || FORMATS.txt;
  }

  function isoDate(value) {
    const ms = toMs(value);
    return ms ? new Date(ms).toISOString() : null;
  }

  function formatConversationTxt(conversation, options) {
    const opts = options || {};
    const includeThinking = opts.includeThinking !== false;
    const siteName = (SITES[conversation.site] && SITES[conversation.site].name) || "AI";
    const line = "=".repeat(64);
    const sub = "-".repeat(56);
    const out = [];
    out.push(line);
    out.push("标题：" + (conversation.title || "未命名对话"));
    out.push("来源：" + siteName);
    if (conversation.id) out.push("会话 ID：" + conversation.id);
    if (conversation.createdAt) out.push("创建时间：" + formatDate(conversation.createdAt, true));
    if (conversation.updatedAt) out.push("更新时间：" + formatDate(conversation.updatedAt, true));
    if (conversation.url) out.push("原始链接：" + conversation.url);
    out.push("消息数：" + (conversation.messages ? conversation.messages.length : 0));
    out.push("导出时间：" + formatDate(conversation.exportedAt || nowMs(), true));
    if (conversation.hiddenBranches > 0) {
      out.push("说明：原会话里有 " + conversation.hiddenBranches + " 条被编辑或重新生成替换的旧分支，默认只导出当前显示的分支。");
    }
    if (conversation.warning) out.push("提示：" + conversation.warning);
    out.push(line);
    out.push("");

    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    if (!messages.length) {
      out.push("（这条对话没有可导出的文字消息）");
      out.push("");
      return out.join("\n");
    }
    messages.forEach((message, index) => {
      const label = roleLabel(message.role, siteName);
      const time = message.createdAt ? "  " + formatDate(message.createdAt, true) : "";
      out.push("[" + label + "]" + time);
      out.push(sub);
      if (message.text) {
        out.push(message.text.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trimEnd());
      } else if (!message.thinking) {
        out.push("（这条消息没有文字内容）");
      }
      if (includeThinking && message.thinking) {
        out.push("");
        out.push("--- 思考过程 ---");
        out.push(message.thinking.replace(/\r\n/g, "\n").trim());
        out.push("--- 思考过程结束 ---");
      }
      if (message.attachments && message.attachments.length) {
        out.push("");
        out.push("附件：" + message.attachments.join("、"));
      }
      out.push("");
      if (index < messages.length - 1) out.push("");
    });
    return out.join("\n").replace(/\n{5,}/g, "\n\n\n\n");
  }

  function formatConversationMarkdown(conversation, options) {
    const opts = options || {};
    const includeThinking = opts.includeThinking !== false;
    const siteName = (SITES[conversation.site] && SITES[conversation.site].name) || "AI";
    const out = [];
    out.push("# " + (conversation.title || "未命名对话"));
    out.push("");
    out.push("> **来源：** " + siteName + "  ");
    if (conversation.id) out.push("> **会话 ID：** `" + conversation.id + "`  ");
    if (conversation.createdAt) out.push("> **创建时间：** " + formatDate(conversation.createdAt, true) + "  ");
    if (conversation.updatedAt) out.push("> **更新时间：** " + formatDate(conversation.updatedAt, true) + "  ");
    if (conversation.url) out.push("> **原始链接：** " + conversation.url + "  ");
    out.push("> **消息数：** " + (conversation.messages ? conversation.messages.length : 0) + "  ");
    out.push("> **导出时间：** " + formatDate(conversation.exportedAt || nowMs(), true) + "  ");
    if (conversation.hiddenBranches > 0) {
      out.push("> **说明：** " + conversation.hiddenBranches + " 条旧分支未导出。  ");
    }
    if (conversation.warning) out.push("> **提示：** " + conversation.warning + "  ");
    out.push("");
    out.push("---");
    out.push("");

    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    if (!messages.length) {
      out.push("_（这条对话没有可导出的文字消息）_");
      out.push("");
      return out.join("\n");
    }
    messages.forEach((message) => {
      const label = roleLabel(message.role, siteName);
      out.push("## " + label);
      if (message.createdAt) {
        out.push("");
        out.push("_`" + formatDate(message.createdAt, true) + "`_");
      }
      out.push("");
      if (message.text) {
        out.push(message.text.replace(/\r\n/g, "\n").trim());
      } else if (!message.thinking) {
        out.push("_（这条消息没有文字内容）_");
      }
      if (includeThinking && message.thinking) {
        out.push("");
        out.push("### 思考过程");
        out.push("");
        out.push(message.thinking.replace(/\r\n/g, "\n").trim());
      }
      if (message.attachments && message.attachments.length) {
        out.push("");
        out.push("**附件：**");
        for (const name of message.attachments) out.push("- " + name);
      }
      out.push("");
      out.push("---");
      out.push("");
    });
    return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
  }

  function conversationJsonObject(conversation, options) {
    const opts = options || {};
    const site = SITES[conversation.site] || {};
    const includeThinking = opts.includeThinking !== false;
    const messages = (Array.isArray(conversation.messages) ? conversation.messages : []).map((message) => {
      const item = {
        id: message.id || null,
        role: message.role || "assistant",
        created_at: isoDate(message.createdAt),
        text: message.text || ""
      };
      if (includeThinking && message.thinking) item.thinking = message.thinking;
      if (message.search) item.search = message.search;
      if (message.attachments && message.attachments.length) item.attachments = message.attachments;
      if (message.status) item.status = message.status;
      return item;
    });
    return {
      id: conversation.id || null,
      title: conversation.title || "未命名对话",
      source: {
        id: conversation.site || null,
        name: site.name || "AI"
      },
      url: conversation.url || null,
      created_at: isoDate(conversation.createdAt),
      updated_at: isoDate(conversation.updatedAt),
      exported_at: isoDate(conversation.exportedAt || opts.exportedAt || nowMs()),
      message_count: messages.length,
      hidden_branches: conversation.hiddenBranches || 0,
      warning: conversation.warning || null,
      messages
    };
  }

  function formatConversationJson(conversation, options) {
    const obj = {
      schema: "aiexport.conversation.v1",
      conversation: conversationJsonObject(conversation, options)
    };
    return JSON.stringify(obj, null, 2) + "\n";
  }

  function formatConversationByFormat(conversation, options, format) {
    const fmt = normalizeFormat(format || (options && options.format));
    if (fmt === "md") return formatConversationMarkdown(conversation, options);
    if (fmt === "json") return formatConversationJson(conversation, options);
    return formatConversationTxt(conversation, options);
  }

  function formatConversation(conversation, options) {
    return formatConversationByFormat(conversation, options, options && options.format);
  }

  function buildCombinedText(conversations, options) {
    const opts = options || {};
    const site = conversations.length ? (SITES[conversations[0].site] || {}).name || "AI" : "AI";
    const line = "=".repeat(64);
    const out = [];
    out.push(line);
    out.push("AI 对话导出");
    out.push("来源：" + site);
    out.push("导出时间：" + formatDate(opts.exportedAt || nowMs(), true));
    out.push("会话数量：" + conversations.length);
    out.push("格式：UTF-8 纯文本（.txt）");
    out.push(line);
    out.push("");
    out.push("目录");
    conversations.forEach((c, i) => {
      out.push(String(i + 1).padStart(3, "0") + "  " + (c.title || "未命名对话") +
        (c.updatedAt ? "  （" + formatDate(c.updatedAt, true) + "）" : ""));
    });
    out.push("");
    out.push("");
    conversations.forEach((c, i) => {
      out.push("");
      out.push("##########  对话 " + (i + 1) + " / " + conversations.length + "  ##########");
      out.push("");
      out.push(formatConversationTxt(c, opts));
      out.push("");
    });
    return out.join("\n").replace(/\n{5,}/g, "\n\n\n\n").trimEnd() + "\n";
  }

  function buildCombinedMarkdown(conversations, options) {
    const opts = options || {};
    const site = conversations.length ? (SITES[conversations[0].site] || {}).name || "AI" : "AI";
    const out = [];
    out.push("# AI 对话导出");
    out.push("");
    out.push("> **来源：** " + site + "  ");
    out.push("> **导出时间：** " + formatDate(opts.exportedAt || nowMs(), true) + "  ");
    out.push("> **会话数量：** " + conversations.length + "  ");
    out.push("> **格式：** Markdown（.md）");
    out.push("");
    out.push("## 目录");
    out.push("");
    conversations.forEach((c, i) => {
      out.push("- " + String(i + 1).padStart(3, "0") + " · " + (c.title || "未命名对话") +
        (c.updatedAt ? " · " + formatDate(c.updatedAt, true) : ""));
    });
    out.push("");
    conversations.forEach((c, i) => {
      out.push("");
      out.push("---");
      out.push("");
      out.push("## " + String(i + 1).padStart(3, "0") + ". " + (c.title || "未命名对话"));
      out.push("");
      out.push(formatConversationMarkdown(c, opts));
    });
    return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
  }

  function buildCombinedJson(conversations, options) {
    const opts = options || {};
    const site = conversations.length ? (SITES[conversations[0].site] || {}).name || "AI" : "AI";
    const payload = {
      schema: "aiexport.bundle.v1",
      exported_at: isoDate(opts.exportedAt || nowMs()),
      source: {
        name: site,
        ids: Array.from(new Set(conversations.map((c) => c.site).filter(Boolean)))
      },
      conversation_count: conversations.length,
      conversations: conversations.map((c) => conversationJsonObject(c, opts))
    };
    return JSON.stringify(payload, null, 2) + "\n";
  }

  function buildCombinedByFormat(conversations, options, format) {
    const fmt = normalizeFormat(format || (options && options.format));
    if (fmt === "md") return buildCombinedMarkdown(conversations, options);
    if (fmt === "json") return buildCombinedJson(conversations, options);
    return buildCombinedText(conversations, options);
  }

  function buildConversationFilename(conversation, index, options, format) {
    const opts = options || {};
    const fmt = normalizeFormat(format || opts.format);
    const prefix = String(index + 1).padStart(3, "0");
    const title = safeFilename(conversation.title || "未命名对话", 62);
    let date = "";
    if (opts.includeDate !== false) {
      const ts = conversation.updatedAt || conversation.createdAt || opts.exportedAt || nowMs();
      date = formatDay(ts) ? formatDay(ts) + "_" : "";
    }
    return prefix + "_" + date + title + formatInfo(fmt).ext;
  }

  function buildArchiveBase(conversation, index, options, format) {
    return buildConversationFilename(conversation, index, options, format).replace(/\.[a-z0-9]+$/i, "");
  }

  function createTextBlob(text, withBom) {
    const payload = (withBom ? "\uFEFF" : "") + normalizeNewlines(text);
    return new Blob([payload], { type: "text/plain;charset=utf-8" });
  }

  function createFormatBlob(text, format, withBom) {
    const fmt = normalizeFormat(format);
    if (fmt === "json") {
      return new Blob([String(text || "")], { type: FORMATS.json.mime });
    }
    if (fmt === "md") {
      return new Blob([(withBom ? "\uFEFF" : "") + normalizeNewlines(text)], { type: FORMATS.md.mime });
    }
    return createTextBlob(text, withBom);
  }

  function normalizeNewlines(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n/g, "\r\n");
  }
  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = (CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const d = date || new Date();
    const year = Math.max(1980, d.getFullYear());
    return {
      date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
    };
  }

  function utf8Bytes(text) {
    return new TextEncoder().encode(text);
  }

  function createZip(entries) {
    const files = entries || [];
    if (!files.length) fail("EMPTY", "没有可打包的文件", "请先选择至少一条对话。");
    if (files.length > 60000) fail("TOO_MANY", "文件数量过多", "请分批导出。");
    const d = dosDateTime(new Date());
    const parts = [];
    const central = [];
    let offset = 0;
    for (const entry of files) {
      const name = String(entry.name || "对话.txt").replace(/\\/g, "/").replace(/^\/+/, "");
      const nameBytes = utf8Bytes(name);
      const data = entry.data instanceof Uint8Array ? entry.data : utf8Bytes(entry.data || "");
      if (data.length > 0xffffffff) fail("TOO_LARGE", "单个文件超过 4GB，无法打包", "请分批导出。");
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, d.time, true);
      lv.setUint16(12, d.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      parts.push(local, data);

      const cen = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, d.time, true);
      cv.setUint16(14, d.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cen.set(nameBytes, 46);
      central.push(cen);
      offset += local.length + data.length;
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [end]), { type: "application/zip" });
  }

  function buildArchiveEntries(conversations, options) {
    const opts = options || {};
    const fmt = normalizeFormat(opts.format);
    const used = new Set();
    const baseIndex = Number(opts.baseIndex) || 0;
    return conversations.map((conversation, index) => {
      const name = uniqueName(buildConversationFilename(conversation, baseIndex + index, opts, fmt), used);
      let text = formatConversationByFormat(conversation, opts, fmt) + "\n";
      let payload = text;
      if (fmt === "txt" || fmt === "md") {
        payload = (opts.withBom ? "\uFEFF" : "") + normalizeNewlines(text);
      }
      return { name, data: utf8Bytes(payload) };
    });
  }

  function buildSingleArchive(conversations, options) {
    const opts = options || {};
    const fmt = normalizeFormat(opts.format);
    const text = buildCombinedByFormat(conversations, opts, fmt);
    const site = conversations.length ? (SITES[conversations[0].site] || {}).name || "AI" : "AI";
    const stamp = nowStamp();
    return {
      filename: safeFilename("AI对话导出_" + site + "_" + conversations.length + "条_" + stamp, 100) + formatInfo(fmt).ext,
      blob: createFormatBlob(text, fmt, opts.withBom !== false)
    };
  }

  function buildSingleConversationExport(conversation, options) {
    const opts = options || {};
    const fmt = normalizeFormat(opts.format);
    const text = formatConversationByFormat(conversation, opts, fmt) + "\n";
    const filename = buildConversationFilename(conversation, opts.index || 0, opts, fmt);
    return { filename, blob: createFormatBlob(text, fmt, opts.withBom !== false) };
  }

  function buildTextArchiveEntries(conversations, options) {
    return buildArchiveEntries(conversations, Object.assign({}, options, { format: "txt" }));
  }

  function buildSingleTextArchive(conversations, options) {
    return buildSingleArchive(conversations, Object.assign({}, options, { format: "txt" }));
  }

  function buildSingleConversationText(conversation, options) {
    return buildSingleConversationExport(conversation, Object.assign({}, options, { format: "txt" }));
  }

  function downloadPath(site, filename, folder) {
    const siteName = (SITES[site] && SITES[site].name) || "AI";
    if (folder) return "AI对话导出/" + safeFilename(siteName, 30) + "/" + safeFilename(folder, 80) + "/" + filename;
    return "AI对话导出/" + safeFilename(siteName, 30) + "/" + filename;
  }

  return {
    VERSION,
    SITES,
    AIExportError,
    serializeError,
    isAbort,
    siteFromUrl,
    siteById,
    toMs,
    formatDate,
    formatDay,
    nowStamp,
    formatFileTime,
    safeFilename,
    uniqueName,
    listConversations,
    fetchConversation,
    authHint,
    FORMATS,
    normalizeFormat,
    formatInfo,
    formatConversation,
    formatConversationByFormat,
    formatConversationMarkdown,
    formatConversationJson,
    buildCombinedText,
    buildCombinedMarkdown,
    buildCombinedJson,
    buildCombinedByFormat,
    buildConversationFilename,
    buildArchiveBase,
    createTextBlob,
    createFormatBlob,
    createZip,
    buildArchiveEntries,
    buildTextArchiveEntries,
    buildSingleArchive,
    buildSingleTextArchive,
    buildSingleConversationExport,
    buildSingleConversationText,
    downloadPath,
    normalizeNewlines,
    async testHooks() { return { SITES }; }
  };
});
