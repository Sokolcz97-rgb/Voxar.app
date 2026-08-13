package com.studiovoxario.voxarioupdater;

import com.studiovoxario.voxarioupdater.providers.*;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipFile;

/** Jadro: kontrola verzi, overeni vlastnictvi, bezpecne stazeni do plugins/update/. */
public final class UpdateManager {

    private final VoxarioUpdater plugin;
    private final Map<String, UpdateProvider> providers = new LinkedHashMap<>();
    private final List<UpdateInfo> lastResults = new ArrayList<>();

    public UpdateManager(VoxarioUpdater plugin) {
        this.plugin = plugin;
        reloadProviders();
    }

    public void reloadProviders() {
        providers.clear();
        var c = plugin.getConfig();
        if (c.getBoolean("providers.github.enabled", true))
            add(new GitHubProvider(c.getString("providers.github.token", "")));
        if (c.getBoolean("providers.modrinth.enabled", true)) add(new ModrinthProvider());
        if (c.getBoolean("providers.hangar.enabled", true)) add(new HangarProvider());
        if (c.getBoolean("providers.spigot.enabled", true)) add(new SpigotProvider());
        if (c.getBoolean("providers.polymart.enabled", true)) add(new PolymartProvider(plugin.auth()));
        if (c.getBoolean("providers.builtbybit.enabled", true)) add(new BuiltByBitProvider(plugin.auth()));
    }

    private void add(UpdateProvider p) { providers.put(p.id(), p); }

    public Map<String, UpdateProvider> providers() { return providers; }

    public UpdateProvider provider(String id) {
        return id == null ? null : providers.get(id.toLowerCase(Locale.ROOT));
    }

    public List<UpdateInfo> lastResults() { return lastResults; }

    /** Kompletni kontrola vsech pluginu (spoustej asynchronne). */
    public List<UpdateInfo> checkAll() {
        List<UpdateInfo> out = new ArrayList<>();
        for (PluginEntry e : new PluginScanner(plugin).scan()) {
            out.add(check(e));
        }
        lastResults.clear();
        lastResults.addAll(out);
        return out;
    }

    public UpdateInfo check(PluginEntry e) {
        if (!e.known()) return UpdateInfo.none(e, "Zdroj aktualizaci se nepodarilo zjistit (doplnit do 'overrides').");
        UpdateProvider p = provider(e.provider);
        if (p == null) return UpdateInfo.none(e, "Platforma '" + e.provider + "' je vypnuta.");
        try {
            UpdateInfo u = p.check(e);
            return u == null ? UpdateInfo.none(e, "Bez odpovedi.") : u;
        } catch (Exception ex) {
            return UpdateInfo.none(e, "Chyba: " + ex.getMessage());
        }
    }

    /** Vysledek pokusu o aktualizaci. */
    public record Result(boolean ok, String message) {}

    public Result download(UpdateInfo u) {
        PluginEntry e = u.entry;
        UpdateProvider p = provider(e.provider);
        if (p == null) return new Result(false, "Platforma neni dostupna.");
        if (!u.available) return new Result(false, e.name + " je aktualni (" + e.version + ").");

        boolean requireOwnership = plugin.getConfig().getBoolean("security.require-ownership", true);

        if (u.paid) {
            // Ochrana proti pirateni: bez overeneho vlastnictvi nikdy nestahujeme.
            if (requireOwnership && !u.ownershipVerified) {
                return new Result(false, "Nemate tento plugin ve vlastnictvi. Zdroj: " + u.pageUrl);
            }
            if (u.downloadUrl == null) {
                return new Result(false, "Platforma neposkytuje automatické stazeni. Stahni rucne: " + u.pageUrl);
            }
        }
        if (u.downloadUrl == null) {
            return new Result(false, "Neni k dispozici odkaz ke stazeni. Stranka: " + u.pageUrl);
        }

        File stage = new File(plugin.getDataFolder().getParentFile(),
                plugin.getConfig().getString("staging-folder", "update"));
        stage.mkdirs();
        File tmp = new File(stage, e.jar.getName() + ".part");
        File target = new File(stage, e.jar.getName());

        try { Files.deleteIfExists(tmp.toPath()); } catch (Exception ignored) {}

        int code = Http.download(u.downloadUrl, p.downloadHeaders(), tmp.toPath());
        if (code == 401 || code == 403) {
            tmp.delete();
            return new Result(false, "Nemate tento plugin ve vlastnictvi (HTTP " + code + ").");
        }
        if (code < 200 || code >= 300) {
            tmp.delete();
            return new Result(false, "Stazeni selhalo (HTTP " + code + ").");
        }

        if (plugin.getConfig().getBoolean("security.verify-jar", true) && !validJar(tmp)) {
            tmp.delete();
            return new Result(false, "Stazeny soubor neni platny plugin .jar - zahozeno.");
        }

        if (plugin.getConfig().getBoolean("security.backup", true)) {
            File backups = new File(plugin.getDataFolder(), "backups");
            backups.mkdirs();
            try {
                Files.copy(e.jar.toPath(), new File(backups, e.jar.getName() + "." + e.version + ".bak").toPath(),
                        StandardCopyOption.REPLACE_EXISTING);
            } catch (Exception ignored) {}
        }

        try {
            Files.move(tmp.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception ex) {
            return new Result(false, "Nelze ulozit do update slozky: " + ex.getMessage());
        }

        String own = u.paid ? " Plugin vam aktualizujeme, protoze ho mate ve vlastnictvi." : "";
        return new Result(true, e.name + " " + e.version + " -> " + u.latestVersion
                + " pripraveno v plugins/" + stage.getName() + "/ (nasadi se pri restartu)." + own);
    }

    private boolean validJar(File f) {
        if (!f.isFile() || f.length() < 1024) return false;
        try (ZipFile zf = new ZipFile(f)) {
            return zf.getEntry("plugin.yml") != null || zf.getEntry("paper-plugin.yml") != null;
        } catch (Exception e) {
            return false;
        }
    }
}
