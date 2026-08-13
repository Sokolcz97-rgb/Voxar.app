package com.studiovoxario.voxarioupdater.providers;

import com.google.gson.JsonObject;
import com.studiovoxario.voxarioupdater.*;

import java.util.List;
import java.util.Map;

/**
 * BuiltByBit (drive MC-Market) - placene pluginy.
 * Prihlaseni probiha v prohlizeci na builtbybit.com (Google / Discord / e-mail),
 * kde si uzivatel vygeneruje Private API token. Heslo nikdy nezadava do hry.
 */
public final class BuiltByBitProvider implements UpdateProvider {

    private static final String API = "https://api.builtbybit.com/v1";
    private final AuthStore auth;

    public BuiltByBitProvider(AuthStore auth) { this.auth = auth; }

    @Override public String id() { return "builtbybit"; }
    @Override public String displayName() { return "BuiltByBit"; }
    @Override public boolean supportsAuth() { return true; }
    @Override public boolean authenticated() { return auth.has("builtbybit"); }
    @Override public String authUrl() { return "https://builtbybit.com/account/api"; }
    @Override public List<String> ssoOptions() {
        return List.of("Google", "Discord", "E-mail + heslo (jen na webu BuiltByBit)");
    }

    private Map<String, String> hdr() {
        return Http.h("Authorization", "Private " + auth.get("builtbybit"));
    }

    @Override
    public String finishAuth(String token) {
        Http.Res r = Http.get(API + "/health", Http.h("Authorization", "Private " + token));
        if (r.code() == 401 || r.code() == 403) return "Token byl odmitnut (neplatny nebo bez opravneni).";
        if (!r.ok()) return "BuiltByBit API neodpovedelo (HTTP " + r.code() + ").";
        auth.set("builtbybit", token);
        return null;
    }

    @Override
    public UpdateInfo check(PluginEntry e) {
        UpdateInfo u = new UpdateInfo(e);
        u.paid = true;
        u.pageUrl = "https://builtbybit.com/resources/" + e.resourceId;

        if (!authenticated()) {
            u.note = "Nutne prihlaseni k BuiltByBit (/voxupdate auth builtbybit).";
            u.ownershipVerified = false;
            return u;
        }

        Http.Res r = Http.get(API + "/resources/" + e.resourceId + "/versions/latest", hdr());
        if (r.code() == 401 || r.code() == 403) {
            u.ownershipVerified = false;
            u.note = "Nemate tento plugin ve vlastnictvi.";
            return u;
        }
        if (!r.ok()) return UpdateInfo.none(e, "BuiltByBit API: HTTP " + r.code());

        try {
            JsonObject data = r.json().getAsJsonObject().getAsJsonObject("data");
            u.latestVersion = data.has("name") ? data.get("name").getAsString() : "?";
            String versionId = data.has("version_id") ? data.get("version_id").getAsString() : null;
            u.available = Versions.isNewer(u.latestVersion, e.version);
            u.ownershipVerified = verifyOwnership(e);
            if (u.ownershipVerified && versionId != null) {
                u.downloadUrl = API + "/resources/" + e.resourceId + "/versions/" + versionId + "/download";
            } else if (!u.ownershipVerified) {
                u.note = "Nemate tento plugin ve vlastnictvi.";
            }
        } catch (Exception ex) {
            return UpdateInfo.none(e, "Neocekavana odpoved BuiltByBit.");
        }
        return u;
    }

    @Override
    public boolean verifyOwnership(PluginEntry e) {
        if (!authenticated()) return false;
        Http.Res r = Http.get(API + "/resources/" + e.resourceId + "/purchases/self", hdr());
        if (r.ok()) return true;
        if (r.code() == 404 || r.code() == 403 || r.code() == 401) return false;
        // Fallback: seznam vlastnich licenci
        Http.Res lic = Http.get(API + "/resources/" + e.resourceId + "/licenses/self", hdr());
        return lic.ok();
    }

    @Override
    public Map<String, String> downloadHeaders() {
        return authenticated() ? hdr() : Map.of();
    }
}
