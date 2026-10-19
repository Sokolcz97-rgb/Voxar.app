"use strict";

// Most mezi webovou hrou (studiovoxario.com/hra) a herním oknem launcheru.
// Hra díky němu pozná, že běží v aplikaci, a může přepnout režim zobrazení
// nebo se ukončit zpět do launcheru místo otevření webu.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ashesDesktop", {
  isDesktop: true,
  platform: process.platform,
  /** Zavře herní okno a vrátí hráče do launcheru. */
  exit: () => ipcRenderer.invoke("game:exit"),
  /** mode: "windowed" | "maximized" | "fullscreen"; width/height jen pro okno. */
  setDisplay: (options) => ipcRenderer.invoke("game:display:set", options),
  getDisplay: () => ipcRenderer.invoke("game:display:get")
});
