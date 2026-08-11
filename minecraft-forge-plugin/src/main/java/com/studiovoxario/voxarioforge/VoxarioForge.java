package com.studiovoxario.voxarioforge;

import io.papermc.paper.registry.RegistryAccess;
import io.papermc.paper.registry.RegistryKey;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.NamespacedKey;
import org.bukkit.command.CommandSender;
import org.bukkit.command.PluginCommand;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.util.Locale;

/**
 * VoxarioForge - vlastni obsahovy engine pro Paper/Folia 1.21.11+ (JDK 21+).
 *
 * Terminologie:
 *  - Construct  = vlastni item (nastroj, zbran, dekorace)
 *  - Blueprint  = .bbmodel / .iaentitymodel model
 *  - Fixture    = 3D nabytek umisteny ve svete
 *  - Station    = RPG pracoviste (kovadlina, verpanek, alchymie)
 *  - Forge Pack = vygenerovany resource pack
 */
public final class VoxarioForge extends JavaPlugin implements Listener {

    private ContentRegistry registry;
    private ForgeGUI gui;
    private StationManager stations;
    private StationGUI stationGui;
    private PackBuilder packBuilder;
    private MySqlSync mysql;
    private PackServer packServer;
    private NamespacedKey constructKey;
    private NamespacedKey fixtureKey;
    private String namespace;
    private volatile String packSha1 = "";

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.namespace = getConfig().getString("namespace", "voxforge").toLowerCase(Locale.ROOT);
        this.constructKey = new NamespacedKey(this, "construct");
        this.fixtureKey = new NamespacedKey(this, "fixture");

        setupDefaults();

        this.mysql = new MySqlSync(this);
        this.mysql.init();

        this.registry = new ContentRegistry(this);
        this.stations = new StationManager(this);

        if (mysql.enabled()) {
            try {
                int pulled = mysql.pull();
                if (pulled > 0) getLogger().info("MySQL: staženo " + pulled + " souboru obsahu.");
            } catch (Exception e) {
                getLogger().warning("MySQL pull selhal: " + e.getMessage());
            }
        }

        this.registry.reload();
        this.stations.reload();

        this.packBuilder = new PackBuilder(this);
        this.gui = new ForgeGUI(this);
        this.stationGui = new StationGUI(this);
        this.packServer = new PackServer(this);
        this.packServer.start();

        getServer().getPluginManager().registerEvents(gui, this);
        getServer().getPluginManager().registerEvents(stationGui, this);
        getServer().getPluginManager().registerEvents(new FixtureManager(this), this);
        getServer().getPluginManager().registerEvents(this, this);

        PluginCommand command = getCommand("voxforge");
        if (command != null) {
            ForgeCommand executor = new ForgeCommand(this);
            command.setExecutor(executor);
            command.setTabCompleter(executor);
        }

        if (getConfig().getBoolean("pack.build-on-start", true)) {
            Scheduling.async(this, () -> rebuildPack(null));
        }

        if (mysql.enabled() && getConfig().getBoolean("mysql.auto-sync", true)) {
            long seconds = Math.max(10, getConfig().getLong("mysql.interval-seconds", 60));
            Scheduling.asyncTimer(this, this::syncTick, seconds, seconds);
        }

