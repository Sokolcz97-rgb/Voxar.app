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

    /** Nalezena textura: relativni cesta (bez .png) + soubor na disku. */
    public record Tex(String relPath, File file) {
    }

    public File textureOf(Construct c, String name) {
        Tex t = findTexture(c, name);
        return t == null ? null : t.file();
    }

    /**
     * Najde texturu podle reference z configu. Zkousi (v tomto poradi):
     * texture-path + ref, samotny ref, jen nazev souboru - nejdriv ve vlastnim
     * zdroji, pak ve vsech ostatnich.
     */
    public Tex findTexture(Construct c, String ref) {
        if (ref == null || ref.isBlank()) return null;
        String base = normalize(ref);
        List<String> candidates = new ArrayList<>();
        if (c != null && c.texturePath() != null && !c.texturePath().isBlank()) {
            candidates.add(normalize(c.texturePath()) + "/" + base);
        }
        candidates.add(base);
        int slash = base.lastIndexOf('/');
        if (slash >= 0) candidates.add(base.substring(slash + 1));

        String pack = c == null ? null : c.pack();
        for (String cand : candidates) {
            Tex t = lookup(pack, cand);
            if (t != null) return t;
        }
        return null;
    }

    private Tex lookup(String pack, String path) {
        if (pack != null) {
            File own = textures.get(key(pack, path));
            if (own != null) return new Tex(path, own);
            String alias = textureAliases.get(key(pack, path));
            if (alias != null) return new Tex(alias, textures.get(key(pack, alias)));
        }
        for (Map.Entry<String, File> e : textures.entrySet()) {
            if (e.getKey().endsWith(":" + path)) {
                return new Tex(e.getKey().substring(e.getKey().indexOf(':') + 1), e.getValue());
            }
        }
        for (Map.Entry<String, String> e : textureAliases.entrySet()) {
            if (e.getKey().endsWith(":" + path)) {
                String src = e.getKey().substring(0, e.getKey().indexOf(':'));
                File f = textures.get(key(src, e.getValue()));
                if (f != null) return new Tex(e.getValue(), f);
            }
        }
        return null;
    }

    private static String normalize(String raw) {
        String p = raw.replace('\\', '/').toLowerCase(Locale.ROOT).trim();
        while (p.startsWith("/")) p = p.substring(1);
        if (p.endsWith(".png")) p = p.substring(0, p.length() - 4);
        return p;
    }

    public void reload() {
        constructs.clear();
        blueprints.clear();
        textures.clear();
        textureAliases.clear();

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
        for (File dir : source.textureDirs()) {
            if (dir == null || !dir.isDirectory()) continue;
            String root = dir.getAbsolutePath();
            walk(dir, f -> {
                String n = f.getName().toLowerCase(Locale.ROOT);
                if (!n.endsWith(".png")) return;
                String rel = f.getAbsolutePath().substring(root.length())
                        .replace('\\', '/').toLowerCase(Locale.ROOT);
                while (rel.startsWith("/")) rel = rel.substring(1);
                rel = rel.substring(0, rel.length() - 4);
                textures.put(key(source.id(), rel), f);
                String simple = n.substring(0, n.length() - 4);
                if (!simple.equals(rel)) textureAliases.putIfAbsent(key(source.id(), simple), rel);
            });
        }
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
