package com.studiovoxario.voxarioforge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeModifier;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.inventory.EquipmentSlotGroup;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Nacita packy (plugins/VoxarioForge/packs/&lt;pack&gt;/items.yml) a stavi z nich ItemStacky.
 */
public final class ContentRegistry {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacyAmpersand();

    private final VoxarioForge plugin;
    private final Map<String, Construct> constructs = new LinkedHashMap<>();
    private final Map<String, File> blueprints = new LinkedHashMap<>();

    public ContentRegistry(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public Map<String, Construct> constructs() {
        return constructs;
    }

    public Map<String, File> blueprints() {
        return blueprints;
    }

    public Construct get(String id) {
        return constructs.get(id);
    }

    public List<String> categories() {
        List<String> out = new ArrayList<>();
        for (Construct c : constructs.values()) {
            if (c.category() != null && !out.contains(c.category())) out.add(c.category());
        }
        return out;
    }

    public void reload() {
        constructs.clear();
        blueprints.clear();

        File packsDir = new File(plugin.getDataFolder(), "packs");
        if (!packsDir.isDirectory()) return;

        File[] packs = packsDir.listFiles(File::isDirectory);
        if (packs == null) return;

        for (File pack : packs) {
            File items = new File(pack, "items.yml");
            if (items.isFile()) loadItems(pack.getName(), items);

            File bpDir = new File(pack, "blueprints");
            File[] bbs = bpDir.listFiles((d, n) -> {
                String low = n.toLowerCase(Locale.ROOT);
                return low.endsWith(".bbmodel") || low.endsWith(".iaentitymodel") || low.endsWith(".json");
            });
            if (bbs != null) {
                for (File bb : bbs) {
                    String n = bb.getName();
                    String name = n.substring(0, n.lastIndexOf('.'));
                    blueprints.put(name.toLowerCase(Locale.ROOT), bb);
                }
            }
        }
        plugin.getLogger().info("Nacteno " + constructs.size() + " constructs a " + blueprints.size() + " blueprints.");
    }

    private void loadItems(String packName, File file) {
        YamlConfiguration yml = YamlConfiguration.loadConfiguration(file);
        ConfigurationSection root = yml.getConfigurationSection("constructs");
        if (root == null) return;

        for (String id : root.getKeys(false)) {
            ConfigurationSection s = root.getConfigurationSection(id);
            if (s == null) continue;
            Material mat = Material.matchMaterial(s.getString("material", "PAPER"));
            if (mat == null) {
                plugin.getLogger().warning("Construct '" + id + "': neznamy material, preskakuji.");
                continue;
            }

            Map<String, Double> attrs = new HashMap<>();
            ConfigurationSection as = s.getConfigurationSection("attributes");
            if (as != null) for (String k : as.getKeys(false)) attrs.put(k, as.getDouble(k));

            Map<String, Integer> ench = new HashMap<>();
            ConfigurationSection es = s.getConfigurationSection("enchants");
            if (es != null) for (String k : es.getKeys(false)) ench.put(k, es.getInt(k));

            List<Double> hb = s.getDoubleList("fixture-hitbox");
            float w = hb.size() > 0 ? hb.get(0).floatValue() : 1.0f;
            float h = hb.size() > 1 ? hb.get(1).floatValue() : 1.0f;

            constructs.put(id.toLowerCase(Locale.ROOT), new Construct(
                    packName,
                    id.toLowerCase(Locale.ROOT),
                    s.getString("display", id),
                    mat,
                    s.getString("blueprint"),
                    s.getString("category", "misc"),
                    s.getStringList("lore"),
                    s.getBoolean("unbreakable", false),
                    s.getBoolean("hide-flags", false),
                    s.getBoolean("fixture", false),
                    (float) s.getDouble("fixture-scale", 1.0),
                    w, h,
                    attrs, ench
            ));
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
            meta.setItemModel(new NamespacedKey(plugin.namespace(), c.id()));
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

        meta.getPersistentDataContainer().set(plugin.constructKey(), PersistentDataType.STRING, c.id());
        stack.setItemMeta(meta);
        return stack;
    }

    private void applyAttribute(ItemMeta meta, Construct c, String cfgKey, Attribute attribute) {
        Double value = c.attributes().get(cfgKey);
        if (value == null) return;
        AttributeModifier mod = new AttributeModifier(
                new NamespacedKey(plugin.namespace(), c.id() + "_" + cfgKey),
                value,
                AttributeModifier.Operation.ADD_NUMBER,
                EquipmentSlotGroup.MAINHAND
        );
        meta.addAttributeModifier(attribute, mod);
    }
}