        getLogger().info("VoxarioForge aktivni (" + (Scheduling.isFolia() ? "Folia" : "Paper")
                + ", Java " + Runtime.version().feature() + ").");
    }

    @Override
    public void onDisable() {
        if (packServer != null) packServer.stop();
    }

    /**
     * Rozbali vestavena data. Pri zmene verze pluginu se defaultni pack i stanice
     * prepisou (stara verze se zazalohuje jako *.bak), aby se nove modely a GUI
     * skutecne projevily i na existujici instalaci.
     */
    private void setupDefaults() {
        File dataFolder = getDataFolder();
        dataFolder.mkdirs();

        File marker = new File(dataFolder, ".assets-version");
        String current = getPluginMeta().getVersion();
        String installed = "";
        try {
            if (marker.isFile()) installed = Files.readString(marker.toPath()).trim();
        } catch (Exception ignored) {
        }
        boolean upgrade = !current.equals(installed);

        File packs = new File(dataFolder, "packs/default");
        boolean fresh = !packs.exists();
        packs.mkdirs();
        new File(packs, "blueprints").mkdirs();

        if (fresh || upgrade) {
            backup(new File(packs, "items.yml"), upgrade && !fresh);
            saveResource("packs/default/items.yml", true);
            for (String bp : DEFAULT_BLUEPRINTS) saveDefaultBlueprint(bp);

            backup(new File(dataFolder, "stations.yml"), upgrade && !fresh);
            saveResource("stations.yml", true);

            try {
                Files.writeString(marker.toPath(), current);
            } catch (Exception ignored) {
            }
            if (upgrade && !fresh) {
                getLogger().info("Aktualizovan vestaveny obsah na verzi " + current
                        + " (puvodni soubory ulozeny jako *.bak).");
            }
        }
    }

    private void backup(File file, boolean doBackup) {
        if (!doBackup || !file.isFile()) return;
        try {
            Files.copy(file.toPath(), new File(file.getParentFile(), file.getName() + ".bak").toPath(),
                    StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception ignored) {
        }
    }

    private void saveDefaultBlueprint(String name) {
        try {
            saveResource("packs/default/blueprints/" + name + ".bbmodel", true);
        } catch (Exception ignored) {
            // blueprint neni v jaru
        }
    }


    public String namespace() {
        return namespace;
    }

    public ContentRegistry registry() {
        return registry;
    }

    public StationManager stations() {
        return stations;
    }

    public StationGUI stationGui() {
        return stationGui;
    }

    public MySqlSync mysql() {
        return mysql;
    }

    public PackServer packServer() {
        return packServer;
    }

    public ForgeGUI gui() {
        return gui;
    }

    public NamespacedKey constructKey() {
        return constructKey;
    }

    public NamespacedKey fixtureKey() {
        return fixtureKey;
    }

    public void reloadContent() {
        registry.reload();
        stations.reload();
    }

    /** Zjisti, jestli je item Construct. */
    public Construct constructOf(ItemStack stack) {
        if (stack == null || !stack.hasItemMeta()) return null;
        String id = stack.getItemMeta().getPersistentDataContainer()
                .get(constructKey, PersistentDataType.STRING);
        return id == null ? null : registry.get(id);
    }

    public Enchantment lookupEnchantment(String name) {
        try {
            NamespacedKey key = NamespacedKey.minecraft(name.toLowerCase(Locale.ROOT));
            return RegistryAccess.registryAccess().getRegistry(RegistryKey.ENCHANTMENT).get(key);
        } catch (Exception e) {
            return null;
        }
    }

    /** Periodicka kontrola zmen v MySQL. */
    private void syncTick() {
        if (!mysql.enabled()) return;
        if (!mysql.hasRemoteChanges()) return;
        try {
            int changed = mysql.pull();
            if (changed == 0) return;
            getLogger().info("MySQL: prijato " + changed + " zmen, prestavuji pack.");
            Scheduling.global(this, this::reloadContent);
            Scheduling.globalLater(this, () -> rebuildPack(null), 20L);
        } catch (Exception e) {
            getLogger().warning("MySQL sync selhal: " + e.getMessage());
        }
    }

    /** Sestavi resource pack (async, IO) a rozesle ho hracum. */
    public void rebuildPack(CommandSender feedback) {
        Scheduling.async(this, () -> {
            try {
                PackBuilder.Result result = packBuilder.build();
                packSha1 = result.sha1();

                if (mysql.enabled() && getConfig().getBoolean("mysql.publish-pack", true)) {
                    try {
                        mysql.push();
                        mysql.publishPack(result.file(), result.sha1(), packServer.publicUrl());
                    } catch (Exception e) {
                        getLogger().warning("MySQL publikace packu selhala: " + e.getMessage());
                    }
                }

                String msg = "Forge Pack hotov: " + result.models() + " modelu, "
                        + result.textures() + " textur -> " + result.file().getName()
                        + " (sha1 " + result.sha1().substring(0, 12) + "...)";
                getLogger().info(msg);
                if (feedback != null) {
                    feedback.sendMessage(Component.text(msg, NamedTextColor.AQUA));
                }

                if (getConfig().getBoolean("pack.auto-resend", true)) {
                    Scheduling.global(this, () -> Bukkit.getOnlinePlayers().forEach(this::sendPack));
                }
            } catch (Exception e) {
                getLogger().warning("Stavba packu selhala: " + e.getMessage());
                if (feedback != null) {
                    feedback.sendMessage(Component.text("Stavba packu selhala: " + e.getMessage(),
                            NamedTextColor.RED));
                }
            }
        });
    }

    /** Posle hraci aktualni resource pack. */
    public void sendPack(Player player) {
        String url = packServer.publicUrl();
        if (url == null || url.isBlank()) return;
        String sha1 = packSha1 != null && !packSha1.isBlank()
                ? packSha1 : getConfig().getString("pack.sha1", "");
        boolean required = getConfig().getBoolean("pack.required", false);
        try {
            player.setResourcePack(url, sha1 == null ? "" : sha1, required,
                    Component.text("VoxarioForge content pack", NamedTextColor.AQUA));
        } catch (Exception e) {
            getLogger().warning("Nelze odeslat resource pack: " + e.getMessage());
        }
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        sendPack(event.getPlayer());
    }
}
