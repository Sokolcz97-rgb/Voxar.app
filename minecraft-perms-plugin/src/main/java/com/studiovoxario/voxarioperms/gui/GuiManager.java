package com.studiovoxario.voxarioperms.gui;

import com.studiovoxario.voxarioperms.Applier;
import com.studiovoxario.voxarioperms.PermScanner;
import com.studiovoxario.voxarioperms.Presets;
import com.studiovoxario.voxarioperms.Presets.Role;
import com.studiovoxario.voxarioperms.Txt;
import com.studiovoxario.voxarioperms.VoxarioPerms;
import com.studiovoxario.voxarioperms.backend.PermBackend;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Kompletni GUI: backend -> plugin -> permissions -> skupina, plus sprava roli. */
public final class GuiManager implements Listener {

    public static final class Holder implements InventoryHolder {
        Inventory inv;
        @Override public Inventory getInventory() { return inv; }
    }

    private final VoxarioPerms plugin;
    private final Map<UUID, Session> sessions = new HashMap<>();

    public GuiManager(VoxarioPerms plugin) { this.plugin = plugin; }

    public Session session(Player p) {
        return sessions.computeIfAbsent(p.getUniqueId(), k -> new Session());
    }

    // ---------------------------------------------------------------- helpers

    private ItemStack item(Material m, String name, List<String> lore) {
        ItemStack it = new ItemStack(m);
        ItemMeta meta = it.getItemMeta();
        meta.displayName(Txt.c(name));
        if (lore != null && !lore.isEmpty()) {
            List<Component> l = new ArrayList<>();
            for (String s : lore) l.add(Txt.c(s));
            meta.lore(l);
        }
        it.setItemMeta(meta);
        return it;
    }

    private Inventory create(String title, int rows) {
        Holder h = new Holder();
        Inventory inv = Bukkit.createInventory(h, rows * 9, Txt.c(title));
        h.inv = inv;
        return inv;
    }

    private void nav(Inventory inv, boolean prev, boolean next) {
        if (prev) inv.setItem(45, item(Material.ARROW, "&e<- Predchozi strana", null));
        inv.setItem(49, item(Material.BARRIER, "&cZpet", List.of("&7Na predchozi menu")));
        if (next) inv.setItem(53, item(Material.ARROW, "&eDalsi strana ->", null));
    }

    // ---------------------------------------------------------------- screens

    public void openMain(Player p) {
        Session s = session(p);
        s.stage = Session.Stage.MAIN;
        Inventory inv = create("&8VoxarioPerms &7| &fHlavni menu", 5);

        PermBackend cur = plugin.backends().byId(s.backendId);
        if (cur == null) cur = plugin.backends().best();
        if (cur != null) s.backendId = cur.id();

        List<String> det = new ArrayList<>();
        for (PermBackend b : plugin.backends().available()) det.add("&a+ &f" + b.display());
        if (det.isEmpty()) det.add("&cZadny permission plugin nenalezen");

        inv.setItem(10, item(Material.COMMAND_BLOCK, "&bPermission plugin",
                List.of("&7Aktivni: &f" + (cur == null ? "zadny" : cur.display()), "", "&7Detekovano:", String.join("\n", det), "", "&eKlik pro vyber")));
        inv.setItem(12, item(Material.BOOKSHELF, "&aPluginy & permissions",
                List.of("&7Vyber plugin ze serveru a zaskrtej", "&7permise pro skupinu.", "", "&eKlik pro otevreni")));
        inv.setItem(14, item(Material.NAME_TAG, "&6Skupiny & role",
                List.of("&7Prirad skupinam role:", "&cOwner &7/ &6Admin &7/ &eModerator", "&aBuilder &7/ &bHelper &7/ &7Default", "", "&eKlik pro otevreni")));
        inv.setItem(16, item(Material.NETHER_STAR, "&cOwner: udelit &f*",
                List.of("&7Udeli wildcard &f*&7 vsem skupinam", "&7oznacenym jako OWNER.", "", "&cKlik = provest")));
        inv.setItem(31, item(Material.WRITABLE_BOOK, "&fNavod",
                List.of("&7/voxperms guide", "&7Soubory v plugins/VoxarioPerms/GUIDE/")));
        p.openInventory(inv);
    }

