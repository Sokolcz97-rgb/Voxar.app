package com.studiovoxario.voxarioforge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * RPG GUI - nejdriv vyber zdroje (Voxario / ItemsAdder / Oraxen / Nexo),
 * pak prohlizec obsahu daneho zdroje. Vzhled se bere z sources/&lt;zdroj&gt;/gui/gui.yml.
 */
public final class ForgeGUI implements Listener {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacyAmpersand();

    private final VoxarioForge plugin;

    public ForgeGUI(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public static final class Holder implements InventoryHolder {
        private final int page;
        private final String source;
        private final String category;
        private final boolean menu;
        private final List<String> sourceSlots = new ArrayList<>();
        private Inventory inventory;

        Holder(int page, String source, String category, boolean menu) {
            this.page = page;
            this.source = source;
            this.category = category;
            this.menu = menu;
        }

        @Override
        public Inventory getInventory() {
            return inventory;
        }
    }

    // ------------------------------------------------------------- hlavni menu

    public void openMenu(Player player) {
        Holder holder = new Holder(0, null, null, true);
        Component title = LEGACY.deserialize(plugin.getConfig()
                .getString("gui.title", "&6&l⚒ &e&lVOXARIO FORGE &6&l⚒"));
        Inventory inv = Bukkit.createInventory(holder, 45, title);
        holder.inventory = inv;

        ItemStack frame = icon(Material.BLACK_STAINED_GLASS_PANE, "&8✧", List.of());
        for (int i = 0; i < 45; i++) inv.setItem(i, frame);

        int[] slots = {20, 22, 24, 30, 32, 28, 34};
        int i = 0;
        for (SourceManager.Source source : plugin.sources().enabled()) {
            if (i >= slots.length) break;
            int count = plugin.registry().bySource(source.id()).size();
            inv.setItem(slots[i], icon(source.icon(), source.display(), List.of(
                    "&7Format: &f" + source.format(),
                    "&7Obsah: &b" + count + " &7itemu",
                    "&7Slozka: &8sources/" + source.id() + "/",
                    "",
                    "&e➤ Klikni pro otevreni")));
            holder.sourceSlots.add(source.id());
            i++;
        }
        while (holder.sourceSlots.size() < slots.length) holder.sourceSlots.add(null);

        inv.setItem(4, icon(Material.ENCHANTING_TABLE, "&6&lFORGE TERMINAL", List.of(
                "&7Vyber zdroj obsahu.",
                "&7Kazdy plugin ma vlastni slozku",
                "&7s modely, texturami a configy.")));
        inv.setItem(38, icon(Material.ANVIL, "&e⚒ Sestavit resource pack", List.of("&7Zkompiluje ZIP a posle hracum.")));
        inv.setItem(40, icon(Material.BOOK, "&e✎ Reload obsahu", List.of("&7Znovu nacte vsechny zdroje.")));
        inv.setItem(42, icon(Material.HOPPER, "&e⇩ Importy", List.of(
                "&7ZIP hod do &fplugins/VoxarioForge/imports/",
                "&7Rozbali se sam do spravneho zdroje.")));

        player.openInventory(inv);
    }

    // -------------------------------------------------------------- prohlizec

    public void open(Player player, int page, String category) {
        open(player, page, null, category);
    }

    public void open(Player player, int page, String source, String category) {
        if (source == null) {
            openMenu(player);
            return;
        }
        SourceManager.Source src = plugin.sources().get(source);
        YamlConfiguration theme = theme(src);

        int rows = Math.max(3, Math.min(6, theme.getInt("rows", 6)));
        Holder holder = new Holder(page, source, category, false);
        Component title = LEGACY.deserialize(theme.getString("title",
                (src == null ? "&bForge" : src.display()) + " &8| &7Forge"));
        Inventory inv = Bukkit.createInventory(holder, rows * 9, title);
        holder.inventory = inv;

        List<Construct> list = new ArrayList<>();
        for (Construct c : plugin.registry().bySource(source)) {
            if (category == null || category.equalsIgnoreCase(c.category())) list.add(c);
        }

        int perPage = (rows - 1) * 9;
        int from = page * perPage;
        for (int i = 0; i < perPage && from + i < list.size(); i++) {
            Construct c = list.get(from + i);
            ItemStack item = plugin.registry().build(c, 1);
            ItemMeta meta = item.getItemMeta();
            if (meta != null) {
                List<Component> lore = meta.lore() != null ? new ArrayList<>(meta.lore()) : new ArrayList<>();
                lore.add(Component.empty());
                lore.add(gray("ID: " + c.pack() + ":" + c.id()));
                lore.add(gray("Model: " + (c.blueprint() == null ? "-" : c.blueprint())
                        + (c.blueprint() != null && plugin.registry().blueprintOf(c) == null ? " (CHYBI!)" : "")));
                lore.add(Component.text("Klik = 1x | Shift = 64x", NamedTextColor.GOLD)
                        .decoration(TextDecoration.ITALIC, false));
                meta.lore(lore);
                item.setItemMeta(meta);
            }
            inv.setItem(i, item);
        }

        int base = (rows - 1) * 9;
        if (theme.getBoolean("frame.enabled", true)) {
            Material fm = Material.matchMaterial(theme.getString("frame.material", "BLACK_STAINED_GLASS_PANE"));
            ItemStack frame = icon(fm == null ? Material.BLACK_STAINED_GLASS_PANE : fm,
                    theme.getString("frame.name", "&8|"), List.of());
            for (int i = base; i < rows * 9; i++) inv.setItem(i, frame);
        }

        inv.setItem(base, icon(mat(theme, "buttons.back", Material.ARROW), "&e◀ Predchozi", List.of()));
        inv.setItem(base + 4, icon(mat(theme, "buttons.info", Material.NETHER_STAR),
                "&fStrana &6" + (page + 1), List.of("&7Polozek: &b" + list.size(), "&7Zdroj: &f" + source)));
        inv.setItem(base + 8, icon(mat(theme, "buttons.next", Material.ARROW), "&eDalsi ▶", List.of()));
        inv.setItem(base + 2, icon(mat(theme, "buttons.build", Material.ANVIL), "&6⚒ Sestavit pack", List.of()));
        inv.setItem(base + 6, icon(mat(theme, "buttons.reload", Material.BOOK), "&6✎ Reload", List.of()));
        inv.setItem(base + 3, icon(mat(theme, "buttons.home", Material.COMPASS), "&e⌂ Zpet na vyber pluginu", List.of()));

        player.openInventory(inv);
    }

    private YamlConfiguration theme(SourceManager.Source src) {
        if (src == null) return new YamlConfiguration();
        File file = new File(src.gui(), "gui.yml");
        return file.isFile() ? YamlConfiguration.loadConfiguration(file) : new YamlConfiguration();
    }

    private Material mat(YamlConfiguration theme, String path, Material def) {
        Material m = Material.matchMaterial(theme.getString(path, def.name()));
        return m == null ? def : m;
    }

    private Component gray(String text) {
        return Component.text(text, NamedTextColor.DARK_GRAY).decoration(TextDecoration.ITALIC, false);
    }

    private ItemStack icon(Material material, String name, List<String> lore) {
        ItemStack stack = new ItemStack(material == null ? Material.PAPER : material);
        ItemMeta meta = stack.getItemMeta();
        if (meta != null) {
            meta.displayName(LEGACY.deserialize(name).decoration(TextDecoration.ITALIC, false));
            if (!lore.isEmpty()) {
                List<Component> out = new ArrayList<>();
                for (String l : lore) out.add(LEGACY.deserialize(l).decoration(TextDecoration.ITALIC, false));
                meta.lore(out);
            }
            stack.setItemMeta(meta);
        }
        return stack;
    }

    // ------------------------------------------------------------------ klik

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof Holder holder)) return;
        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player)) return;

        int slot = event.getRawSlot();
        if (slot < 0 || slot >= event.getInventory().getSize()) return;

        if (holder.menu) {
            int[] slots = {20, 22, 24, 30, 32, 28, 34};
            for (int i = 0; i < slots.length; i++) {
                if (slot == slots[i] && i < holder.sourceSlots.size() && holder.sourceSlots.get(i) != null) {
                    open(player, 0, holder.sourceSlots.get(i), null);
                    return;
                }
            }
            if (slot == 38 && player.hasPermission("voxarioforge.admin")) {
                player.closeInventory();
                plugin.rebuildPack(player);
            } else if (slot == 40 && player.hasPermission("voxarioforge.admin")) {
                plugin.reloadContent();
                openMenu(player);
            }
            return;
        }

        int rows = event.getInventory().getSize() / 9;
        int base = (rows - 1) * 9;

        if (slot == base) {
            if (holder.page > 0) open(player, holder.page - 1, holder.source, holder.category);
            return;
        }
        if (slot == base + 8) {
            open(player, holder.page + 1, holder.source, holder.category);
            return;
        }
        if (slot == base + 3) {
            openMenu(player);
            return;
        }
        if (slot == base + 2) {
            if (!player.hasPermission("voxarioforge.admin")) return;
            player.closeInventory();
            plugin.rebuildPack(player);
            return;
        }
        if (slot == base + 6) {
            if (!player.hasPermission("voxarioforge.admin")) return;
            plugin.reloadContent();
            open(player, 0, holder.source, holder.category);
            return;
        }
        if (slot >= base) return;

        Construct construct = plugin.constructOf(event.getInventory().getItem(slot));
        if (construct == null) return;
        int amount = event.isShiftClick() ? 64 : 1;
        player.getInventory().addItem(plugin.registry().build(construct, amount));
        player.sendActionBar(Component.text("+" + amount + "x " + construct.id(), NamedTextColor.GOLD));
    }
}
