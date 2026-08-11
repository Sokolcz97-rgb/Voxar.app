package com.studiovoxario.voxarioforge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.NamespacedKey;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeModifier;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.inventory.EquipmentSlotGroup;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Nacita obsah ze slozek sources/&lt;zdroj&gt;/ (items, models, textures)
 * a stavi z nej ItemStacky. Klice jsou ve tvaru "zdroj:id".
 */
public final class ContentRegistry {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacyAmpersand();

    private final VoxarioForge plugin;
    private final Map<String, Construct> constructs = new LinkedHashMap<>();
    private final Map<String, File> blueprints = new LinkedHashMap<>();
    private final Map<String, File> textures = new LinkedHashMap<>();

    public ContentRegistry(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public Map<String, Construct> constructs() {
        return constructs;
    }

    public Map<String, File> blueprints() {
        return blueprints;
    }

    public Map<String, File> textures() {
        return textures;
    }

    public static String key(String source, String id) {
        return source.toLowerCase(Locale.ROOT) + ":" + id.toLowerCase(Locale.ROOT);
    }

    /** Prijme "zdroj:id" i holé "id". */
    public Construct get(String id) {
        if (id == null) return null;
        String low = id.toLowerCase(Locale.ROOT);
        Construct direct = constructs.get(low);
        if (direct != null) return direct;
        for (Construct c : constructs.values()) if (c.id().equals(low)) return c;
        return null;
    }

    public List<Construct> bySource(String source) {
        List<Construct> out = new ArrayList<>();
        for (Construct c : constructs.values()) {
            if (source == null || source.equalsIgnoreCase(c.pack())) out.add(c);
        }
        return out;
    }

    public List<String> categories() {
        List<String> out = new ArrayList<>();
        for (Construct c : constructs.values()) {
            if (c.category() != null && !out.contains(c.category())) out.add(c.category());
        }
        return out;
    }

    /** Cesta modelu v resource packu: item/&lt;zdroj&gt;/&lt;id&gt; */
    public static String modelPath(Construct c) {
        return c.pack().toLowerCase(Locale.ROOT) + "/" + c.id();
    }

    public File blueprintOf(Construct c) {
        if (c.blueprint() == null || c.blueprint().isBlank()) return null;
        String bp = c.blueprint().toLowerCase(Locale.ROOT);
        File own = blueprints.get(key(c.pack(), bp));
        if (own != null) return own;
        for (Map.Entry<String, File> e : blueprints.entrySet()) {
            if (e.getKey().endsWith(":" + bp)) return e.getValue();
        }
        return null;
    }

    public File textureOf(Construct c, String name) {
        String low = name.toLowerCase(Locale.ROOT);
        File own = textures.get(key(c.pack(), low));
        if (own != null) return own;
        for (Map.Entry<String, File> e : textures.entrySet()) {
            if (e.getKey().endsWith(":" + low)) return e.getValue();
        }
        return null;
    }

    public void reload() {
        constructs.clear();
        blueprints.clear();
        textures.clear();

        for (SourceManager.Source source : plugin.sources().sources().values()) {
            if (!source.enabled()) continue;
            scanModels(source);
            scanTextures(source);
            scanItems(source);
        }

        plugin.getLogger().info("Nacteno " + constructs.size() + " constructs, "
                + blueprints.size() + " modelu a " + textures.size() + " textur z "
                + plugin.sources().enabled().size() + " zdroju.");
    }

    private void scanModels(SourceManager.Source source) {
        walk(source.models(), f -> {
            String n = f.getName().toLowerCase(Locale.ROOT);
            if (!(n.endsWith(".bbmodel") || n.endsWith(".iaentitymodel") || n.endsWith(".json"))) return;
            String base = n.substring(0, n.lastIndexOf('.'));
            blueprints.put(key(source.id(), base), f);
        });
    }

    private void scanTextures(SourceManager.Source source) {
        walk(source.textures(), f -> {
            String n = f.getName().toLowerCase(Locale.ROOT);
            if (!n.endsWith(".png")) return;
            textures.put(key(source.id(), n.substring(0, n.length() - 4)), f);
        });
    }

    private void scanItems(SourceManager.Source source) {
        walk(source.items(), f -> {
            String n = f.getName().toLowerCase(Locale.ROOT);
            if (!(n.endsWith(".yml") || n.endsWith(".yaml"))) return;
            try {
                for (Construct c : ItemImporter.parse(source, f)) {
                    constructs.put(key(source.id(), c.id()), c);
                }
            } catch (Exception e) {
                plugin.getLogger().warning("Chyba v " + f.getName() + ": " + e.getMessage());
            }
        });
    }

    private void walk(File dir, java.util.function.Consumer<File> consumer) {
        if (dir == null || !dir.isDirectory()) return;
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) walk(f, consumer);
            else consumer.accept(f);
        }
    }

    /** Vytvori ItemStack pro Construct vcetne item_model komponenty a PDC znacky. */
    public ItemStack build(Construct c, int amount) {
        ItemStack stack = new ItemStack(c.material(), Math.max(1, amount));
        ItemMeta meta = stack.getItemMeta();
        if (meta == null) return stack;

        meta.displayName(LEGACY.deserialize(c.display()).decoration(TextDecoration.ITALIC, false));

        if (!c.lore().isEmpty()) {
            List<Component> lore = new ArrayList<>();
            for (String line : c.lore()) {
                lore.add(LEGACY.deserialize(line).decoration(TextDecoration.ITALIC, false));
            }
            meta.lore(lore);
        }

        if (c.blueprint() != null && !c.blueprint().isBlank()) {
            meta.setItemModel(new NamespacedKey(plugin.namespace(), modelPath(c)));
        }

        meta.setUnbreakable(c.unbreakable());
        if (c.hideFlags()) meta.addItemFlags(ItemFlag.values());

        for (Map.Entry<String, Integer> e : c.enchants().entrySet()) {
            Enchantment ench = plugin.lookupEnchantment(e.getKey());
            if (ench != null) meta.addEnchant(ench, e.getValue(), true);
        }

        applyAttribute(meta, c, "attack-damage", Attribute.ATTACK_DAMAGE);
        applyAttribute(meta, c, "attack-speed", Attribute.ATTACK_SPEED);
        applyAttribute(meta, c, "armor", Attribute.ARMOR);
        applyAttribute(meta, c, "armor-toughness", Attribute.ARMOR_TOUGHNESS);
        applyAttribute(meta, c, "max-health", Attribute.MAX_HEALTH);
        applyAttribute(meta, c, "movement-speed", Attribute.MOVEMENT_SPEED);
        applyAttribute(meta, c, "knockback-resistance", Attribute.KNOCKBACK_RESISTANCE);

        meta.getPersistentDataContainer().set(plugin.constructKey(), PersistentDataType.STRING,
                key(c.pack(), c.id()));
        stack.setItemMeta(meta);
        return stack;
    }

    private void applyAttribute(ItemMeta meta, Construct c, String cfgKey, Attribute attribute) {
        Double value = c.attributes().get(cfgKey);
        if (value == null) return;
        AttributeModifier mod = new AttributeModifier(
                new NamespacedKey(plugin.namespace(), c.pack() + "_" + c.id() + "_" + cfgKey),
                value,
                AttributeModifier.Operation.ADD_NUMBER,
                EquipmentSlotGroup.MAINHAND
        );
        meta.addAttributeModifier(attribute, mod);
    }
}