    public void openBackends(Player p) {
        Session s = session(p);
        s.stage = Session.Stage.BACKENDS;
        Inventory inv = create("&8VoxarioPerms &7| &fPermission plugin", 4);
        int i = 0;
        for (PermBackend b : plugin.backends().all()) {
            boolean ok = b.available();
            inv.setItem(i++, item(ok ? Material.LIME_DYE : Material.GRAY_DYE,
                    (ok ? "&a" : "&8") + b.display(),
                    List.of(ok ? "&7Stav: &aNalezen" : "&7Stav: &cNeni na serveru",
                            "&7Skupin: &f" + (ok ? b.groups().size() : 0),
                            "", ok ? "&eKlik pro pouziti" : "&cNedostupne")));
        }
        inv.setItem(31, item(Material.BARRIER, "&cZpet", null));
        p.openInventory(inv);
    }

    public void openPlugins(Player p) {
        Session s = session(p);
        s.stage = Session.Stage.PLUGINS;
        if (s.plugins == null) {
            p.sendMessage(Txt.c("&7Skenuji pluginy... (bezi na pozadi)"));
            p.closeInventory();
            boolean deep = plugin.getConfig().getBoolean("deep-scan", true);
            Bukkit.getAsyncScheduler().runNow(plugin, t -> {
                List<PermScanner.ScannedPlugin> res = plugin.scanner().cached(deep);
                Bukkit.getGlobalRegionScheduler().run(plugin, t2 -> {
                    s.plugins = res;
                    if (p.isOnline()) openPlugins(p);
                });
            });
            return;
        }
        Inventory inv = create("&8Pluginy &7| strana " + (s.page + 1), 6);
        List<PermScanner.ScannedPlugin> list = s.plugins;
        int from = s.page * 45;
        for (int i = 0; i < 45 && from + i < list.size(); i++) {
            var sp = list.get(from + i);
            inv.setItem(i, item(Material.BOOK, "&b" + sp.name,
                    List.of("&7Verze: &f" + sp.version, "&7Permissions: &f" + sp.perms.size(), "", "&eKlik pro vyber permissions")));
        }
        nav(inv, s.page > 0, from + 45 < list.size());
        inv.setItem(47, item(Material.HOPPER, "&fZnovu naskenovat", List.of("&7Projde plugins/ znovu")));
        p.openInventory(inv);
    }

    /** Seznam nodu podle filtru "skryt uz udelene". */
    private List<String> visibleNodes(Session s) {
        if (s.nodes == null) return List.of();
        if (!s.hideOwned) return s.nodes;
        List<String> out = new ArrayList<>();
        for (String n : s.nodes) if (!Boolean.TRUE.equals(s.current.get(n))) out.add(n);
        return out;
    }

    /** Vyber skupiny, pro kterou budeme permissions zobrazovat a menit. */
    public void openGroupPick(Player p) {
        Session s = session(p);
        s.stage = Session.Stage.GROUPPICK;
        PermBackend b = plugin.backends().byId(s.backendId);
        Inventory inv = create("&8Pro kterou skupinu? &7| " + (b == null ? "?" : b.display()), 6);
        List<String> groups = b == null ? List.of() : b.groups();
        for (int i = 0; i < 45 && i < groups.size(); i++) {
            String g = groups.get(i);
            Role r = plugin.roles().get(g);
            inv.setItem(i, item(Material.PLAYER_HEAD, r.color + g,
                    List.of("&7Role: " + r.color + r.label,
                            "", "&eKlik &7= nacist jeji permissions")));
        }
        if (groups.isEmpty()) {
            inv.setItem(22, item(Material.BARRIER, "&cZadne skupiny nenalezeny", null));
        }
        inv.setItem(49, item(Material.BARRIER, "&cZpet", null));
        p.openInventory(inv);
    }

    /** Nacte aktualni permissions skupiny (async) a otevre seznam permissions. */
    private void loadGroupAndOpenPerms(Player p, PermBackend b, String group) {
        Session s = session(p);
        s.targetGroup = group;
        p.sendMessage(Txt.c("&7Nacitam permissions skupiny &f" + group + "&7..."));
        Bukkit.getAsyncScheduler().runNow(plugin, t -> {
            Map<String, Boolean> map = new HashMap<>();
            try {
                Map<String, Boolean> known = b.groupPermissions(group);
                if (s.nodes != null) {
                    for (String n : s.nodes) {
                        Boolean v = known.isEmpty() ? b.has(group, n) : b.has(group, n);
                        if (v != null) map.put(n, v);
                    }
                }
                for (var en : known.entrySet()) map.putIfAbsent(en.getKey(), en.getValue());
            } catch (Throwable ignored) {}
            Bukkit.getGlobalRegionScheduler().run(plugin, t2 -> {
                s.current = map;
                if (p.isOnline()) openPerms(p);
            });
        });
    }

