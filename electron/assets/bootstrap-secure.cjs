"use strict";

// Password security must register before browser windows/webviews are created.
// The actual implementation lives in assets so both Voxar.app and the
// standalone VoxarioBrowser package receive exactly the same hardened vault.
require("./browser-password-security.cjs").installBrowserPasswordSecurity();

// Resource monitor must also register before browser windows/webviews are
// created so active-tab CPU/RAM/GPU/network accounting is available from the
// first navigation. It only observes the dedicated persist:voxario session.
require("./browser-resource-monitor.cjs").installBrowserResourceMonitor();

// Load the regular desktop bootstrap next. That registers browser-settings.cjs
// and the rest of the application lifecycle.
require("../bootstrap-utf8.cjs");

// Finally replace the obsolete password IPC after browser-settings has
// registered it. This makes old builds fail closed instead of exposing the
// legacy reveal path without Windows verification.
require("./browser-password-legacy-lockdown.cjs").installLegacyPasswordLockdown();
