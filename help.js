/* 使用说明页 — 版本号与安装欢迎条 */
(function () {
  "use strict";
  function boot() {
    var version = document.getElementById("versionLabel");
    if (version) version.textContent = "v" + (window.AIExportCore ? window.AIExportCore.VERSION : "1.0.0");
    if (new URLSearchParams(location.search).get("welcome") === "1") {
      var banner = document.getElementById("welcomeBanner");
      if (banner) banner.hidden = false;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