    public void openPerms(Player p) {
        Session s = session(p);
        s.stage = Session.Stage.PERMS;
        if (s.plugin == null) { openPlugins(p); return; }
        if (s.nodes == null) s.nodes = s.plugin.nodes();
        Inventory inv = create("&8" + s.plugin.name + " &7| perms " + (s.page + 1), 6);
        int from = s.page * 45;
        List<String> view = visibleNodes(s);
        for (int i = 0; i < 45 && from + i < view.size(); i++) {
            String node = view.get(from + i);
            boolean sel = s.selected.contains(node);
            Boolean has = s.current.get(node);
            String desc = s.plugin.perms.getOrDefault(node, "");
            String state = has == null ? "&7nema" : (has ? "&aUZ MA (true)" : "&cZAKAZANO (false)");
            Material m = sel ? Material.LIME_DYE
                    : (has == null ? Material.GRAY_DYE : (has ? Material.LIME_CONCRETE : Material.RED_CONCRETE));
            String prefix = sel ? "&a" : (has == null ? "&7" : (has ? "&2" : "&c"));
            inv.setItem(i, item(m, prefix + node,
                    List.of("&8" + (desc.isBlank() ? "bez popisu" : desc),
                            "&7Skupina &f" + (s.targetGroup == null ? "?" : s.targetGroup) + "&7: " + state,
                            "", sel ? "&aVYBRANO" : "&7neoznaceno", "&eKlik pro prepnuti")));
        }
        inv.setItem(45, item(Material.ARROW, "&e<- Predchozi", null));
        inv.setItem(46, item(Material.EMERALD_BLOCK, "&aVybrat vse", List.of("&7Oznaci vsech " + s.nodes.size() + " perms")));
        inv.setItem(47, item(Material.REDSTONE_BLOCK, "&cZrusit vyber", null));
        inv.setItem(48, item(Material.GOLDEN_HELMET, "&6Preset: Admin", List.of("&7admin, reload, config, bypass...")));
        inv.setItem(49, item(Material.IRON_SWORD, "&ePreset: Moderator", List.of("&7ban, kick, mute, warn, vanish...")));
        inv.setItem(50, item(Material.BRICKS, "&aPreset: Builder", List.of("&7build, wand, edit, schem, region...")));
        inv.setItem(51, item(Material.FEATHER, "&bPreset: Helper", List.of("&7help, tp, msg, warn...")));
        inv.setItem(52, item(Material.CHEST, "&fPokracovat -> skupina",
                List.of("&7Vybrano: &a" + s.selected.size() + " &7perms",
                        "&7Cilova skupina: &f" + (s.targetGroup == null ? "nevybrana" : s.targetGroup),
                        "", "&eLevy klik &7= vybrat skupinu a aplikovat")));
        inv.setItem(46, item(s.hideOwned ? Material.SPYGLASS : Material.EMERALD_BLOCK,
                s.hideOwned ? "&eSkryto: uz udelene" : "&aVybrat vse",
                List.of("&7Levy klik = vybrat vse (" + view.size() + ")",
                        "&7Pravy klik = " + (s.hideOwned ? "zobrazit vse" : "skryt permise, ktere skupina uz ma"))));
        inv.setItem(53, item(Material.ARROW, "&eDalsi ->", null));
        p.openInventory(inv);
    }

    public void openGroups(Player p) {
        Session s = session(p);
        s.stage = Session.Stage.GROUPS;
        PermBackend b = plugin.backends().byId(s.backendId);
        Inventory inv = create("&8Skupiny &7| " + (b == null ? "?" : b.display()), 6);
        List<String> groups = b == null ? List.of() : b.groups();
        for (int i = 0; i < 45 && i < groups.size(); i++) {
            String g = groups.get(i);
            Role r = plugin.roles().get(g);
            inv.setItem(i, item(Material.PLAYER_HEAD, r.color + g,
                    List.of("&7Role: " + r.color + r.label,
                            "&7Vybrano perms: &a" + s.selected.size(),
                            "",
                            "&aLevy klik &7= udelit (true)",
                            "&cPravy klik &7= zakazat (false)",
                            "&eShift+klik &7= odebrat (unset)")));
        }
        if (groups.isEmpty()) {
            inv.setItem(22, item(Material.BARRIER, "&cZadne skupiny nenalezeny",
                    List.of("&7Zkontroluj, zda bezi permission plugin", "&7nebo pridej skupiny v jeho configu")));
        }
        inv.setItem(49, item(Material.BARRIER, "&cZpet", null));
        p.openInventory(inv);
    }

