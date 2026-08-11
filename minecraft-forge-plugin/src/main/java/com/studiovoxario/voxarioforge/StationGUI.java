package com.studiovoxario.voxarioforge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.Sound;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.List;

/**
 * RPG stanice - kovadlina, verpanek a dalsi vlastni pracoviste.
 */
public final class StationGUI implements Listener {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacyAmpersand();

    private static final int[] CRAFT_SLOTS = {10, 11, 12, 19, 20, 21, 28, 29, 30};
    private static final int[] ANVIL_SLOTS = {20, 22};
    private static final int RESULT_SLOT = 24;

    private final VoxarioForge plugin;

    public StationGUI(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public static final class Holder implements InventoryHolder {
        private final Station station;
        private Inventory inventory;
        private Station.Recipe pending;

        Holder(Station station) {
            this.station = station;
        }

        @Override
        public Inventory getInventory() {
            return inventory;
        }
    }

    private int[] inputs(Station station) {
        return "anvil".equals(station.type()) ? ANVIL_SLOTS : CRAFT_SLOTS;
    }

    public void open(Player player, Station station) {
        Holder holder = new Holder(station);
        Inventory inv = Bukkit.createInventory(holder, 54,
                LEGACY.deserialize(station.title()).decoration(TextDecoration.ITALIC, false));
        holder.inventory = inv;

        ItemStack frame = decor(Material.BLACK_STAINED_GLASS_PANE, " ", null);
        ItemStack accent = decor(Material.CYAN_STAINED_GLASS_PANE, " ", null);
        for (int i = 0; i < 54; i++) inv.setItem(i, frame);
        for (int i = 0; i < 9; i++) inv.setItem(i, accent);
        for (int i = 45; i < 54; i++) inv.setItem(i, accent);

        for (int slot : inputs(station)) inv.setItem(slot, null);
        inv.setItem(RESULT_SLOT, null);

        inv.setItem(23, decor(Material.SPECTRAL_ARROW, "&8>>", List.of("&7Vysledek vpravo")));
        inv.setItem(4, decor(station.icon(), station.title(),
                List.of("&7Receptu: &b" + station.recipes().size(),
                        "&8Vloz suroviny do slotu vlevo")));
        inv.setItem(49, decor(Material.BOOK, "&eSeznam receptu",
                List.of("&7Klikni pro zobrazeni v chatu")));

        player.openInventory(inv);
        player.playSound(player.getLocation(), Sound.BLOCK_BEACON_ACTIVATE, 0.4f, 1.6f);
    }

    private ItemStack decor(Material material, String name, List<String> lore) {
        ItemStack stack = new ItemStack(material);
        ItemMeta meta = stack.getItemMeta();
        if (meta != null) {
            meta.displayName(LEGACY.deserialize(name).decoration(TextDecoration.ITALIC, false));
            if (lore != null) {
                List<Component> l = new ArrayList<>();
                for (String s : lore) l.add(LEGACY.deserialize(s).decoration(TextDecoration.ITALIC, false));
                meta.lore(l);
            }
            meta.addItemFlags(org.bukkit.inventory.ItemFlag.values());
            stack.setItemMeta(meta);
        }
        return stack;
    }

    @EventHandler
    public void onInteract(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK) return;
        if (event.getPlayer().isSneaking()) return;
        Block block = event.getClickedBlock();
        if (block == null) return;
        Station station = plugin.stations().byVanilla(block.getType());
        if (station == null) return;
        event.setCancelled(true);
        open(event.getPlayer(), station);
    }

    @EventHandler
    public void onDrag(InventoryDragEvent event) {
        if (!(event.getInventory().getHolder() instanceof Holder holder)) return;
        for (int slot : event.getRawSlots()) {
            if (slot >= event.getInventory().getSize()) continue;
            if (!isInput(holder, slot)) {
                event.setCancelled(true);
                return;
            }
        }
        recomputeLater(holder);
    }

