"use strict";

let installed = false;

function browserChromeFitRenderer() {
  if (document.getElementById("voxario-browser-chrome-fit-style")) return;

  const style = document.createElement("style");
  style.id = "voxario-browser-chrome-fit-style";
  style.textContent = `
    /* Compact only the native browser chrome; loaded web pages stay at 100% zoom. */
    .navbar{
      height:46px!important;
      min-height:46px!important;
      gap:5px!important;
      padding:5px 12px!important;
    }
    .navbtn{
      width:32px!important;
      height:32px!important;
      flex:0 0 32px!important;
      font-size:16px!important;
    }
    .urlwrap{
      height:34px!important;
      min-width:0!important;
      margin-left:8px!important;
      padding:0 10px!important;
      gap:6px!important;
    }
    .urlwrap .lock{width:18px!important;font-size:13px!important}
    #url{min-width:0!important;font-size:12px!important}
    .avatar-button{
      width:34px!important;
      height:34px!important;
      flex-basis:34px!important;
    }

    /* Keep + next to the tab strip, but sticky before the Windows controls when tabs overflow. */
    .tabbar{padding-right:116px!important}
    .newtab{
      position:sticky!important;
      right:112px!important;
      bottom:auto!important;
      z-index:7!important;
      width:36px!important;
      height:40px!important;
      flex:0 0 36px!important;
      margin-left:1px!important;
      padding:0!important;
      border:1px solid rgba(49,144,176,.2)!important;
      background:linear-gradient(90deg,rgba(2,16,30,.98),rgba(3,24,42,.98))!important;
      font-size:20px!important;
    }
    .newtab:hover{border-color:rgba(42,218,246,.55)!important;background:rgba(6,48,70,.98)!important}
    .wctl{z-index:9!important}

    /* Navbar is 10px shorter, so dependent overlays follow the new geometry. */
    .dock{top:95px!important}
    .prog{top:133px!important}
    .status{top:98px!important}

    /* Make the live resource HUD give space back to the address field sooner. */
    @media(max-width:1500px){
      #vbResourceHud{gap:3px!important}
      #vbResourceHud .vb-r{min-width:42px!important;height:22px!important;padding:0 4px!important}
      #vbResourceHud .vb-r span{display:none!important}
    }
    @media(max-width:1120px){
      .navbar{padding-left:9px!important;padding-right:9px!important;gap:4px!important}
      .urlwrap{margin-left:4px!important}
    }
  `;
  document.head.appendChild(style);
}

function installBrowserChromeFit() {
  if (installed) return;
  installed = true;
  const { app } = require("electron");

  app.on("browser-window-created", (_event, win) => {
    const inject = () => {
      let url = "";
      try { url = win.webContents.getURL() || ""; } catch {}
      if (!/browser\.html(?:$|[?#])/i.test(url)) return;
      win.webContents.executeJavaScript(`(${browserChromeFitRenderer.toString()})()`, true).catch(() => {});
    };

    win.webContents.on("did-finish-load", inject);
    win.webContents.on("dom-ready", inject);
    setTimeout(inject, 700).unref?.();
  });
}

module.exports = {
  installBrowserChromeFit,
  browserChromeFitRenderer,
};
