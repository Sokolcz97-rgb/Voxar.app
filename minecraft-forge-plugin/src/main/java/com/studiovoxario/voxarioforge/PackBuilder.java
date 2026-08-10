package com.studiovoxario.voxarioforge;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Sestavi resource pack ZIP ze vsech blueprintu a constructu.
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
        File out = new File(plugin.getDataFolder(), fileName);
        File parent = out.getParentFile();
        if (parent != null) parent.mkdirs();

        int models = 0;
        int textures = 0;

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(buffer, StandardCharsets.UTF_8)) {
            // pack.mcmeta
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
            write(zip, "pack.mcmeta", GSON.toJson(meta).getBytes(StandardCharsets.UTF_8));

            for (Construct c : plugin.registry().constructs().values()) {
                String bp = c.blueprint();
                if (bp == null || bp.isBlank()) continue;
                File bbmodel = plugin.registry().blueprints().get(bp.toLowerCase());
                if (bbmodel == null) {
                    plugin.getLogger().warning("Blueprint '" + bp + "' pro construct '" + c.id() + "' nenalezen.");
                    continue;
                }

                BlueprintCompiler.Compiled compiled = BlueprintCompiler.compile(ns, c.id(), bbmodel);

                write(zip, "assets/" + ns + "/models/item/" + c.id() + ".json",
                        GSON.toJson(compiled.model()).getBytes(StandardCharsets.UTF_8));
                models++;

                // item model definition (1.21.4+ item_model komponenta)
                JsonObject def = new JsonObject();
                JsonObject modelRef = new JsonObject();
                modelRef.addProperty("type", "minecraft:model");
                modelRef.addProperty("model", ns + ":item/" + c.id());
                def.add("model", modelRef);
                write(zip, "assets/" + ns + "/items/" + c.id() + ".json",
                        GSON.toJson(def).getBytes(StandardCharsets.UTF_8));

                for (Map.Entry<String, byte[]> tex : compiled.textures().entrySet()) {
                    write(zip, "assets/" + ns + "/textures/item/" + tex.getKey() + ".png", tex.getValue());
                    textures++;
                }
            }
        }

        byte[] bytes = buffer.toByteArray();
        try (FileOutputStream fos = new FileOutputStream(out)) {
            fos.write(bytes);
        }

        MessageDigest md = MessageDigest.getInstance("SHA-1");
        String sha1 = HexFormat.of().formatHex(md.digest(bytes));

        return new Result(models, textures, out, sha1);
    }

    private void write(ZipOutputStream zip, String path, byte[] data) throws Exception {
        zip.putNextEntry(new ZipEntry(path));
        zip.write(data);
        zip.closeEntry();
    }
}
