package com.studiovoxario.voxarioupdater;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;

public final class Msg {

    private Msg() {}

    public static Component color(String legacy) {
        return LegacyComponentSerializer.legacyAmpersand().deserialize(legacy);
    }

    /** Klikatelny odkaz, ktery se hraci otevre v prohlizeci. */
    public static Component link(String label, String url) {
        return Component.text(label, NamedTextColor.AQUA)
                .clickEvent(ClickEvent.openUrl(url))
                .hoverEvent(HoverEvent.showText(Component.text(url, NamedTextColor.GRAY)));
    }
}
