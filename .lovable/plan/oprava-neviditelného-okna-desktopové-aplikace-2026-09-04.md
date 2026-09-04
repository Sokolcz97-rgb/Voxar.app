# Oprava neviditelného okna desktopové aplikace

## Cíl
Zajistit, aby se po spuštění vždy zobrazil launcher nebo vybraný modul a aplikace nezůstala pouze mezi procesy.

## Změny
- Vytvořit a zobrazit launcher ještě před kontrolou předchozího pádu a případnou obnovou verze.
- Přesunout kontrolu obnovy na pozadí, aby nikdy neblokovala první okno.
- Při druhém spuštění obnovit minimalizované nebo skryté existující okno; pokud žádné není, otevřít launcher místo skrytého hlavního modulu.
- Přidat pojistku, která okno vrátí na viditelnou obrazovku a přenese ho dopředu.
- Zapsat startovací chyby do diagnostického souboru pro případ dalšího selhání.

## Ověření
- Zkontrolovat syntaxi hlavního procesu.
- Spustit Electron v testovacím režimu a ověřit, že vznikne viditelné okno bez čekání na síťovou kontrolu.
