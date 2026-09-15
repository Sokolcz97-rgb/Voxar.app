"use strict";

const PARTITION = "persist:voxario";

const COMMERCE_SERVICE_HOSTS = Object.freeze([
  "packeta.com",
  "zasilkovna.cz",
  "gopay.com",
  "gopay.cz",
  "comgate.cz",
  "gpwebpay.com",
  "globalpayments.com",
  "stripe.com",
  "stripe.network",
  "paypal.com",
  "paypalobjects.com",
  "adyen.com",
  "payu.com",
  "payu.cz",
  "klarna.com",
  "twisto.cz",
]);

const AUTH_HOSTS = Object.freeze([
  "accounts.google.com",
  "login.microsoftonline.com",
  "login.live.com",
  "appleid.apple.com",
  "github.com",
  "facebook.com",
  "discord.com",
  "seznam.cz",
]);

const TRANSACTION_RE = /(?:^|[\/_?&=#.-])(cart|basket|bag|kosik|košík|checkout|order|objednav|payment|pay|platba|delivery|doprava|pickup|vydej|výdej|zasilk|zásilk)(?:$|[\/_?&=#.-])/i;
const POPUP_NAME_RE = /(oauth|login|signin|auth|payment|checkout|3ds|secure|gateway|pickup|packeta|zasilk)/i;
const POPUP_FEATURE_RE = /(?:^|,|\s)(?:popup\s*=|width\s*=|height\s*=)/i;
const SAFE_WEB_PROTOCOLS = new Set(["http:", "https:"]);
const BLOCKED_POPUP_PROTOCOLS = new Set(["javascript:", "data:", "file:", "vbscript:", "about:", "chrome:"]);

function parseUrl(value) {
  try { return new URL(String(value || "")); } catch { return null; }
}

function hostnameMatches(hostname, allowed) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  const base = String(allowed || "").toLowerCase().replace(/^\./, "").replace(/\.$/, "");
  return Boolean(host && base && (host === base || host.endsWith(`.${base}`)));
}

function hostInList(url, list) {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  return list.some((host) => hostnameMatches(parsed.hostname, host));
}

function isCommerceServiceUrl(url) {
  return hostInList(url, COMMERCE_SERVICE_HOSTS);
}

function isAuthUrl(url) {
  return hostInList(url, AUTH_HOSTS);
}

function registrableHost(value) {
  const parsed = parseUrl(value);
  if (!parsed) return "";
  const parts = parsed.hostname.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  // Practical compatibility helper, not a security boundary. Known commerce
  // providers are matched by exact/suffix host above.
  return parts.slice(-2).join(".");
}

function isSameSite(a, b) {
  const left = registrableHost(a);
  const right = registrableHost(b);
  return Boolean(left && right && left === right);
}

function isTransactionalUrl(url) {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  return TRANSACTION_RE.test(`${parsed.pathname}${parsed.search}${parsed.hash}`);
}

function requestPageUrl(details, webContentsApi) {
  try {
    if (details?.webContentsId && webContentsApi?.fromId) {
      const live = webContentsApi.fromId(Number(details.webContentsId))?.getURL?.();
      if (live) return live;
    }
  } catch {}
  return String(details?.referrer || "");
}

function shouldRestoreCanceledRequest(details, pageUrl = "") {
  const target = String(details?.url || "");
  if (!/^https?:/i.test(target)) return false;
  if (isCommerceServiceUrl(target)) return true;
  if (details?.resourceType === "mainFrame") return false;
  return isSameSite(target, pageUrl);
}

function popupDecision({ url, openerUrl = "", frameName = "", features = "", disposition = "", postBody = null } = {}) {
  const parsed = parseUrl(url);
  if (!parsed) return "deny";
  if (BLOCKED_POPUP_PROTOCOLS.has(parsed.protocol)) return "deny";
  if (!SAFE_WEB_PROTOCOLS.has(parsed.protocol)) return "external-confirm";
  if (parsed.protocol !== "https:" && (isCommerceServiceUrl(url) || isAuthUrl(url))) return "deny";

  const crossSite = openerUrl ? !isSameSite(url, openerUrl) : false;
  const transactional = isTransactionalUrl(openerUrl) || isTransactionalUrl(url);
  const preservePopup =
    isCommerceServiceUrl(url) ||
    isAuthUrl(url) ||
    POPUP_NAME_RE.test(String(frameName || "")) ||
    POPUP_FEATURE_RE.test(String(features || "")) ||
    String(disposition || "").toLowerCase() === "new-window" ||
    Boolean(postBody) ||
    (transactional && crossSite);
  return preservePopup ? "popup" : "tab";
}

function wrapWebRequestMethod(webRequest, method, transform) {
  const original = webRequest?.[method];
  if (typeof original !== "function" || original.__voxarioCommerceWrapped) return;
  function wrapped(filter, listener) {
    if (typeof listener !== "function") return original.call(this, filter, listener);
    const adapted = (details, callback) => {
      const once = (result = {}) => {
        let output = result || {};
        try { output = transform(details, output) || output; } catch {}
        callback(output);
      };
      return listener(details, once);
    };
    return original.call(this, filter, adapted);
  }
  wrapped.__voxarioCommerceWrapped = true;
  wrapped.__voxarioCommerceOriginal = original;
  webRequest[method] = wrapped;
}

function patchCommerceWebRequest(ses, webContentsApi) {
  const webRequest = ses?.webRequest;
  if (!webRequest || webRequest.__voxarioCommerceCompatV1) return;
  webRequest.__voxarioCommerceCompatV1 = true;

  wrapWebRequestMethod(webRequest, "onBeforeRequest", (details, result) => {
    if (!result?.cancel) return result;
    const pageUrl = requestPageUrl(details, webContentsApi);
    return shouldRestoreCanceledRequest(details, pageUrl) ? { ...result, cancel: false } : result;
  });

  wrapWebRequestMethod(webRequest, "onBeforeSendHeaders", (details, result) => {
    const pageUrl = requestPageUrl(details, webContentsApi);
    if (!isCommerceServiceUrl(details?.url) && !isSameSite(details?.url, pageUrl)) return result;
    const originalHeaders = details?.requestHeaders || {};
    const nextHeaders = { ...(result?.requestHeaders || originalHeaders) };
    for (const [name, value] of Object.entries(originalHeaders)) {
      if (name.toLowerCase() === "cookie") nextHeaders[name] = value;
    }
    return { ...result, requestHeaders: nextHeaders };
  });

  wrapWebRequestMethod(webRequest, "onHeadersReceived", (details, result) => {
    const pageUrl = requestPageUrl(details, webContentsApi);
    if (!isCommerceServiceUrl(details?.url) && !isSameSite(details?.url, pageUrl)) return result;
    const originalHeaders = details?.responseHeaders || {};
    const nextHeaders = { ...(result?.responseHeaders || originalHeaders) };
    for (const [name, value] of Object.entries(originalHeaders)) {
      if (name.toLowerCase() === "set-cookie") nextHeaders[name] = value;
    }
    return { ...result, responseHeaders: nextHeaders };
  });
}

function installPermissionCompatibility(ses, dialog, BrowserWindow) {
  if (!ses || ses.__voxarioCommercePermissionsV1) return;
  ses.__voxarioCommercePermissionsV1 = true;
  const alwaysAllowed = new Set(["fullscreen", "clipboard-sanitized-write"]);
  const promptPermissions = new Set(["geolocation", "media", "notifications"]);

  try {
    ses.setPermissionCheckHandler((_wc, permission) => alwaysAllowed.has(permission) || promptPermissions.has(permission));
  } catch {}
  try {
    ses.setPermissionRequestHandler((wc, permission, callback, details) => {
      if (alwaysAllowed.has(permission)) return callback(true);
      if (!promptPermissions.has(permission)) return callback(false);
      let requestingUrl = "";
      try { requestingUrl = details?.requestingUrl || wc?.getURL?.() || ""; } catch {}
      const parsed = parseUrl(requestingUrl);
      if (!parsed || parsed.protocol !== "https:") return callback(false);
      const label = permission === "geolocation" ? "polohu" : permission === "media" ? "kameru nebo mikrofon" : "oznámení";
      const parent = BrowserWindow?.fromWebContents?.(wc) || BrowserWindow?.getFocusedWindow?.() || undefined;
      Promise.resolve(dialog.showMessageBox(parent, {
        type: "question",
        title: "Oprávnění webu",
        message: `${parsed.hostname} žádá o ${label}.`,
        detail: "Povol jen tehdy, když tuto funkci právě očekáváš. Platební údaje ani hesla tímto oprávněním webu nezpřístupňujeme.",
        buttons: ["Povolit jednou", "Zamítnout"],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      })).then((answer) => callback(answer?.response === 0)).catch(() => callback(false));
    });
  } catch {}
}

function browserShellTracker() {
  if (window.__voxarioCommerceActiveTrackerV1) return;
  window.__voxarioCommerceActiveTrackerV1 = true;
  const { ipcRenderer } = require("electron");
  let previous = -1;
  const report = () => {
    let id = 0;
    for (const wv of document.querySelectorAll("webview")) {
      try {
        const visible = wv.style.display !== "none" && getComputedStyle(wv).display !== "none";
        if (visible) { id = Number(wv.getWebContentsId?.()) || 0; break; }
      } catch {}
    }
    if (id && id !== previous) {
      previous = id;
      ipcRenderer.send("vb:active-webview", id);
    }
  };
  const observer = new MutationObserver(report);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"] });
  const timer = setInterval(report, 700);
  timer.unref?.();
  document.addEventListener("visibilitychange", report);
  window.addEventListener("beforeunload", () => { clearInterval(timer); observer.disconnect(); }, { once: true });
  report();
}

function configurePopupHandler(contents, ownerWindow, electron) {
  if (!contents || contents.isDestroyed?.()) return;
  try { contents.setBackgroundThrottling?.(false); } catch {}
  try {
    contents.setWindowOpenHandler((details) => {
      let openerUrl = "";
      try { openerUrl = contents.getURL?.() || ""; } catch {}
      const decision = popupDecision({ ...details, openerUrl });
      if (decision === "deny") return { action: "deny" };
      if (decision === "external-confirm") {
        const target = String(details?.url || "");
        const parsed = parseUrl(target);
        setImmediate(async () => {
          if (!parsed) return;
          try {
            const result = await electron.dialog.showMessageBox(ownerWindow && !ownerWindow.isDestroyed?.() ? ownerWindow : undefined, {
              type: "warning",
              title: "Otevřít externí platební aplikaci?",
              message: `Web chce otevřít externí aplikaci (${parsed.protocol.replace(":", "")}).`,
              detail: "Pokračuj jen pokud jsi tuto akci sám vyvolal. VoxarioBrowser nikdy nepotvrdí platbu ani externí aplikaci automaticky.",
              buttons: ["Zrušit", "Otevřít aplikaci"],
              defaultId: 0,
              cancelId: 0,
              noLink: true,
            });
            if (result.response === 1) await electron.shell.openExternal(target);
          } catch {}
        });
        return { action: "deny" };
      }
      if (decision === "tab") {
        try { ownerWindow?.webContents?.send("browser:open-tab", details.url); } catch {}
        return { action: "deny" };
      }
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: /payment|checkout|3ds|secure|gateway/i.test(`${details?.frameName || ""} ${details?.url || ""}`) ? 620 : 560,
          height: 740,
          autoHideMenuBar: true,
          backgroundColor: "#0b0f18",
          parent: ownerWindow && !ownerWindow.isDestroyed?.() ? ownerWindow : undefined,
          webPreferences: {
            partition: PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
          },
        },
      };
    });
  } catch {}
}

