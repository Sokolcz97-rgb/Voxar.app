"use strict";

// Recover the encrypted Secure Vault before the password manager resolves its
// profile paths. This keeps AES-GCM + DPAPI data durable across installer/update
// transitions without ever exporting plaintext credentials.
require("./browser-profile-recovery.cjs").installBrowserProfileRecovery();

// Install commerce compatibility before browser-settings registers session
// filters. This preserves same-site cart updates, trusted payment/pickup widgets
// and real popup semantics while keeping unsafe external schemes user-confirmed.
require("./browser-commerce-compat.cjs").installBrowserCommerceCompatibility();

// Password security must register before browser windows/webviews are created.
// The actual implementation lives in assets so both Voxar.app and the
// standalone VoxarioBrowser package receive exactly the same hardened vault.
require("./browser-password-security.cjs").installBrowserPasswordSecurity();

// Resource monitor must also register before browser windows/webviews are
// created so active-tab CPU/RAM/GPU/network accounting is available from the
// first navigation. It only observes the dedicated persist:voxario session.
require("./browser-resource-monitor.cjs").installBrowserResourceMonitor();

// Keep browser chrome sizing independent from the resource monitor. This only
// compacts the native VoxarioBrowser shell and keeps the new-tab button visible;
// loaded web pages are never zoomed or restyled by this module.
require("./browser-chrome-fit.cjs").installBrowserChromeFit();

// Load the regular desktop bootstrap next. That registers browser-settings.cjs
// and the rest of the application lifecycle.
require("../bootstrap-utf8.cjs");

// Finally replace the obsolete password IPC after browser-settings has
// registered it. This makes old builds fail closed instead of exposing the
// legacy reveal path without Windows verification.
require("./browser-password-legacy-lockdown.cjs").installLegacyPasswordLockdown();
