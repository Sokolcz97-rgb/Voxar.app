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
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;

/**
 * VoxarioForge - vlastni obsahovy engine pro Paper/Folia 1.21.11+ (JDK 21+).
 *
 * Slozky: plugins/VoxarioForge/sources/&lt;voxario|itemsadder|oraxen|nexo&gt;/
 *         {items, models, textures, gui}, imports/, output/
 */
public final class VoxarioForge extends JavaPlugin implements Listener {

    private static final List<String> DEFAULT_BLUEPRINTS =
            List.of("ruby_blade", "arcane_lantern", "rune_hammer", "mana_flask");

    private SourceManager sources;
    private ContentRegistry registry;
    private ForgeGUI gui;
    private StationManager stations;
    private StationGUI stationGui;
    private PackBuilder packBuilder;
    private MySqlSync mysql;
    private PackServer packServer;
    private ImportWatcher watcher;
    private NamespacedKey constructKey;
    private NamespacedKey fixtureKey;
    private String namespace;
    private volatile String packSha1 = "";

    @Override
    public void onEnable() {
        saveDefaultConfig();
        getConfig().options().copyDefaults(true);
        saveConfig();
        this.namespace = getConfig().getString("namespace", "voxforge").toLowerCase(Locale.ROOT);
        this.constructKey = new NamespacedKey(this, "construct");
        this.fixtureKey = new NamespacedKey(this, "fixture");

        this.sources = new SourceManager(this);
        setupDefaults();

        this.mysql = new MySqlSync(this);
        this.mysql.init();

        this.registry = new ContentRegistry(this);
        this.stations = new StationManager(this);

        if (mysql.enabled()) {
            try {
                int pulled = mysql.pull();
                if (pulled > 0) getLogger().info("MySQL: stazeno " + pulled + " souboru obsahu.");
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
        this.watcher = new ImportWatcher(this);

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

        if (getConfig().getBoolean("content.auto-build", true)) {
            long sec = Math.max(3, getConfig().getLong("content.watch-seconds", 5));
            Scheduling.asyncTimer(this, watcher::tick, sec, sec);
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

    /** Vytvori slozkovou strukturu a rozbali vestaveny obsah do sources/voxario. */
    private void setupDefaults() {
        File dataFolder = getDataFolder();
        dataFolder.mkdirs();
        sources.setup();

        File marker = new File(dataFolder, ".assets-version");
        String current = getPluginMeta().getVersion();
        String installed = "";
        try {
            if (marker.isFile()) installed = Files.readString(marker.toPath()).trim();
        } catch (Exception ignored) {
        }
        boolean upgrade = !current.equals(installed);

        File items = new File(dataFolder, "sources/voxario/items/items.yml");
        boolean fresh = !items.isFile();

        if (fresh || upgrade) {
            backup(items, upgrade && !fresh);
            saveResource("sources/voxario/items/items.yml", true);
            for (String bp : DEFAULT_BLUEPRINTS) {
                try {
                    saveResource("sources/voxario/models/" + bp + ".bbmodel", true);
                } catch (Exception ignored) {
                }
            }

            backup(new File(dataFolder, "stations.yml"), upgrade && !fresh);
            saveResource("stations.yml", true);

            // migrace ze stare struktury packs/default -> sources/voxario
            migrateLegacy();

            try {
                Files.writeString(marker.toPath(), current);
            } catch (Exception ignored) {
            }
        }
        sources.reload();
    }

    private void migrateLegacy() {
        File legacy = new File(getDataFolder(), "packs");
        if (!legacy.isDirectory()) return;
        File models = new File(getDataFolder(), "sources/voxario/models");
        File itemsDir = new File(getDataFolder(), "sources/voxario/items");
        models.mkdirs();
        itemsDir.mkdirs();
        moveAll(legacy, models, itemsDir);
        getLogger().info("Stara slozka packs/ byla prevedena do sources/voxario/.");
    }

    private void moveAll(File dir, File models, File itemsDir) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) {
                moveAll(f, models, itemsDir);
                continue;
            }
            String n = f.getName().toLowerCase(Locale.ROOT);
            File target = null;
            if (n.endsWith(".bbmodel") || n.endsWith(".iaentitymodel")) target = new File(models, f.getName());
            else if (n.endsWith(".yml") && !n.equals("items.yml")) target = new File(itemsDir, f.getName());
            if (target == null || target.exists()) continue;
            try {
                Files.copy(f.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
            } catch (Exception ignored) {
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

    public String namespace() {
        return namespace;
    }

    public ImportWatcher importWatcher() {
        return watcher;
    }

    public SourceManager sources() {
        return sources;
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

    /** Znovu rozbali vestavena data a obnovi strukturu slozek. */
    public void restoreDefaults() {
        File marker = new File(getDataFolder(), ".assets-version");
        marker.delete();
        setupDefaults();
        reloadContent();
    }

    public void reloadContent() {
        sources.reload();
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
                        + result.textures() + " textur -> output/" + result.file().getName()
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
        if (url == null || url.isBlank()) {
            getLogger().warning("Resource pack nelze odeslat: chybi pack.url nebo pack.http.public-host v config.yml.");
            return;
        }
        String sha1 = packSha1 != null && !packSha1.isBlank()
                ? packSha1 : getConfig().getString("pack.sha1", "");
        if (sha1 != null && !sha1.isBlank()) {
            url = url + (url.contains("?") ? "&" : "?") + "v=" + sha1.substring(0, 12);
        }
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
