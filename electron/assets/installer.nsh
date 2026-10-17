; StudioVoxario NSIS bridge
; ------------------------
; Prvni instalaci dela vlastni Electron/HUD instalator, ktery historicky zapisuje
; instalacni cestu sem:
; HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app\InstallLocation
;
; electron-updater ale pri naslednem tichem NSIS updatu pouziva vlastni
; INSTALL_REGISTRY_KEY od electron-builderu. Pred inicializaci proto prekopirujeme
; existujici custom install path do jeho registry klice. Tim se prvni auto-update
; nainstaluje PRESNE pres stavajici instalaci, i kdyz byla puvodne rozbalena
; vlastnim HUD instalatorem.
;
; DULEZITE: modules.json lezi vedle exe a obsahuje volbu, zda uzivatel instaloval
; VoxarioBrowser. NSIS pri update muze cizi soubory v instalacni slozce odstranit,
; proto stav pred aktualizaci zalohujeme a po instalaci vratime.

; Produkt urcujeme podle PRODUCT_NAME z electron-builderu. Stejny soubor
; pouziva Voxar.app i samostatny VoxarioBrowser (browser-builder.json).
!if "${PRODUCT_NAME}" == "VoxarioBrowser"
  !define SV_BROWSER_PRODUCT
  !define SV_CUSTOM_UNINSTALL_KEY "StudioVoxario.browser"
!else
  !define SV_CUSTOM_UNINSTALL_KEY "StudioVoxario.app"
!endif

!macro preInit
  StrCpy $R9 ""
  StrCpy $R8 "0"
  Delete "$TEMP\StudioVoxario-modules.json"

  ; 1) Prvni prechod z vlastniho HUD instalatoru.
  ;    Od 0.0.51 zapisuje HUD instalator klic StudioVoxario.<produkt>
  ;    (app / browser). Starsi verze pouzivaly Uninstall\Voxar.app.
  ;    Bez cteni noveho klice se prvni auto-update instaloval jinam.
  SetRegView 64
  ReadRegStr $R9 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SV_CUSTOM_UNINSTALL_KEY}" "InstallLocation"
  ${If} $R9 == ""
    SetRegView 32
    ReadRegStr $R9 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SV_CUSTOM_UNINSTALL_KEY}" "InstallLocation"
  ${EndIf}

!ifndef SV_BROWSER_PRODUCT
  ${If} $R9 == ""
    SetRegView 64
    ReadRegStr $R9 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app" "InstallLocation"
  ${EndIf}
  ${If} $R9 == ""
    SetRegView 32
    ReadRegStr $R9 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app" "InstallLocation"
  ${EndIf}
!endif

  ; 2) Dalsi aktualizace uz pouzivaji standardni electron-builder registry klic.
  ${If} $R9 == ""
    SetRegView 64
    ReadRegStr $R9 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${EndIf}
  ${If} $R9 == ""
    SetRegView 32
    ReadRegStr $R9 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${EndIf}

  ${If} $R9 != ""
    ; Zapiseme cestu do obou view. electron-builder si pak pri update vybere
    ; spravny per-user InstallLocation a nepresune appku jinam.
    SetRegView 64
    WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$R9"
    SetRegView 32
    WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$R9"

    ; Zachovej volbu nainstalovanych modulu pres NSIS update.
    IfFileExists "$R9\modules.json" 0 sv_modules_backup_done
      CopyFiles /SILENT "$R9\modules.json" "$TEMP\StudioVoxario-modules.json"
      StrCpy $R8 "1"
    sv_modules_backup_done:
  ${EndIf}

  SetRegView 64
!macroend

; Po prvnim uspesnem NSIS updatu uz ma aplikace standardni electron-builder
; registry zaznam. Stary custom uninstall zaznam odstraníme, aby ve Windows
; nevznikaly dve polozky stejne aplikace. Samotna instalacni cesta a uzivatelska
; data zustavaji zachovana.
!macro customInstall
!ifndef SV_BROWSER_PRODUCT
  ; Vrat modules.json, ktery mohl NSIS pri prepisu instalace odstranit.
  ${If} $R8 == "1"
    IfFileExists "$TEMP\StudioVoxario-modules.json" 0 sv_modules_restore_done
      CopyFiles /SILENT "$TEMP\StudioVoxario-modules.json" "$INSTDIR\modules.json"
      Delete "$TEMP\StudioVoxario-modules.json"
    sv_modules_restore_done:
  ${Else}
    ; Oprava pro klienty, kterym uz starsi update modules.json smazal.
    ; Vlastni instalator vytvari Start Menu zkratku jen tehdy, kdyz byl
    ; VoxarioBrowser skutecne zvolen, takze ji muzeme pouzit jako migracni dukaz.
    IfFileExists "$APPDATA\Microsoft\Windows\Start Menu\Programs\Voxar.app\VoxarioBrowser.lnk" 0 sv_modules_migration_done
      FileOpen $R7 "$INSTDIR\modules.json" w
      FileWrite $R7 '{"browser":{"installed":true}}'
      FileClose $R7
      StrCpy $R8 "1"
    sv_modules_migration_done:
  ${EndIf}
!endif

  ${If} ${isUpdated}
    ; Po prvnim NSIS updatu ma aplikace standardni electron-builder zaznam.
    ; Stare custom zaznamy odstranime, aby ve Windows nebyly dve polozky.
    SetRegView 64
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SV_CUSTOM_UNINSTALL_KEY}"
!ifndef SV_BROWSER_PRODUCT
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app"
!endif
    SetRegView 32
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SV_CUSTOM_UNINSTALL_KEY}"
!ifndef SV_BROWSER_PRODUCT
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app"
!endif
    SetRegView 64
  ${EndIf}
!macroend
