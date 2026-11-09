/* AI 对话导出助手 — 后台入口 */
const DASHBOARD_PATH = "dashboard.html";
const HELP_PATH = "help.html";

async function openDashboard() {
  const url = chrome.runtime.getURL(DASHBOARD_PATH);
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url && tab.url.startsWith(url));
  if (existing && existing.id) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
}

chrome.action.onClicked.addListener(() => {
  openDashboard().catch((error) => console.error("打开工作台失败", error));
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL(HELP_PATH + "?welcome=1") });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.source !== "aiexport-ui") return false;
  if (message.type === "AIEXPORT_OPEN_DASHBOARD") {
    openDashboard()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error && error.message || error) }));
    return true;
  }
  return false;
});
