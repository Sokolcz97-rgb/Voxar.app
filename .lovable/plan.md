# Chyba "Failed to read console input" — diagnóza

Tahle chyba **nepochází z pluginu VoxarioForge**. Jde o chybu konzole samotného serveru:

```text
java.io.IOException: Neplatný popisovač (Invalid handle)
  at net.minecrell.terminalconsole.SimpleTerminalConsole.readCommands
```

Server se snaží číst příkazy ze standardního vstupu (stdin), ale ten není dostupný — typicky když se server spouští:
- na pozadí (`start /b`, služba, panel bez konzole),
- přes skript, kde je stdin přesměrován nebo zavřený,
- v Dockeru bez `-i` / `tty`.

Plugin se do toho nijak neplete a server běží dál, jen nejde psát příkazy do konzole.

## Řešení (na straně spouštění serveru)

1. Ve start skriptu přidat za jar parametr `nogui` a spouštět přímo v okně konzole:
   ```text
   java -Xmx4G -jar folia.jar nogui
   ```
2. Pokud server běží na pozadí / jako služba, vypnout čtení konzole přepínačem JVM:
   ```text
   java -Djline.terminal=jline.UnsupportedTerminal -jar folia.jar nogui
   ```
   nebo `-Dterminal.jline=false -Dterminal.ansi=true`
3. V Dockeru přidat `stdin_open: true` a `tty: true` (resp. `docker run -it`).
4. Ve Windows `.bat` použít `java ...` bez `start /b` a bez `< NUL`.

## Co udělám v repozitáři

- Doplním do `minecraft-forge-plugin/README.md` sekci **Řešení potíží** s touto chybou a doporučenými start příkazy (Windows `.bat` i Linux `.sh` příklad).
- Ověřím, že `VoxarioForge.jar` je stále přeložený na Java 21 (class 65), aby nedošlo k záměně s dřívější chybou verze.

Pokud chceš, můžu místo toho rovnou hledat jinou chybu — pošli log z okamžiku startu (řádky s `VoxarioForge`), pokud se plugin nenačetl.
