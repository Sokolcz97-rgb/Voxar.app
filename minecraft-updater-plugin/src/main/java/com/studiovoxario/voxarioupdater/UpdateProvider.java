package com.studiovoxario.voxarioupdater;

import java.util.List;

/** Rozhrani platformy (GitHub, Modrinth, Spigot, Polymart, BuiltByBit...). */
public interface UpdateProvider {

    String id();

    String displayName();

    /** Vrati info o nejnovejsi verzi (nebo UpdateInfo.none(...) s poznamkou). */
    UpdateInfo check(PluginEntry entry);

    /** Vyzaduje platforma prihlaseni pro placene produkty? */
    default boolean supportsAuth() { return false; }

    /** Je uzivatel prihlasen (mame platny token)? */
    default boolean authenticated() { return false; }

    /**
     * URL, kterou hrac otevre v prohlizeci a kde se prihlasi (i pres Google/GitHub/Discord SSO,
     * pokud to dana platforma nabizi). Zadne heslo se nikdy nezadava do hry ani do serveru.
     */
    default String authUrl() { return ""; }

    /** Nabizene zpusoby prihlaseni na dane platforme. */
    default List<String> ssoOptions() { return List.of(); }

    /** Dokonci prihlaseni ulozenim tokenu; vraci null pri uspechu, jinak chybu. */
    default String finishAuth(String token) { return "Tato platforma prihlaseni nepodporuje."; }

    /** Overi vlastnictvi placeneho produktu. */
    default boolean verifyOwnership(PluginEntry entry) { return true; }

    /** HTTP hlavicky pro stazeni (napr. autorizace). */
    default java.util.Map<String, String> downloadHeaders() { return java.util.Map.of(); }
}
