# SV-Vanguard – anti-cheat (budoucí projekt)

**Stav:** uloženo 20. 10. 2026, nic se zatím netvoří.

- Zadání: [StudioVoxario_Anti-Cheat_Architecture_Plan.pdf](StudioVoxario_Anti-Cheat_Architecture_Plan.pdf)
  („Projekt Vanguard: Architektura pokročilého Anti-Cheat systému“, technický návrh pro B2B integraci).
- Pilíře z návrhu: ochrana na úrovni jádra (Ring 0), polymorfní SDK, AI behaviorální analýza,
  dynamické HWID banování; integrace do Unreal Engine, Unity a vlastních C++ enginů přes SDK.
- Plán: vlastní repozitář na GitHubu jako samostatný produkt; první nasazení v Ashes of Eryon
  (nativní verze v Unity). Serverová část hry už teď kontroluje všechny akce a omezuje počet
  požadavků (viz `supabase/migrations/20261020170000_ashes_gate.sql`).
