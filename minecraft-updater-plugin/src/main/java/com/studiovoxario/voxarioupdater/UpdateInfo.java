package com.studiovoxario.voxarioupdater;

/** Vysledek kontroly aktualizace. */
public final class UpdateInfo {

    public PluginEntry entry;
    public String currentVersion;
    public String latestVersion;
    public String downloadUrl;      // muze byt null u placenych bez overeni
    public String pageUrl = "";     // stranka produktu
    public boolean paid;
    public boolean available;       // je novejsi verze?
    public boolean ownershipVerified;
    public String note = "";

    public UpdateInfo(PluginEntry entry) {
        this.entry = entry;
        this.currentVersion = entry.version;
    }

    public static UpdateInfo none(PluginEntry e, String note) {
        UpdateInfo u = new UpdateInfo(e);
        u.note = note;
        return u;
    }
}
