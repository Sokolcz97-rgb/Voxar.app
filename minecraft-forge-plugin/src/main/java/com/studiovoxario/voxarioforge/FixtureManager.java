package com.studiovoxario.voxarioforge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Location;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Interaction;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.util.Transformation;
import org.joml.AxisAngle4f;
import org.joml.Vector3f;

/**
 * Fixtures = 3D nabytek umisteny ve svete (ItemDisplay + Interaction hitbox).
 */
public final class FixtureManager implements Listener {

    private final VoxarioForge plugin;

    public FixtureManager(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    @EventHandler(ignoreCancelled = true)
    public void onPlace(PlayerInteractEvent event) {
        if (!plugin.getConfig().getBoolean("fixtures.enabled", true)) return;
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK) return;
        if (event.getHand() != EquipmentSlot.HAND) return;
        if (event.getClickedBlock() == null) return;

        ItemStack item = event.getItem();
        Construct construct = plugin.constructOf(item);
        if (construct == null || !construct.fixture()) return;

        event.setCancelled(true);
        Player player = event.getPlayer();

        Location loc = event.getClickedBlock().getRelative(event.getBlockFace()).getLocation().add(0.5, 0, 0.5);
        if (plugin.getConfig().getBoolean("fixtures.grid-snap", true)) {
            loc.setX(Math.round(loc.getX() * 4.0) / 4.0);
            loc.setZ(Math.round(loc.getZ() * 4.0) / 4.0);
        }
        float yaw = Math.round(player.getLocation().getYaw() / 45f) * 45f;
        loc.setYaw(yaw + 180f);
        loc.setPitch(0f);

        final ItemStack visual = plugin.registry().build(construct, 1);
        final float scale = construct.fixtureScale();
        final float width = construct.fixtureWidth();
        final float height = construct.fixtureHeight();

        loc.getWorld().spawn(loc, ItemDisplay.class, display -> {
            display.setItemStack(visual);
            display.setItemDisplayTransform(ItemDisplay.ItemDisplayTransform.FIXED);
            display.setBillboard(Display.Billboard.FIXED);
            display.setTransformation(new Transformation(
                    new Vector3f(0f, height / 2f, 0f),
                    new AxisAngle4f(0f, 0f, 1f, 0f),
                    new Vector3f(scale, scale, scale),
                    new AxisAngle4f(0f, 0f, 1f, 0f)
            ));
            display.getPersistentDataContainer().set(plugin.fixtureKey(), PersistentDataType.STRING, construct.id());
        });

        loc.getWorld().spawn(loc, Interaction.class, hitbox -> {
            hitbox.setInteractionWidth(width);
            hitbox.setInteractionHeight(height);
            hitbox.setResponsive(true);
            hitbox.getPersistentDataContainer().set(plugin.fixtureKey(), PersistentDataType.STRING, construct.id());
        });

        if (player.getGameMode() != org.bukkit.GameMode.CREATIVE && item != null) {
            item.setAmount(item.getAmount() - 1);
        }
        player.sendActionBar(Component.text("Fixture umistena: " + construct.id(), NamedTextColor.AQUA));
    }

    @EventHandler(ignoreCancelled = true)
    public void onBreak(PlayerInteractEntityEvent event) {
        Entity entity = event.getRightClicked();
        String id = entity.getPersistentDataContainer().get(plugin.fixtureKey(), PersistentDataType.STRING);
        if (id == null) return;

        Player player = event.getPlayer();
        if (!player.isSneaking()) return;
        event.setCancelled(true);

        Construct construct = plugin.registry().get(id);
        Location center = entity.getLocation();

        for (Entity nearby : center.getWorld().getNearbyEntities(center, 0.6, 1.6, 0.6)) {
            String tag = nearby.getPersistentDataContainer().get(plugin.fixtureKey(), PersistentDataType.STRING);
            if (tag != null && tag.equals(id) && (nearby instanceof ItemDisplay || nearby instanceof Interaction)) {
                Scheduling.entity(plugin, nearby, Entity::remove);
            }
        }

        if (construct != null && player.getGameMode() != org.bukkit.GameMode.CREATIVE) {
            player.getInventory().addItem(plugin.registry().build(construct, 1));
        }
        player.sendActionBar(Component.text("Fixture odstranena.", NamedTextColor.RED));
    }
}
