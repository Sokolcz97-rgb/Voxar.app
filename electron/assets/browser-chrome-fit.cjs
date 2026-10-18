"use strict";

let installed = false;

function browserChromeFitRenderer() {
  if (document.getElementById("voxario-browser-chrome-fit-style")) return;

  const style = document.createElement("style");
  style.id = "voxario-browser-chrome-fit-style";
  style.textContent = `
    /* Rozměry lišt podle předlohy VoxarioBrowseru (okno 1672 × 941).
       Načtené weby zůstávají na 100 % zoomu. */
    .navbar{
      height:54px!important;
      min-height:54px!important;
      gap:12px!important;
      padding:6px 16px 6px 20px!important;
    }
    .navbtn{
      width:40px!important;
      height:40px!important;
      flex:0 0 40px!important;
      font-size:20px!important;
    }
    .urlwrap{
      height:42px!important;
      min-width:0!important;
      margin-left:14px!important;
      padding:0 16px!important;
      gap:10px!important;
    }
    .urlwrap .lock{width:22px!important;font-size:16px!important}
    #url{min-width:0!important;font-size:15px!important}
    .avatar-button{
      width:42px!important;
      height:42px!important;
      flex-basis:42px!important;
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

    /* Navazující prvky sledují výšku lišt (karty 50 + adresa 54 + záložky 36). */
    .dock{top:104px!important}
    .prog{top:140px!important}
    .status{top:108px!important}

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
