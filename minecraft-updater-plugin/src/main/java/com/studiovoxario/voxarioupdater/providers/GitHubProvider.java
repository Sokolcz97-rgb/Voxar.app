package com.studiovoxario.voxarioupdater.providers;

import com.google.gson.JsonObject;
import com.studiovoxario.voxarioupdater.*;

import java.util.Map;

/** GitHub Releases - vzdy zdarma, bez prihlaseni (token jen pro rate-limit). */
public final class GitHubProvider implements UpdateProvider {

    private final String token;

    public GitHubProvider(String token) {
        this.token = token == null ? "" : token.trim();
    }

    @Override public String id() { return "github"; }
    @Override public String displayName() { return "GitHub Releases"; }

    @Override
    public UpdateInfo check(PluginEntry e) {
        String repo = e.resourceId;
        Map<String, String> h = token.isEmpty()
                ? Http.h("Accept", "application/vnd.github+json")
                : Http.h("Accept", "application/vnd.github+json", "Authorization", "Bearer " + token);
        Http.Res r = Http.get("https://api.github.com/repos/" + repo + "/releases/latest", h);
        if (!r.ok()) return UpdateInfo.none(e, "GitHub API: HTTP " + r.code());

        JsonObject o = r.json().getAsJsonObject();
        UpdateInfo u = new UpdateInfo(e);
        u.paid = false;
        u.ownershipVerified = true;
        u.latestVersion = o.has("tag_name") ? o.get("tag_name").getAsString() : "?";
        u.pageUrl = o.has("html_url") ? o.get("html_url").getAsString() : "https://github.com/" + repo;
        if (o.has("assets")) {
            for (var el : o.getAsJsonArray("assets")) {
                JsonObject a = el.getAsJsonObject();
                String n = a.get("name").getAsString().toLowerCase();
                if (n.endsWith(".jar") && !n.contains("sources") && !n.contains("javadoc")) {
                    u.downloadUrl = a.get("browser_download_url").getAsString();
                    break;
                }
            }
        }
        u.available = Versions.isNewer(u.latestVersion, e.version);
        if (u.downloadUrl == null) u.note = "Release nema .jar prilohu.";
        return u;
    }

    @Override
    public Map<String, String> downloadHeaders() {
        return token.isEmpty() ? Map.of() : Map.of("Authorization", "Bearer " + token);
    }
}
