; StudioVoxario NSIS bridge
; ------------------------
; Prvni instalaci dela vlastni Electron/HUD instalator, ktery historicky zapisuje
; instalacni cestu sem:
; HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app\InstallLocation
;
; electron-updater ale pri naslednem tichém NSIS updatu pouziva vlastni
; INSTALL_REGISTRY_KEY od electron-builderu. Pred inicializaci proto prekopirujeme
; existujici custom install path do jeho registry klice. Tim se prvni auto-update
; nainstaluje PRESNE pres stavajici instalaci, i kdyz byla puvodne rozbalena
; vlastnim HUD instalatorem.

!macro preInit
  StrCpy $R9 ""

  ; Custom installer je x64, zkusime nejdriv 64-bit view.
  SetRegView 64
  ReadRegStr $R9 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app" "InstallLocation"

  ; Pojistka pro starsi buildy / rozdilny registry view.
  ${If} $R9 == ""
    SetRegView 32
    ReadRegStr $R9 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app" "InstallLocation"
  ${EndIf}

  ${If} $R9 != ""
    ; Zapiseme cestu do obou view. electron-builder si pak pri update vybere
    ; spravny per-user InstallLocation a nepresune appku jinam.
    SetRegView 64
    WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$R9"
    SetRegView 32
    WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$R9"
  ${EndIf}

  SetRegView 64
!macroend

; Po prvnim uspesnem NSIS updatu uz ma aplikace standardni electron-builder
; registry zaznam. Stary custom uninstall zaznam odstraníme, aby ve Windows
; nevznikaly dve polozky stejne aplikace. Samotna instalacni cesta a uzivatelska
; data zustavaji zachovana.
!macro customInstall
  ${If} ${isUpdated}
    SetRegView 64
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app"
    SetRegView 32
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Voxar.app"
    SetRegView 64
  ${EndIf}
!macroend
