package com.studiovoxario.voxarioforge;

import io.papermc.paper.registry.RegistryAccess;
import io.papermc.paper.registry.RegistryKey;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.NamespacedKey;
import org.bukkit.command.CommandSender;
import org.bukkit.command.PluginCommand;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.util.Locale;

/**
 * VoxarioForge - vlastni obsahovy engine pro Folia 1.21.11+ / JDK 25+.
 *
 * Terminologie:
 *  - Construct  = vlastni item (nastroj, zbran, dekorace)
 *  - Blueprint  = .bbmodel model z Blockbenche
 *  - Fixture    = 3D nabytek umisteny ve svete
 *  - Forge Pack = vygenerovany resource pack
 */
public final class VoxarioForge extends JavaPlugin implements Listener {

    private ContentRegistry registry;
    private ForgeGUI gui;
    private PackBuilder packBuilder;
    private NamespacedKey constructKey;
    private NamespacedKey fixtureKey;
    private String namespace;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.namespace = getConfig().getString("namespace", "voxforge").toLowerCase(Locale.ROOT);
        this.constructKey = new NamespacedKey(this, "construct");
        this.fixtureKey = new NamespacedKey(this, "fixture");

        setupDefaults();

        this.registry = new ContentRegistry(this);
        this.registry.reload();

        this.packBuilder = new PackBuilder(this);
        this.gui = new ForgeGUI(this);

        getServer().getPluginManager().registerEvents(gui, this);
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

        getLogger().info("VoxarioForge aktivni (" + (Scheduling.isFolia() ? "Folia" : "Paper") + ").");
    }

    private void setupDefaults() {
        File packs = new File(getDataFolder(), "packs/default");
        if (!packs.exists()) {
            packs.mkdirs();
            new File(packs, "blueprints").mkdirs();
            saveResource("packs/default/items.yml", false);
        }
    }

    public String namespace() {
        return namespace;
    }

    public ContentRegistry registry() {
        return registry;
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

    /** Sestavi resource pack (async, IO). */
    public void rebuildPack(CommandSender feedback) {
        Scheduling.async(this, () -> {
            try {
                PackBuilder.Result result = packBuilder.build();
                String msg = "Forge Pack hotov: " + result.models() + " modelu, "
                        + result.textures() + " textur -> " + result.file().getName()
                        + " (sha1 " + result.sha1().substring(0, 12) + "...)";
                getLogger().info(msg);
                if (feedback != null) {
                    feedback.sendMessage(Component.text(msg, NamedTextColor.AQUA));
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

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        String url = getConfig().getString("pack.url", "");
        if (url == null || url.isBlank()) return;
        String sha1 = getConfig().getString("pack.sha1", "");
        boolean required = getConfig().getBoolean("pack.required", false);
        try {
            event.getPlayer().setResourcePack(url, sha1 == null ? "" : sha1, required,
                    Component.text("VoxarioForge content pack", NamedTextColor.AQUA));
        } catch (Exception e) {
            getLogger().warning("Nelze odeslat resource pack: " + e.getMessage());
        }
    }
}
