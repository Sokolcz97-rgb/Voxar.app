# VoxarioBridge (Minecraft plugin)

Spigot/Paper plugin propojující Minecraft server se StudioVoxario botem (Discord).

## Instalace

1. Nahraj `VoxarioBridge.jar` do složky `plugins/` na serveru a restartuj.
2. Otevři `plugins/VoxarioBridge/config.yml` a vlož `token` (Dashboard → Bot → Games → Minecraft → Plugin token).
3. V dashboardu nastav kanály a zapni integraci.
4. `/voxario reload`, pak `/voxario test` pro ověření.

## Příkazy

- `/discord link <KÓD>` – propojí hráče s Discord účtem (kód vygeneruješ na webu).
- `/voxario reload` – načte konfiguraci (perm `voxario.admin`).
- `/voxario test` – odešle testovací zprávu do Discordu.

## Události

chat, join, leave, death, achievement, server start/stop – lze vypnout v `config.yml`.
Discord → MC funguje pollingem (`pull-interval`).

## Build

```bash
mvn -B package   # výstup: target/VoxarioBridge.jar
```
Vyžaduje JDK 17+ a Maven.
