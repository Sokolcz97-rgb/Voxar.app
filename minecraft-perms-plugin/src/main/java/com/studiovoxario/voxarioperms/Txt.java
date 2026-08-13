package com.studiovoxario.voxarioperms;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;

public final class Txt {
    private Txt() {}

    public static Component c(String legacy) {
        return LegacyComponentSerializer.legacyAmpersand().deserialize(legacy)
                .decoration(TextDecoration.ITALIC, false);
    }

    public static String plain(String legacy) {
        return legacy.replaceAll("&[0-9a-fk-orA-FK-OR]", "");
    }
}
