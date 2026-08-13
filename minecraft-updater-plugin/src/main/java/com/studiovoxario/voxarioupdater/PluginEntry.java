package com.studiovoxario.voxarioupdater;

import java.io.File;

/** Jeden nalezeny plugin na serveru. */
public final class PluginEntry {

    public String name;
    public String version;
    public String author = "";
    public File jar;

    /** github|modrinth|hangar|spigot|polymart|builtbybit|unknown */
    public String provider = "unknown";
    /** Identifikator zdroje (owner/repo, slug, resource id...). */
    public String resourceId = "";
    /** Odkud jsme zdroj zjistili (plugin.yml, config, override...). */
    public String detectedFrom = "-";
    /** Webova stranka pluginu (pro rucni / placene aktualizace). */
    public String website = "";

    public PluginEntry(String name, String version, File jar) {
        this.name = name;
        this.version = version;
        this.jar = jar;
    }

    public boolean known() {
        return !"unknown".equals(provider) && resourceId != null && !resourceId.isBlank();
    }

    @Override public String toString() {
        return name + " v" + version + " [" + provider + ":" + resourceId + "]";
    }
}
