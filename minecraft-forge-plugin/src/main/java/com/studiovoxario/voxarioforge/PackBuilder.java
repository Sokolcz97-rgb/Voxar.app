package com.studiovoxario.voxarioforge;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Sestavi resource pack ZIP ze vsech zdroju (voxario / itemsadder / oraxen / nexo).
 * Modely i textury jsou v packu oddelene do podslozek podle zdroje.
 */
public final class PackBuilder {

    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();

    private final VoxarioForge plugin;

    public PackBuilder(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public record Result(int models, int textures, File file, String sha1) {
    }

    public Result build() throws Exception {
        String ns = plugin.namespace();
        String fileName = plugin.getConfig().getString("pack.file-name", "VoxarioForge-Pack.zip");
        File outDir = plugin.sources().output();
        outDir.mkdirs();
        File out = new File(outDir, fileName);

        int models = 0;
        int textures = 0;
        Set<String> written = new HashSet<>();

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(buffer, StandardCharsets.UTF_8)) {
            JsonObject meta = new JsonObject();
            JsonObject pack = new JsonObject();
            pack.addProperty("pack_format", 46);
            pack.addProperty("description", plugin.getConfig()
                    .getString("pack.description", "VoxarioForge content pack"));
            JsonObject supported = new JsonObject();
            supported.addProperty("min_inclusive", 34);
            supported.addProperty("max_inclusive", 99);
            pack.add("supported_formats", supported);
            meta.add("pack", pack);
            write(zip, "pack.mcmeta", GSON.toJson(meta).getBytes(StandardCharsets.UTF_8), written);

            // volne textury z kazdeho zdroje -> textures/<pack.texture-folder>/<relativni cesta>.png
            for (SourceManager.Source source : plugin.sources().enabled()) {
                String folder = folderOf(source);
                for (Map.Entry<String, File> e : plugin.registry().textures().entrySet()) {
                    if (!e.getKey().startsWith(source.id() + ":")) continue;
                    String name = e.getKey().substring(source.id().length() + 1);
                    String path = "assets/" + ns + "/textures/" + folder + "/" + name + ".png";
                    if (write(zip, path, Files.readAllBytes(e.getValue().toPath()), written)) textures++;
                }
            }

            for (Construct c : plugin.registry().constructs().values()) {
                String bp = c.blueprint();
                if (bp == null || bp.isBlank()) continue;
                File model = plugin.registry().blueprintOf(c);
                if (model == null) {
                    plugin.getLogger().warning("Model '" + bp + "' pro '" + c.pack() + ":" + c.id()
                            + "' nenalezen v sources/" + c.pack() + "/models/.");
                    continue;
                }

                String path = ContentRegistry.modelPath(c);
                JsonObject modelJson;
                Map<String, byte[]> inline;

                if (model.getName().toLowerCase(Locale.ROOT).endsWith(".json")) {
                    modelJson = GSON.fromJson(Files.readString(model.toPath(), StandardCharsets.UTF_8),
                            JsonObject.class);
                    inline = Map.of();
                } else {
                    BlueprintCompiler.Compiled compiled = BlueprintCompiler.compile(ns, path, model);
                    modelJson = compiled.model();
                    inline = compiled.textures();
                }

                // --- rucne nastavene textury z configu (vice PNG na jeden model) ---
                SourceManager.Source src = plugin.sources().get(c.pack());
                String folder = src != null ? folderOf(src) : "item/" + c.pack();
                Set<String> overridden = new HashSet<>();
                if (!c.textures().isEmpty()) {
                    JsonObject texMap = modelJson.has("textures")
                            ? modelJson.getAsJsonObject("textures") : new JsonObject();
                    for (Map.Entry<String, String> e : c.textures().entrySet()) {
                        ContentRegistry.Tex tex = plugin.registry().findTexture(c, e.getValue());
                        if (tex == null) {
                            plugin.getLogger().warning("Textura '" + e.getValue() + "' pro '"
                                    + c.pack() + ":" + c.id() + "' nenalezena.");
                            continue;
                        }
                        texMap.addProperty(e.getKey(), ns + ":" + folder + "/" + tex.relPath());
                        overridden.add(e.getKey());
                        String zipPath = "assets/" + ns + "/textures/" + folder + "/"
                                + tex.relPath() + ".png";
                        if (write(zip, zipPath, Files.readAllBytes(tex.file().toPath()), written)) textures++;
                    }
                    modelJson.add("textures", texMap);
                }

                write(zip, "assets/" + ns + "/models/item/" + path + ".json",
                        GSON.toJson(modelJson).getBytes(StandardCharsets.UTF_8), written);
                models++;

                JsonObject def = new JsonObject();
                JsonObject modelRef = new JsonObject();
                modelRef.addProperty("type", "minecraft:model");
                modelRef.addProperty("model", ns + ":item/" + path);
                def.add("model", modelRef);
                write(zip, "assets/" + ns + "/items/" + path + ".json",
                        GSON.toJson(def).getBytes(StandardCharsets.UTF_8), written);

                for (Map.Entry<String, byte[]> tex : inline.entrySet()) {
                    // slot prepsany configem -> vlozenou texturu nepotrebujeme
                    String slot = tex.getKey().substring(tex.getKey().lastIndexOf('_') + 1);
                    if (overridden.contains(slot)) continue;
                    if (write(zip, "assets/" + ns + "/textures/item/" + tex.getKey() + ".png",
                            tex.getValue(), written)) textures++;
                }

                // model bez vlozene textury (.iaentitymodel) -> hledej PNG ve zdroji
                if (inline.isEmpty() && c.textures().isEmpty()) {
                    File png = plugin.registry().textureOf(c, bp);
                    if (png == null) png = plugin.registry().textureOf(c, c.id());
                    if (png != null) {
                        if (write(zip, "assets/" + ns + "/textures/item/" + path + "_0.png",
                                Files.readAllBytes(png.toPath()), written)) textures++;
                    }
                }
            }
        }

        }

        byte[] bytes = buffer.toByteArray();
        try (FileOutputStream fos = new FileOutputStream(out)) {
            fos.write(bytes);
        }
        // kopie i v korenove slozce kvuli zpetne kompatibilite / pack serveru
        try (FileOutputStream fos = new FileOutputStream(new File(plugin.getDataFolder(), fileName))) {
            fos.write(bytes);
        }

        MessageDigest md = MessageDigest.getInstance("SHA-1");
        String sha1 = HexFormat.of().formatHex(md.digest(bytes));

        return new Result(models, textures, out, sha1);
    }

    /** Slozka v resource packu, kam padaji textury daneho zdroje. */
    private String folderOf(SourceManager.Source source) {
        String f = source.packTextureFolder();
        if (f == null || f.isBlank()) f = "item/" + source.id();
        f = f.replace('\\', '/').toLowerCase(Locale.ROOT);
        while (f.startsWith("/")) f = f.substring(1);
        while (f.endsWith("/")) f = f.substring(0, f.length() - 1);
        return f;
    }

    private boolean write(ZipOutputStream zip, String path, byte[] data, Set<String> written) throws Exception {
        if (!written.add(path)) return false;
        zip.putNextEntry(new ZipEntry(path));
        zip.write(data);
        zip.closeEntry();
        return true;
    }
}
