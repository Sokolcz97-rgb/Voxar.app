## Cíl
Pokračovat v redesignu `/app` shellu přesně podle blueprintu (image-68), ale **AIHelper na veřejném webu vrátit do původní podoby** — holo `NEON // AI` orb má zůstat jen uvnitř desktop aplikace / `/app`.

## Kroky

### 1. Rozdělit AIHelper na web vs. app variantu
- Vrátit `src/components/AIHelper.tsx` do původní (pre-blueprint) podoby, kterou používá marketing web (Index, Novinky, Forum…).
- Vytvořit nový `src/components/vox/AIHelperHolo.tsx` s holo `NEON // AI` orbem + hex-frame panelem.
- V `src/pages/app/AppShell.tsx` použít `AIHelperHolo` místo `AIHelper`.

### 2. Dokončit blueprint sekce, které ještě nejsou hotové
- **GuildRail top badge**: přidat `STUDIO // VOXARIO` monogram nad seznam sektorů (levý horní roh schématu).
- **ChannelSidebar footer**: přidat mini status pás pod SelfPanel — „NET LINK ● SYNC" s pulzující tečkou (spodní část levého podu ve schématu).
- **MemberList**: doplnit pravou hex-frame lištu s ikonami filtrů (ALL / VOICE / ADMIN) nad seznam členů, dle schématu.
- **AppServerSettings / AppUserSettings**: sjednotit záhlaví do `// SEKCE …` stylu (uppercase, tracking, tenký scanline pruh), aby settings pody nevypadaly jako běžný shadcn dialog.
- **CreateGuildDialog / JoinGuildDialog / CreateChannelDialog**: přeobléknout do `holo-context-menu` stylu (polygon clip, glow border, uppercase font-display nadpisy).

### 3. Detaily z blueprintu, které chybí
- **Rank ring legenda**: malý dekorativní ukazatel v ENTITY POD hlavičce (barevné tečky = role hoisted colors).
- **Speaking ring**: ověřit, že se aktivuje i v `VoiceView` dlaždicích (ne jen v MemberList).
- **Scanline animace**: přidat jemný `.holo-scanline` overlay na hlavní pody (`AppShell`), aby celý HUD dýchal.

### 4. Bez zásahů
- Žádné změny v business logice, DB, RLS, hlasovém stacku ani v marketing stránkách kromě návratu původního `AIHelper.tsx`.

## Soubory
- upravit: `src/components/AIHelper.tsx` (vrátit původní), `src/pages/app/AppShell.tsx`, `src/components/vox/GuildRail.tsx`, `src/components/vox/ChannelSidebar.tsx`, `src/components/vox/MemberList.tsx`, `src/components/vox/AppServerSettings.tsx`, `src/components/vox/AppUserSettings.tsx`, `src/components/vox/CreateGuildDialog.tsx`, `src/components/vox/CreateChannelDialog.tsx`, `src/components/vox/VoiceView.tsx`, `src/index.css` (přidat `.holo-scanline`, případně `.net-link`).
- vytvořit: `src/components/vox/AIHelperHolo.tsx`.
