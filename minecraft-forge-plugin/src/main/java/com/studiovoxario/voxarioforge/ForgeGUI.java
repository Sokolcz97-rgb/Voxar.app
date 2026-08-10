package com.studiovoxario.voxarioforge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.List;

/**
 * GUI prohlizec obsahu (Forge Terminal).
 */
public final class ForgeGUI implements Listener {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacyAmpersand();

    private final VoxarioForge plugin;

    public ForgeGUI(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    /** Marker holder, aby GUI slo poznat pri kliku. */
    public static final class Holder implements InventoryHolder {
        private final int page;
        private final String category;
        private Inventory inventory;

        Holder(int page, String category) {
            this.page = page;
            this.category = category;
        }

        @Override
        public Inventory getInventory() {
            return inventory;
        }
    }

    public void open(Player player, int page, String category) {
        int rows = Math.max(3, Math.min(6, plugin.getConfig().getInt("gui.rows", 6)));
        Holder holder = new Holder(page, category);
        Component title = LEGACY.deserialize(plugin.getConfig().getString("gui.title", "&b&lVOXARIO&f FORGE"));
        Inventory inv = Bukkit.createInventory(holder, rows * 9, title);
        holder.inventory = inv;

        List<Construct> list = new ArrayList<>();
        for (Construct c : plugin.registry().constructs().values()) {
            if (category == null || category.equalsIgnoreCase(c.category())) list.add(c);
        }

        int perPage = (rows - 1) * 9;
        int from = page * perPage;
        for (int i = 0; i < perPage && from + i < list.size(); i++) {
            Construct c = list.get(from + i);
            ItemStack icon = plugin.registry().build(c, 1);
            ItemMeta meta = icon.getItemMeta();
            if (meta != null) {
                List<Component> lore = meta.lore() != null ? new ArrayList<>(meta.lore()) : new ArrayList<>();
                lore.add(Component.empty());
                lore.add(Component.text("ID: " + c.id(), NamedTextColor.DARK_GRAY)
                        .decoration(TextDecoration.ITALIC, false));
                lore.add(Component.text("Blueprint: " + (c.blueprint() == null ? "-" : c.blueprint()),
                        NamedTextColor.DARK_GRAY).decoration(TextDecoration.ITALIC, false));
                lore.add(Component.text("Klik = ziskat 1x | Shift = 64x", NamedTextColor.AQUA)
                        .decoration(TextDecoration.ITALIC, false));
                meta.lore(lore);
                icon.setItemMeta(meta);
            }
            inv.setItem(i, icon);
        }

        int base = (rows - 1) * 9;
        inv.setItem(base, nav(Material.ARROW, "&bPredchozi strana"));
        inv.setItem(base + 4, nav(Material.NETHER_STAR,
                "&fStrana &b" + (page + 1) + "&f | Constructs: &b" + list.size()));
        inv.setItem(base + 8, nav(Material.ARROW, "&bDalsi strana"));
        inv.setItem(base + 2, nav(Material.ANVIL, "&eSestavit resource pack"));
        inv.setItem(base + 6, nav(Material.BOOK, "&eReload obsahu"));

        player.openInventory(inv);
    }

    private ItemStack nav(Material material, String name) {
        ItemStack stack = new ItemStack(material);
        ItemMeta meta = stack.getItemMeta();
        if (meta != null) {
            meta.displayName(LEGACY.deserialize(name).decoration(TextDecoration.ITALIC, false));
            stack.setItemMeta(meta);
        }
        return stack;
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof Holder holder)) return;
        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player)) return;

        int rows = event.getInventory().getSize() / 9;
        int base = (rows - 1) * 9;
        int slot = event.getRawSlot();
        if (slot < 0 || slot >= event.getInventory().getSize()) return;

        if (slot == base) {
            if (holder.page > 0) open(player, holder.page - 1, holder.category);
            return;
        }
        if (slot == base + 8) {
            open(player, holder.page + 1, holder.category);
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
            open(player, 0, holder.category);
            return;
        }
        if (slot >= base) return;

        ItemStack clicked = event.getInventory().getItem(slot);
        Construct construct = plugin.constructOf(clicked);
        if (construct == null) return;
        int amount = event.isShiftClick() ? 64 : 1;
        player.getInventory().addItem(plugin.registry().build(construct, amount));
        player.sendActionBar(Component.text("+" + amount + "x " + construct.id(), NamedTextColor.AQUA));
    }
}
