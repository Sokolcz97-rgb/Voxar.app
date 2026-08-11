package com.studiovoxario.voxarioforge;

import org.bukkit.Material;

import java.util.List;
import java.util.Map;

/**
 * Station = RPG pracoviste (kovadlina, verpanek, alchymie...).
 */
public record Station(
        String id,
        String type,          // craft | anvil
        String title,
        Material icon,
        Material vanilla,     // vanilla blok, ktery station nahrazuje (nepovinne)
        List<Recipe> recipes
) {

    /** Jeden predpis. Pro craft se pouziva shape+ingredients, pro anvil input+material. */
    public record Recipe(
            String type,
            List<String> shape,
            Map<Character, String> ingredients,
            String input,
            String material,
            int materialAmount,
            String result,
            int amount,
            int cost
    ) {
    }
}
