// Desktop bootstrap keeps optional native services separate from the main window lifecycle.
const rtmp = require("./rtmp.cjs");
rtmp.registerRtmpHandlers();
require("./main.cjs");
