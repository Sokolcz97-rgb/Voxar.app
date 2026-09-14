"use strict";

// Password security must register before browser windows/webviews are created.
// The actual implementation lives in assets so both Voxar.app and the
// standalone VoxarioBrowser package receive exactly the same hardened vault.
require("./browser-password-security.cjs").installBrowserPasswordSecurity();
require("../bootstrap-utf8.cjs");
