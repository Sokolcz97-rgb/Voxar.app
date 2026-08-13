package com.studiovoxario.voxarioupdater.providers;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.studiovoxario.voxarioupdater.*;

/** Modrinth - open source katalog, vse zdarma. */
public final class ModrinthProvider implements UpdateProvider {

    @Override public String id() { return "modrinth"; }
    @Override public String displayName() { return "Modrinth"; }

    @Override
    public UpdateInfo check(PluginEntry e) {
        Http.Res r = Http.get("https://api.modrinth.com/v2/project/" + e.resourceId + "/version", null);
        if (!r.ok()) return UpdateInfo.none(e, "Modrinth API: HTTP " + r.code());
        JsonArray arr = r.json().getAsJsonArray();
        if (arr.isEmpty()) return UpdateInfo.none(e, "Zadne verze.");

        JsonObject best = null;
        for (var el : arr) {
            JsonObject v = el.getAsJsonObject();
            for (var l : v.getAsJsonArray("loaders")) {
                String loader = l.getAsString();
                if (loader.equals("paper") || loader.equals("spigot") || loader.equals("bukkit")
                        || loader.equals("purpur") || loader.equals("folia")) {
                    best = v;
                    break;
                }
            }
            if (best != null) break;
        }
        if (best == null) best = arr.get(0).getAsJsonObject();

        UpdateInfo u = new UpdateInfo(e);
        u.ownershipVerified = true;
        u.latestVersion = best.get("version_number").getAsString();
        u.pageUrl = "https://modrinth.com/plugin/" + e.resourceId;
        JsonArray files = best.getAsJsonArray("files");
        for (var f : files) {
            JsonObject fo = f.getAsJsonObject();
            if (fo.get("filename").getAsString().toLowerCase().endsWith(".jar")) {
                u.downloadUrl = fo.get("url").getAsString();
                if (fo.has("primary") && fo.get("primary").getAsBoolean()) break;
            }
        }
        u.available = Versions.isNewer(u.latestVersion, e.version);
        return u;
    }
}
