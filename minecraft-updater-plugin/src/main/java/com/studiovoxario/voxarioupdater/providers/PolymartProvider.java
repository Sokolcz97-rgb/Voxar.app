package com.studiovoxario.voxarioupdater.providers;

import com.google.gson.JsonObject;
import com.studiovoxario.voxarioupdater.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Polymart - podporuje placene pluginy s overenim vlastnictvi pres uzivatelsky API klic.
 * Klic si uzivatel vygeneruje ve svem uctu v prohlizeci (muze se prihlasit i pres Google/Discord/GitHub),
 * takze do serveru nikdy nezadava heslo.
 */
public final class PolymartProvider implements UpdateProvider {

    private final AuthStore auth;

    public PolymartProvider(AuthStore auth) { this.auth = auth; }

    @Override public String id() { return "polymart"; }
    @Override public String displayName() { return "Polymart"; }
    @Override public boolean supportsAuth() { return true; }
    @Override public boolean authenticated() { return auth.has("polymart"); }
    @Override public String authUrl() { return "https://polymart.org/user/settings/api"; }
    @Override public List<String> ssoOptions() {
        return List.of("Google", "Discord", "GitHub", "E-mail + heslo (jen na webu Polymart)");
    }

    @Override
    public String finishAuth(String token) {
        Http.Res r = Http.post("https://api.polymart.org/v1/getAccountInfo",
                "application/x-www-form-urlencoded",
                "api_key=" + enc(token), null);
        if (!r.ok() || !r.body().contains("\"success\":true")) {
            return "Polymart token neprosel overenim (HTTP " + r.code() + ").";
        }
        auth.set("polymart", token);
        return null;
    }

    @Override
    public UpdateInfo check(PluginEntry e) {
        Http.Res r = Http.post("https://api.polymart.org/v1/getResourceInfo",
                "application/x-www-form-urlencoded",
                "resource_id=" + enc(e.resourceId), null);
        if (!r.ok()) return UpdateInfo.none(e, "Polymart API: HTTP " + r.code());

        JsonObject root = r.json().getAsJsonObject();
        JsonObject res = root.getAsJsonObject("response");
        if (res == null || !res.has("resource")) return UpdateInfo.none(e, "Resource nenalezen.");
        JsonObject resource = res.getAsJsonObject("resource");

        UpdateInfo u = new UpdateInfo(e);
        u.pageUrl = resource.has("url") ? resource.get("url").getAsString()
                : "https://polymart.org/resource/" + e.resourceId;
        double price = resource.has("price") ? resource.get("price").getAsDouble() : 0;
        u.paid = price > 0;
        if (resource.has("updates")) {
            JsonObject up = resource.getAsJsonObject("updates");
            if (up.has("latest") && up.get("latest").isJsonObject()) {
                JsonObject l = up.getAsJsonObject("latest");
                if (l.has("version")) u.latestVersion = l.get("version").getAsString();
            }
        }
        if (u.latestVersion == null && resource.has("version")) {
            u.latestVersion = resource.get("version").getAsString();
        }
        if (u.latestVersion == null) u.latestVersion = "?";
        u.available = Versions.isNewer(u.latestVersion, e.version);

        if (!u.paid) {
            u.ownershipVerified = true;
            u.downloadUrl = "https://api.polymart.org/v1/requestDownloadURL?resource_id=" + enc(e.resourceId);
        } else if (authenticated() && verifyOwnership(e)) {
            u.ownershipVerified = true;
            u.downloadUrl = "https://api.polymart.org/v1/download?resource_id=" + enc(e.resourceId)
                    + "&api_key=" + enc(auth.get("polymart"));
        } else {
            u.ownershipVerified = false;
            u.note = authenticated()
                    ? "Nemate tento plugin ve vlastnictvi."
                    : "Nutne prihlaseni k Polymart (/voxupdate auth polymart).";
        }
        return u;
    }

    @Override
    public boolean verifyOwnership(PluginEntry e) {
        if (!authenticated()) return false;
        Http.Res r = Http.post("https://api.polymart.org/v1/verifyPurchase",
                "application/x-www-form-urlencoded",
                "resource_id=" + enc(e.resourceId) + "&api_key=" + enc(auth.get("polymart")), null);
        if (!r.ok()) return false;
        try {
            JsonObject res = r.json().getAsJsonObject().getAsJsonObject("response");
            return res != null && res.has("success") && res.get("success").getAsBoolean();
        } catch (Exception ex) {
            return false;
        }
    }

    @Override
    public Map<String, String> downloadHeaders() { return Map.of(); }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
