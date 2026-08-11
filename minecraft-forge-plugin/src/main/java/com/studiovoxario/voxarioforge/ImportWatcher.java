package com.studiovoxario.voxarioforge;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Hlida slozky sources/ a imports/.
 *  - novy ZIP v imports/  -> rozbali do spravneho zdroje (podle nazvu souboru)
 *  - zmena v sources/     -> automaticky prestavi resource pack (a posle do MySQL)
 */
public final class ImportWatcher {

    private final VoxarioForge plugin;
    private final Map<String, Long> stamps = new HashMap<>();
    private boolean primed;

    public ImportWatcher(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public void tick() {
        try {
            boolean imported = scanImports();
            boolean changed = scanChanges();
            if (!primed) {
                primed = true;
                return;
            }
            if (imported || changed) {
                plugin.getLogger().info("Zmena obsahu detekovana -> reload + stavba packu.");
                Scheduling.global(plugin, plugin::reloadContent);
                Scheduling.globalLater(plugin, () -> plugin.rebuildPack(null), 20L);
            }
        } catch (Exception e) {
            plugin.getLogger().warning("Watcher selhal: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------ ZIP import

    private boolean scanImports() {
        File dir = plugin.sources().imports();
        dir.mkdirs();
        File[] zips = dir.listFiles(f -> f.isFile() && f.getName().toLowerCase(Locale.ROOT).endsWith(".zip"));
        if (zips == null || zips.length == 0) return false;

        File done = new File(dir, "done");
        done.mkdirs();
        boolean any = false;
        for (File zip : zips) {
            try {
                String target = detectTarget(zip.getName());
                int files = extract(zip, target);
                plugin.getLogger().info("Import " + zip.getName() + " -> sources/" + target
                        + " (" + files + " souboru).");
                Files.move(zip.toPath(), new File(done, zip.getName()).toPath(),
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                any = true;
            } catch (Exception e) {
                plugin.getLogger().warning("Import " + zip.getName() + " selhal: " + e.getMessage());
            }
        }
        return any;
    }

    private String detectTarget(String fileName) {
        String n = fileName.toLowerCase(Locale.ROOT);
        for (String id : plugin.sources().sources().keySet()) {
            if (n.startsWith(id) || n.contains("-" + id) || n.contains("_" + id)) return id;
        }
        return "voxario";
    }

    private int extract(File zipFile, String sourceId) throws Exception {
        File base = new File(plugin.sources().root(), sourceId);
        int count = 0;
        try (ZipFile zf = new ZipFile(zipFile)) {
            var entries = zf.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (entry.isDirectory()) continue;
                String name = entry.getName().replace('\\', '/');
                String low = name.toLowerCase(Locale.ROOT);
                String simple = name.substring(name.lastIndexOf('/') + 1);

                String sub;
                if (low.endsWith(".png")) sub = "textures";
                else if (low.endsWith(".bbmodel") || low.endsWith(".iaentitymodel")) sub = "models";
                else if (low.endsWith(".json")) sub = low.contains("/models/") ? "models" : null;
                else if (low.endsWith(".yml") || low.endsWith(".yaml")) sub = "items";
                else sub = null;
                if (sub == null) continue;

                File out = new File(new File(base, sub), simple);
                out.getParentFile().mkdirs();
                try (InputStream in = zf.getInputStream(entry);
                     FileOutputStream fos = new FileOutputStream(out)) {
                    in.transferTo(fos);
                }
                count++;
            }
        }
        return count;
    }

    // ------------------------------------------------------- detekce zmen

    private boolean scanChanges() {
        Map<String, Long> current = new HashMap<>();
        collect(plugin.sources().root(), current);
        boolean changed = !current.equals(stamps);
        stamps.clear();
        stamps.putAll(current);
        return changed;
    }

    private void collect(File dir, Map<String, Long> out) {
        if (!dir.isDirectory()) return;
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) collect(f, out);
            else out.put(f.getPath(), f.lastModified() ^ f.length());
        }
    }
}