    public void openRoles(Player p) {
        Session s = session(p);
        s.stage = Session.Stage.ROLES;
        PermBackend b = plugin.backends().byId(s.backendId);
        Inventory inv = create("&8Skupiny &7-> &fRole", 6);
        List<String> groups = b == null ? List.of() : b.groups();
        for (int i = 0; i < 45 && i < groups.size(); i++) {
            String g = groups.get(i);
            Role r = plugin.roles().get(g);
            inv.setItem(i, item(Material.NAME_TAG, r.color + g + " &8[" + r.label + "]",
                    List.of("&7Aktualni role: " + r.color + r.label,
                            "",
                            "&eKlik &7= dalsi role",
                            "&aShift+klik &7= aplikovat preset role",
                            "&8(OWNER = wildcard *)")));
        }
        inv.setItem(49, item(Material.BARRIER, "&cZpet", null));
        inv.setItem(53, item(Material.NETHER_STAR, "&cAplikovat vsechny presety",
                List.of("&7Pro kazdou skupinu udeli permise", "&7podle jeji role napric vsemi pluginy")));
        p.openInventory(inv);
    }

    // ---------------------------------------------------------------- clicks

    @EventHandler
    public void onClick(InventoryClickEvent e) {
        if (!(e.getInventory().getHolder() instanceof Holder)) return;
        e.setCancelled(true);
        if (!(e.getWhoClicked() instanceof Player p)) return;
        if (e.getClickedInventory() == null || !(e.getClickedInventory().getHolder() instanceof Holder)) return;

        Session s = session(p);
        int slot = e.getRawSlot();
        ClickType click = e.getClick();

        switch (s.stage) {
            case MAIN -> {
                if (slot == 10) openBackends(p);
                else if (slot == 12) { s.page = 0; openPlugins(p); }
                else if (slot == 14) openRoles(p);
                else if (slot == 16) grantOwnerWildcard(p);
                else if (slot == 31) { p.closeInventory(); p.sendMessage(Txt.c("&7Navod: &f/voxperms guide")); }
            }
            case BACKENDS -> {
                if (slot == 31) { openMain(p); return; }
                var all = plugin.backends().all();
                if (slot >= 0 && slot < all.size()) {
                    PermBackend b = all.get(slot);
                    if (!b.available()) { p.sendMessage(Txt.c("&cTento plugin na serveru neni.")); return; }
                    s.backendId = b.id();
                    p.sendMessage(Txt.c("&aAktivni backend: &f" + b.display()));
                    openMain(p);
                }
            }
            case PLUGINS -> {
                if (slot == 49) { openMain(p); return; }
                if (slot == 45) { if (s.page > 0) s.page--; openPlugins(p); return; }
                if (slot == 53) { s.page++; openPlugins(p); return; }
                if (slot == 47) { plugin.scanner().invalidate(); s.plugins = null; s.page = 0; openPlugins(p); return; }
                int idx = s.page * 45 + slot;
                if (slot < 45 && s.plugins != null && idx < s.plugins.size()) {
                    s.plugin = s.plugins.get(idx);
                    s.nodes = s.plugin.nodes();
                    s.resetSelection();
                    openGroupPick(p);
                }
            }
            case GROUPPICK -> {
                if (slot == 49) { openPlugins(p); return; }
                PermBackend b = plugin.backends().byId(s.backendId);
                if (b == null) return;
                List<String> groups = b.groups();
                if (slot < 45 && slot < groups.size()) loadGroupAndOpenPerms(p, b, groups.get(slot));
            }
            case PERMS -> {
                if (slot == 45) { if (s.page > 0) s.page--; openPerms(p); return; }
                if (slot == 53) { if ((s.page + 1) * 45 < visibleNodes(s).size()) s.page++; openPerms(p); return; }
                if (slot == 46) { if (click.isRightClick()) { s.hideOwned = !s.hideOwned; s.page = 0; } else s.selected.addAll(visibleNodes(s)); openPerms(p); return; }
                if (slot == 47) { s.selected.clear(); openPerms(p); return; }
                if (slot == 48) { s.selected.addAll(Presets.pick(Role.ADMIN, s.nodes)); openPerms(p); return; }
                if (slot == 49) { s.selected.addAll(Presets.pick(Role.MODERATOR, s.nodes)); openPerms(p); return; }
                if (slot == 50) { s.selected.addAll(Presets.pick(Role.BUILDER, s.nodes)); openPerms(p); return; }
                if (slot == 51) { s.selected.addAll(Presets.pick(Role.HELPER, s.nodes)); openPerms(p); return; }
                if (slot == 52) {
                    if (s.selected.isEmpty()) { p.sendMessage(Txt.c("&cNevybral jsi zadnou permission.")); return; }
                    openGroups(p);
                    return;
                }
                int idx = s.page * 45 + slot;
                List<String> view = visibleNodes(s);
                if (slot < 45 && idx < view.size()) {
                    String node = view.get(idx);
                    if (!s.selected.remove(node)) s.selected.add(node);
                    openPerms(p);
                }
            }
            case GROUPS -> {
                if (slot == 49) { openPerms(p); return; }
                PermBackend b = plugin.backends().byId(s.backendId);
                if (b == null) return;
                List<String> groups = b.groups();
                if (slot < 45 && slot < groups.size()) {
                    String g = groups.get(slot);
                    Applier a = plugin.applier();
                    int n;
                    if (click.isShiftClick()) n = a.unset(b, g, new ArrayList<>(s.selected), p);
                    else n = a.grant(b, g, new ArrayList<>(s.selected), !click.isRightClick(), p);
                    p.sendMessage(Txt.c("&a" + n + " &7permissions -> skupina &f" + g + " &7(" + b.display() + ")"));
                    p.closeInventory();
                    s.targetGroup = g;
                    Bukkit.getGlobalRegionScheduler().runDelayed(plugin, t ->
                            { if (p.isOnline()) loadGroupAndOpenPerms(p, b, g); }, 20L);
                }
            }
            case ROLES -> {
                PermBackend b = plugin.backends().byId(s.backendId);
                if (slot == 49) { openMain(p); return; }
                if (slot == 53) { applyAllRolePresets(p); return; }
                if (b == null) return;
                List<String> groups = b.groups();
                if (slot < 45 && slot < groups.size()) {
                    String g = groups.get(slot);
                    if (click.isShiftClick()) applyRolePreset(p, b, g);
                    else {
                        Role r = plugin.roles().cycle(g);
                        p.sendMessage(Txt.c("&7Skupina &f" + g + " &7-> " + r.color + r.label));
                        openRoles(p);
                    }
                }
            }
        }
    }

