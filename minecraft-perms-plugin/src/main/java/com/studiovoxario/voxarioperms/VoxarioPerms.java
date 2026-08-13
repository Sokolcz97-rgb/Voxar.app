package com.studiovoxario.voxarioperms;

import com.studiovoxario.voxarioperms.backend.BackendRegistry;
import com.studiovoxario.voxarioperms.backend.PermBackend;
import com.studiovoxario.voxarioperms.gui.GuiManager;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

public final class VoxarioPerms extends JavaPlugin {

    private BackendRegistry backends;
    private PermScanner scanner;
    private RoleConfig roles;
    private Applier applier;
    private GuiManager gui;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        Guide.write(getDataFolder());

        this.backends = new BackendRegistry();
        this.scanner = new PermScanner(this);
        this.roles = new RoleConfig(getDataFolder());
        this.applier = new Applier(this);
        this.gui = new GuiManager(this);

        Bukkit.getPluginManager().registerEvents(gui, this);

        PermsCommand cmd = new PermsCommand(this);
        var c = getCommand("voxperms");
        if (c != null) { c.setExecutor(cmd); c.setTabCompleter(cmd); }

        PermBackend best = backends.best();
        getLogger().info("VoxarioPerms zapnut. Backend: " + (best == null ? "zadny (nainstaluj LuckPerms nebo Vault)" : best.display()));
        getLogger().info("Napis /voxperms pro GUI, /voxperms guide pro navod.");
    }

    public BackendRegistry backends() { return backends; }
    public PermScanner scanner() { return scanner; }
    public RoleConfig roles() { return roles; }
    public Applier applier() { return applier; }
    public GuiManager gui() { return gui; }
}
