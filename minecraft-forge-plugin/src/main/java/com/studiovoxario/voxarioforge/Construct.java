package com.studiovoxario.voxarioforge;

import org.bukkit.Material;

import java.util.List;
import java.util.Map;

/**
 * Construct = jedna polozka vlastniho obsahu (item, nastroj, nabytek).
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
        Map<String, Integer> enchants
) {
    public String key() {
        return id;
    }
}
