const { ipcMain } = require("electron");
const { spawn } = require("child_process");

let ffmpegPath = null;
try {
  ffmpegPath = require("ffmpeg-static");
} catch (error) {
  console.warn("[rtmp] ffmpeg-static není dostupný", error?.message || error);
}

let sessions = [];
let state = { active: false, startedAt: null, destinations: [], error: null };

function safeSend(sender, channel, payload) {
  try {
    if (sender && !sender.isDestroyed?.()) sender.send(channel, payload);
  } catch {}
}

// immediate = true se používá při ukončení aplikace / aktualizaci. Odložený
// (unref) SIGKILL by se při quitu už nemusel spustit a FFmpeg by dál držel
// soubory v resources/app.asar.unpacked → NSIS update pak hlásí kód 2.
// Při běžném "Stop" streamu necháme FFmpeg 1,2 s na korektní ukončení FLV.
function stopProcesses({ immediate = false } = {}) {
  const activeSessions = sessions.slice();
  sessions = [];
  for (const session of activeSessions) {
    try { session.proc.stdin?.end(); } catch {}
    if (immediate) {
      try { if (!session.proc.killed) session.proc.kill("SIGKILL"); } catch {}
      continue;
    }
    try {
      setTimeout(() => {
        try { if (!session.proc.killed) session.proc.kill("SIGKILL"); } catch {}
      }, 1200).unref?.();
    } catch {}
  }
  state = { active: false, startedAt: null, destinations: [], error: null };
}

function destinationArgs(config, destination) {
  const bitrate = Math.max(1200, Math.min(16000, Number(config.videoBitrate) || 6000));
  const fps = Math.max(24, Math.min(60, Number(config.fps) || 30));
  const gop = fps * 2;
  return [
    "-hide_banner",
    "-loglevel", "warning",
    "-fflags", "+genpts+nobuffer",
    "-flags", "low_delay",
    "-f", "webm",
    "-i", "pipe:0",
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-r", String(fps),
    "-g", String(gop),
    "-keyint_min", String(gop),
    "-b:v", `${bitrate}k`,
    "-maxrate", `${bitrate}k`,
    "-bufsize", `${bitrate * 2}k`,
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "48000",
    "-ac", "2",
    "-f", "flv",
    destination.url,
  ];
}

function registerRtmpHandlers() {
  ipcMain.removeHandler("broadcast:available");
  ipcMain.removeHandler("broadcast:start");
  ipcMain.removeHandler("broadcast:stop");
  ipcMain.removeHandler("broadcast:status");
  ipcMain.removeAllListeners("broadcast:chunk");

  ipcMain.handle("broadcast:available", () => ({
    available: !!ffmpegPath,
    ffmpegPath: ffmpegPath ? "bundled" : null,
  }));

  ipcMain.handle("broadcast:status", () => ({ ...state }));

  ipcMain.handle("broadcast:start", (event, config = {}) => {
    stopProcesses();
    if (!ffmpegPath) return { ok: false, error: "FFmpeg není v desktop balíčku dostupný." };

    const destinations = (Array.isArray(config.destinations) ? config.destinations : [])
      .filter((item) => item && typeof item.url === "string" && /^rtmps?:\/\//i.test(item.url))
      .slice(0, 3);
    if (!destinations.length) return { ok: false, error: "Není vybraný žádný platný RTMP cíl." };

    const started = [];
    for (const destination of destinations) {
      const proc = spawn(ffmpegPath, destinationArgs(config, destination), {
        windowsHide: true,
        stdio: ["pipe", "ignore", "pipe"],
      });
      const entry = { proc, platform: destination.platform || "rtmp", stderr: "" };
      sessions.push(entry);
      started.push(entry.platform);

      proc.stderr?.on("data", (chunk) => {
        const text = String(chunk || "");
        entry.stderr = (entry.stderr + text).slice(-5000);
        safeSend(event.sender, "broadcast:log", { platform: entry.platform, text });
      });
      proc.stdin?.on("error", (error) => {
        state.error = `${entry.platform}: RTMP vstup selhal (${error.message})`;
        safeSend(event.sender, "broadcast:state", { ...state });
      });
      proc.on("error", (error) => {
        state.error = `${entry.platform}: ${error.message}`;
        safeSend(event.sender, "broadcast:state", { ...state });
      });
      proc.on("exit", (code) => {
        sessions = sessions.filter((item) => item.proc !== proc);
        const remaining = sessions.map((item) => item.platform);
        const exitError = code === 0 || code === null ? null : `${entry.platform}: FFmpeg skončil s kódem ${code}`;
        state = {
          ...state,
          active: remaining.length > 0,
          startedAt: remaining.length > 0 ? state.startedAt : null,
          destinations: remaining,
          error: exitError || state.error,
        };
        safeSend(event.sender, "broadcast:state", { ...state });
      });
    }

    state = {
      active: true,
      startedAt: new Date().toISOString(),
      destinations: started,
      error: null,
    };
    safeSend(event.sender, "broadcast:state", { ...state });
    return { ok: true, ...state };
  });

  ipcMain.on("broadcast:chunk", (_event, raw) => {
    if (!state.active || !sessions.length || !raw) return;
    let data;
    try {
      data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    } catch {
      return;
    }
    for (const session of sessions) {
      try {
        if (!session.proc.killed && session.proc.stdin?.writable) session.proc.stdin.write(data);
      } catch {}
    }
  });

  ipcMain.handle("broadcast:stop", () => {
    stopProcesses();
    return { ok: true, ...state };
  });
}

process.once("exit", () => stopProcesses({ immediate: true }));

module.exports = { registerRtmpHandlers, stopProcesses };