    @EventHandler
    public void onClose(InventoryCloseEvent e) {
        // session zustava, at se hrac muze vratit tam, kde skoncil
    }

    // ---------------------------------------------------------------- actions

    private void grantOwnerWildcard(Player p) {
        Session s = session(p);
        PermBackend b = plugin.backends().byId(s.backendId);
        if (b == null) { p.sendMessage(Txt.c("&cZadny permission plugin.")); return; }
        int done = 0;
        for (String g : b.groups()) {
            if (plugin.roles().get(g) == Role.OWNER) {
                plugin.applier().grant(b, g, List.of("*"), true, p);
                done++;
            }
        }
        p.sendMessage(done == 0
                ? Txt.c("&eZadna skupina nema roli OWNER. Nastav ji v menu Skupiny & role.")
                : Txt.c("&aWildcard &f* &audelen " + done + " OWNER skupinam."));
    }

    public void applyRolePreset(Player p, PermBackend b, String group) {
        Role r = plugin.roles().get(group);
        if (Presets.wildcard(r)) {
            plugin.applier().grant(b, group, List.of("*"), true, p);
            p.sendMessage(Txt.c("&aSkupina &f" + group + " &azískala wildcard &f*"));
            return;
        }
        List<PermScanner.ScannedPlugin> all = plugin.scanner().cached(plugin.getConfig().getBoolean("deep-scan", true));
        int total = 0;
        for (var sp : all) {
            List<String> pick = Presets.pick(r, sp.nodes());
            if (pick.isEmpty()) continue;
            total += plugin.applier().grant(b, group, pick, true, p);
        }
        p.sendMessage(Txt.c("&aSkupina &f" + group + " &7(" + r.label + ") &a-> " + total + " permissions."));
    }

    private void applyAllRolePresets(Player p) {
        Session s = session(p);
        PermBackend b = plugin.backends().byId(s.backendId);
        if (b == null) { p.sendMessage(Txt.c("&cZadny permission plugin.")); return; }
        p.closeInventory();
        for (String g : b.groups()) applyRolePreset(p, b, g);
        p.sendMessage(Txt.c("&aHotovo - presety aplikovany na vsechny skupiny."));
    }
}