function installBrowserCommerceCompatibility() {
  if (global.__VOXARIO_BROWSER_COMMERCE_COMPAT_V1__) return;
  global.__VOXARIO_BROWSER_COMMERCE_COMPAT_V1__ = true;
  const electron = require("electron");
  const { app, ipcMain, session, webContents, dialog, BrowserWindow } = electron;
  const knownWebviews = new Map();

  ipcMain.on("vb:active-webview", (_event, rawId) => {
    const activeId = Number(rawId) || 0;
    for (const [id, contents] of knownWebviews) {
      if (!contents || contents.isDestroyed?.()) { knownWebviews.delete(id); continue; }
      try { contents.setBackgroundThrottling?.(id !== activeId); } catch {}
    }
  });

  app.whenReady().then(() => {
    const ses = session.fromPartition(PARTITION);
    patchCommerceWebRequest(ses, webContents);
    installPermissionCompatibility(ses, dialog, BrowserWindow);
  }).catch(() => {});

  app.on("browser-window-created", (_event, win) => {
    const injectTracker = () => {
      let url = "";
      try { url = win.webContents.getURL() || ""; } catch {}
      if (!/browser\.html(?:$|[?#])/i.test(url)) return;
      win.webContents.executeJavaScript(`(${browserShellTracker.toString()})()`, true).catch(() => {});
    };
    win.webContents.on("did-finish-load", injectTracker);
    win.webContents.on("did-attach-webview", (_e, contents) => {
      const id = Number(contents?.id) || 0;
      if (id) knownWebviews.set(id, contents);
      contents?.once?.("destroyed", () => knownWebviews.delete(id));
      // main.cjs also has a legacy popup handler. Run after all synchronous
      // did-attach listeners so this hardened compatibility policy is final.
      setImmediate(() => configurePopupHandler(contents, win, electron));
    });
    setTimeout(injectTracker, 800).unref?.();
  });
}

module.exports = {
  PARTITION,
  COMMERCE_SERVICE_HOSTS,
  hostnameMatches,
  isCommerceServiceUrl,
  isTransactionalUrl,
  isSameSite,
  shouldRestoreCanceledRequest,
  popupDecision,
  installBrowserCommerceCompatibility,
};
