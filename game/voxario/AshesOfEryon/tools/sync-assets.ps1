# Windows: zkopíruje sdílené assety z Unity verze hry do Assets\ (viz sync-assets.sh)
$ErrorActionPreference = "Stop"
$here = Resolve-Path (Join-Path $PSScriptRoot "..")
$unity = Join-Path $here "..\..\unity\AshesOfEryon\Assets"
New-Item -ItemType Directory -Force -Path "$here\Assets\Models", "$here\Assets\UI", "$here\Assets\Data" | Out-Null
foreach ($d in "heroes", "animals", "buildings") {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$here\Assets\Models\$d"
  Copy-Item -Recurse "$unity\Models\$d" "$here\Assets\Models\$d"
}
Copy-Item "$unity\Voxario\Resources\UI\*" "$here\Assets\UI\" -Include *.ttf, *.png, *.jpg
Copy-Item "$unity\Voxario\Resources\content.json" "$here\Assets\Data\content.json"
Write-Host "Assets synced from $unity"
