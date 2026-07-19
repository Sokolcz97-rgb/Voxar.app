; StudioVoxario NSIS Installer
Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "StudioVoxario"
OutFile "StudioVoxarioSetup-0.0.8-alpha.exe"
InstallDir "$LOCALAPPDATA\StudioVoxario"
InstallDirRegKey HKCU "Software\StudioVoxario" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "StudioVoxario"

!define MUI_ICON  "assets\icon.ico"
!define MUI_UNICON "assets\icon.ico"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\StudioVoxario.exe"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Czech"
!insertmacro MUI_LANGUAGE "English"

; Kill running instance before install so exe/DLLs aren't locked.
!macro KillRunning
  DetailPrint "Ukončuji běžící StudioVoxario…"
  nsExec::Exec 'taskkill /F /IM StudioVoxario.exe /T'
  Sleep 800
!macroend

Section "StudioVoxario" SecMain
  !insertmacro KillRunning
  SetOutPath "$INSTDIR"
  File /r "release\StudioVoxario-win32-x64\*.*"

  ; Shortcuts
  CreateDirectory "$SMPROGRAMS\StudioVoxario"
  CreateShortCut "$SMPROGRAMS\StudioVoxario\StudioVoxario.lnk" "$INSTDIR\StudioVoxario.exe" "" "$INSTDIR\StudioVoxario.exe" 0
  CreateShortCut "$SMPROGRAMS\StudioVoxario\Odinstalovat.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\StudioVoxario.lnk" "$INSTDIR\StudioVoxario.exe" "" "$INSTDIR\StudioVoxario.exe" 0

  ; Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\StudioVoxario" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioVoxario" \
    "DisplayName" "StudioVoxario"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioVoxario" \
    "DisplayIcon" "$INSTDIR\StudioVoxario.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioVoxario" \
    "Publisher" "StudioVoxario"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioVoxario" \
    "DisplayVersion" "0.0.7-alpha"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioVoxario" \
    "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioVoxario" \
    "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioVoxario" \
    "NoRepair" 1
SectionEnd

; Auto-run the app after a silent install (/S).
Function .onInstSuccess
  ${If} ${Silent}
    Exec '"$INSTDIR\StudioVoxario.exe"'
  ${EndIf}
FunctionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM StudioVoxario.exe /T'
  Sleep 500
  Delete "$SMPROGRAMS\StudioVoxario\StudioVoxario.lnk"
  Delete "$SMPROGRAMS\StudioVoxario\Odinstalovat.lnk"
  RMDir  "$SMPROGRAMS\StudioVoxario"
  Delete "$DESKTOP\StudioVoxario.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\StudioVoxario"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioVoxario"
SectionEnd
