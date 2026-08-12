package com.studiovoxario.voxarioforge;

import org.bukkit.Material;

import java.util.List;
import java.util.Map;

/**
 * Construct = jedna polozka vlastniho obsahu (item, blok, nabytek).
 *
 * textures  = mapa slotu modelu -> nazev/cesta PNG (napr. {"0": "sword/blade", "1": "sword/hilt"})
 * texturePath = volitelna slozka (prefix) pro hledani textur teto polozky
 */
public record Construct(
        String pack,
        String id,
        String display,
        Material material,
        String blueprint,
        String category,
        List<String> lore,
        boolean unbreakable,
        boolean hideFlags,
        boolean fixture,
        float fixtureScale,
        float fixtureWidth,
        float fixtureHeight,
        Map<String, Double> attributes,
        Map<String, Integer> enchants,
        Map<String, String> textures,
        String texturePath
) {
    public String key() {
        return id;
    }
}
