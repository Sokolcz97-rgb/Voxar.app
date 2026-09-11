"use strict";

// Force Windows PowerShell output to UTF-8 before the real desktop bootstrap
// loads. Node decodes child-process stdout as UTF-8, while Windows PowerShell
// can otherwise emit the active legacy console code page when stdout is piped.
// That mismatch produced replacement characters (�) in Czech Windows Update
// titles and other localized Defender/Windows text inside VoxarioProtect.
if (process.platform === "win32") {
  const childProcess = require("child_process");
  const originalSpawn = childProcess.spawn;
  const utf8Prelude = [
    "$__voxarioUtf8 = New-Object System.Text.UTF8Encoding($false)",
    "[Console]::OutputEncoding = $__voxarioUtf8",
    "$OutputEncoding = $__voxarioUtf8",
  ].join(";") + ";";

  childProcess.spawn = function voxarioUtf8Spawn(command, args, options) {
    const argv = Array.isArray(args) ? [...args] : args;
    const executable = String(command || "").replace(/^.*[\\/]/, "").toLowerCase();

    if ((executable === "powershell.exe" || executable === "powershell" || executable === "pwsh.exe" || executable === "pwsh") && Array.isArray(argv)) {
      const commandIndex = argv.findIndex((arg) => String(arg).toLowerCase() === "-command");
      if (commandIndex >= 0 && typeof argv[commandIndex + 1] === "string") {
        argv[commandIndex + 1] = utf8Prelude + argv[commandIndex + 1];
      }
    }

    return originalSpawn.call(childProcess, command, argv, options);
  };
}

require("./bootstrap.cjs");