    private boolean isInput(Holder holder, int slot) {
        for (int s : inputs(holder.station)) if (s == slot) return true;
        return false;
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof Holder holder)) return;
        if (!(event.getWhoClicked() instanceof Player player)) return;

        int slot = event.getRawSlot();
        boolean topInventory = slot >= 0 && slot < event.getInventory().getSize();

        if (!topInventory) {
            if (event.isShiftClick()) event.setCancelled(true);
            return;
        }

        if (slot == RESULT_SLOT) {
            event.setCancelled(true);
            takeResult(player, holder);
            return;
        }

        if (slot == 49) {
            event.setCancelled(true);
            listRecipes(player, holder.station);
            return;
        }

        if (!isInput(holder, slot)) {
            event.setCancelled(true);
            return;
        }
        recomputeLater(holder);
    }

    private void recomputeLater(Holder holder) {
        Scheduling.globalLater(plugin, () -> recompute(holder), 1L);
    }

    private void recompute(Holder holder) {
        Inventory inv = holder.inventory;
        if (inv == null) return;
        Station.Recipe match = findMatch(holder);
        holder.pending = match;
        if (match == null) {
            inv.setItem(RESULT_SLOT, null);
            return;
        }
        ItemStack result = plugin.stations().token(match.result(), match.amount());
        if (result == null) {
            inv.setItem(RESULT_SLOT, null);
            return;
        }
        ItemMeta meta = result.getItemMeta();
        if (meta != null) {
            List<Component> lore = meta.lore() != null ? new ArrayList<>(meta.lore()) : new ArrayList<>();
            lore.add(Component.empty());
            lore.add(Component.text("Klikni pro vytvoreni", NamedTextColor.AQUA)
                    .decoration(TextDecoration.ITALIC, false));
            if (match.cost() > 0) {
                lore.add(Component.text("Cena: " + match.cost() + " levelu", NamedTextColor.GOLD)
                        .decoration(TextDecoration.ITALIC, false));
            }
            meta.lore(lore);
            result.setItemMeta(meta);
        }
        inv.setItem(RESULT_SLOT, result);
    }

    private Station.Recipe findMatch(Holder holder) {
        Inventory inv = holder.inventory;
        Station station = holder.station;

        for (Station.Recipe r : station.recipes()) {
            if ("anvil".equals(station.type())) {
                ItemStack in = inv.getItem(ANVIL_SLOTS[0]);
                ItemStack mat = inv.getItem(ANVIL_SLOTS[1]);
                if (!plugin.stations().matches(r.input(), in)) continue;
                if (r.material() != null) {
                    if (!plugin.stations().matches(r.material(), mat)) continue;
                    if (mat == null || mat.getAmount() < Math.max(1, r.materialAmount())) continue;
                } else if (mat != null && !mat.getType().isAir()) {
                    continue;
                }
                return r;
            }

            List<String> shape = r.shape();
            boolean ok = true;
            for (int row = 0; row < 3 && ok; row++) {
                String line = row < shape.size() ? shape.get(row) : "   ";
                for (int col = 0; col < 3; col++) {
                    char ch = col < line.length() ? line.charAt(col) : ' ';
                    String token = ch == ' ' ? null : r.ingredients().get(ch);
                    ItemStack stack = inv.getItem(CRAFT_SLOTS[row * 3 + col]);
                    if (token == null) {
                        if (stack != null && !stack.getType().isAir()) {
                            ok = false;
                            break;
                        }
                    } else if (!plugin.stations().matches(token, stack)) {
                        ok = false;
                        break;
                    }
                }
            }
            if (ok) return r;
        }
        return null;
    }

    private void takeResult(Player player, Holder holder) {
        Station.Recipe recipe = holder.pending;
        Inventory inv = holder.inventory;
        if (recipe == null || inv == null) return;

        if (recipe.cost() > 0 && player.getLevel() < recipe.cost() && player.getGameMode() != org.bukkit.GameMode.CREATIVE) {
            player.sendActionBar(Component.text("Potrebujes " + recipe.cost() + " levelu.", NamedTextColor.RED));
            return;
        }

        ItemStack result = plugin.stations().token(recipe.result(), recipe.amount());
        if (result == null) return;

        if ("anvil".equals(holder.station.type())) {
            inv.setItem(ANVIL_SLOTS[0], null);
            consume(inv, ANVIL_SLOTS[1], Math.max(1, recipe.materialAmount()));
        } else {
            for (int slot : CRAFT_SLOTS) consume(inv, slot, 1);
        }

        if (recipe.cost() > 0 && player.getGameMode() != org.bukkit.GameMode.CREATIVE) {
            player.setLevel(Math.max(0, player.getLevel() - recipe.cost()));
        }

        player.getInventory().addItem(result).values()
                .forEach(left -> player.getWorld().dropItemNaturally(player.getLocation(), left));
        player.playSound(player.getLocation(),
                "anvil".equals(holder.station.type()) ? Sound.BLOCK_ANVIL_USE : Sound.BLOCK_SMITHING_TABLE_USE,
                0.7f, 1.2f);
        recompute(holder);
    }

    private void consume(Inventory inv, int slot, int amount) {
        ItemStack stack = inv.getItem(slot);
        if (stack == null || stack.getType().isAir()) return;
        if (stack.getAmount() <= amount) inv.setItem(slot, null);
        else stack.setAmount(stack.getAmount() - amount);
    }

    private void listRecipes(Player player, Station station) {
        player.sendMessage(Component.text("Recepty - " + station.id() + ":", NamedTextColor.AQUA));
        for (Station.Recipe r : station.recipes()) {
            String in = "anvil".equals(station.type())
                    ? r.input() + (r.material() == null ? "" : " + " + r.materialAmount() + "x " + r.material())
                    : String.join(" / ", r.shape());
            player.sendMessage(Component.text(" - " + in + "  ->  " + r.amount() + "x " + r.result()
                    + (r.cost() > 0 ? " (" + r.cost() + " lvl)" : ""), NamedTextColor.GRAY));
        }
    }

    @EventHandler
    public void onClose(InventoryCloseEvent event) {
        if (!(event.getInventory().getHolder() instanceof Holder holder)) return;
        if (!(event.getPlayer() instanceof Player player)) return;
        Inventory inv = event.getInventory();
        for (int slot : inputs(holder.station)) {
            ItemStack stack = inv.getItem(slot);
            if (stack == null || stack.getType().isAir()) continue;
            inv.setItem(slot, null);
            player.getInventory().addItem(stack).values()
                    .forEach(left -> player.getWorld().dropItemNaturally(player.getLocation(), left));
        }
        inv.setItem(RESULT_SLOT, null);
    }
}
