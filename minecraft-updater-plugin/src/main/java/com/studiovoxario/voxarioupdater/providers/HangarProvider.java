package com.studiovoxario.voxarioupdater.providers;

import com.studiovoxario.voxarioupdater.*;

/** Hangar (PaperMC) - vse zdarma. */
public final class HangarProvider implements UpdateProvider {

    @Override public String id() { return "hangar"; }
    @Override public String displayName() { return "Hangar (PaperMC)"; }

    @Override
    public UpdateInfo check(PluginEntry e) {
        String slug = e.resourceId;
        Http.Res r = Http.get("https://hangar.papermc.io/api/v1/projects/" + slug + "/latestrelease", null);
        if (!r.ok()) return UpdateInfo.none(e, "Hangar API: HTTP " + r.code());
        String ver = r.body().trim().replace("\"", "");
        UpdateInfo u = new UpdateInfo(e);
        u.ownershipVerified = true;
        u.latestVersion = ver;
        u.pageUrl = "https://hangar.papermc.io/" + slug;
        u.downloadUrl = "https://hangar.papermc.io/api/v1/projects/" + slug
                + "/versions/" + ver + "/PAPER/download";
        u.available = Versions.isNewer(ver, e.version);
        return u;
    }
}
