package com.studiovoxario.voxarioupdater.providers;

import com.google.gson.JsonObject;
import com.studiovoxario.voxarioupdater.*;

import java.util.List;

/**
 * SpigotMC (pres verejne Spiget API).
 * Placene (premium) resources maji uzavreny download - SpigotMC nema verejne API
 * pro overeni vlastnictvi, takze je NIKDY nestahujeme a jen vypiseme odkaz.
 */
public final class SpigotProvider implements UpdateProvider {

    @Override public String id() { return "spigot"; }
    @Override public String displayName() { return "SpigotMC"; }

    @Override public boolean supportsAuth() { return true; }
    @Override public boolean authenticated() { return false; }
    @Override public String authUrl() { return "https://www.spigotmc.org/login"; }
    @Override public List<String> ssoOptions() { return List.of("Spigot ucet (2FA)"); }
    @Override public String finishAuth(String token) {
        return "SpigotMC nema verejne API pro overeni nakupu. Placeny plugin stahni rucne ze sve knihovny.";
    }

    @Override
    public UpdateInfo check(PluginEntry e) {
        String rid = e.resourceId;
        Http.Res info = Http.get("https://api.spiget.org/v2/resources/" + rid, null);
        if (!info.ok()) return UpdateInfo.none(e, "Spiget API: HTTP " + info.code());
        JsonObject o = info.json().getAsJsonObject();
        boolean premium = o.has("premium") && o.get("premium").getAsBoolean();
        boolean external = o.has("external") && o.get("external").getAsBoolean();

        Http.Res ver = Http.get("https://api.spiget.org/v2/resources/" + rid + "/versions/latest", null);
        String latest = "?";
        if (ver.ok()) {
            JsonObject v = ver.json().getAsJsonObject();
            if (v.has("name")) latest = v.get("name").getAsString();
        }

        UpdateInfo u = new UpdateInfo(e);
        u.latestVersion = latest;
        u.pageUrl = "https://www.spigotmc.org/resources/" + rid;
        u.paid = premium;
        u.available = Versions.isNewer(latest, e.version);

        if (premium) {
            u.ownershipVerified = false;
            u.note = "Placeny resource - SpigotMC neumoznuje automaticke overeni vlastnictvi.";
        } else if (external) {
            u.ownershipVerified = true;
            u.note = "Externi hosting - stahni rucne ze stranky.";
        } else {
            u.ownershipVerified = true;
            u.downloadUrl = "https://api.spiget.org/v2/resources/" + rid + "/download";
        }
        return u;
    }
}
