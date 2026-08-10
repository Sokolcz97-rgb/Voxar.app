package com.studiovoxario.voxarioforge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Prevadi Blockbench (.bbmodel) na vanilla model JSON + PNG textury.
 */
public final class BlueprintCompiler {

    /** Vysledek kompilace jednoho blueprintu. */
    public record Compiled(String id, JsonObject model, Map<String, byte[]> textures) {
    }

    private BlueprintCompiler() {
    }

    public static Compiled compile(String namespace, String id, File bbmodel) throws Exception {
        String raw = Files.readString(bbmodel.toPath(), StandardCharsets.UTF_8);
        JsonObject src = JsonParser.parseString(raw).getAsJsonObject();

        // .iaentitymodel / bedrock geometry -> prevod na bbmodel-like strukturu
        if (isBedrock(src)) {
            src = fromBedrock(src);
        } else if (src.has("model") && src.get("model").isJsonObject() && !src.has("elements")) {
            JsonObject inner = src.getAsJsonObject("model");
            if (isBedrock(inner) || inner.has("elements")) src = isBedrock(inner) ? fromBedrock(inner) : inner;
        }

        double resW = 16, resH = 16;
        if (src.has("resolution")) {
            JsonObject res = src.getAsJsonObject("resolution");
            resW = res.has("width") ? res.get("width").getAsDouble() : 16;
            resH = res.has("height") ? res.get("height").getAsDouble() : 16;
        }
        if (resW <= 0) resW = 16;
        if (resH <= 0) resH = 16;


        // --- textury ---
        Map<String, byte[]> pngs = new LinkedHashMap<>();
        JsonObject texMap = new JsonObject();
        List<String> texKeys = new ArrayList<>();

        if (src.has("textures") && src.get("textures").isJsonArray()) {
            JsonArray textures = src.getAsJsonArray("textures");
            for (int i = 0; i < textures.size(); i++) {
                if (!textures.get(i).isJsonObject()) continue;
                JsonObject t = textures.get(i).getAsJsonObject();
                String source = t.has("source") ? t.get("source").getAsString() : null;
                String fileName = id + "_" + i;
                if (source != null && source.contains("base64,")) {
                    String b64 = source.substring(source.indexOf("base64,") + 7);
                    pngs.put(fileName, Base64.getDecoder().decode(b64));
                }
                texMap.addProperty(String.valueOf(i), namespace + ":item/" + fileName);
                texKeys.add(String.valueOf(i));
            }
        }
        if (texKeys.isEmpty()) {
            // .iaentitymodel / geometry bez vlozene textury -> ocekava <id>_0.png v blueprints/
            texMap.addProperty("0", namespace + ":item/" + id + "_0");
            texKeys.add("0");
        }
        texMap.addProperty("particle", namespace + ":item/" + id + "_0");


        // --- elementy ---
        JsonArray outElements = new JsonArray();
        if (src.has("elements")) {
            JsonArray elements = src.getAsJsonArray("elements");
            for (JsonElement el : elements) {
                if (!el.isJsonObject()) continue;
                JsonObject e = el.getAsJsonObject();
                if (e.has("type") && !"cube".equals(e.get("type").getAsString())) continue;
                if (!e.has("from") || !e.has("to")) continue;

                JsonObject out = new JsonObject();
                out.add("from", copyVec(e.getAsJsonArray("from"), e));
                out.add("to", copyVec(e.getAsJsonArray("to"), e));

                if (e.has("rotation") && e.get("rotation").isJsonArray() && e.has("origin")) {
                    JsonArray rot = e.getAsJsonArray("rotation");
                    String axis = null;
                    double angle = 0;
                    for (int a = 0; a < Math.min(3, rot.size()); a++) {
                        double v = rot.get(a).getAsDouble();
                        if (v != 0) {
                            angle = v;
                            axis = a == 0 ? "x" : a == 1 ? "y" : "z";
                        }
                    }
                    if (axis != null) {
                        JsonObject r = new JsonObject();
                        r.addProperty("angle", snapAngle(angle));
                        r.addProperty("axis", axis);
                        r.add("origin", copyVec(e.getAsJsonArray("origin"), null));
                        out.add("rotation", r);
                    }
                }

                if (e.has("faces")) {
                    JsonObject faces = e.getAsJsonObject("faces");
                    JsonObject outFaces = new JsonObject();
                    for (String dir : List.of("north", "east", "south", "west", "up", "down")) {
                        if (!faces.has(dir) || !faces.get(dir).isJsonObject()) continue;
                        JsonObject f = faces.getAsJsonObject(dir);
                        if (!f.has("texture") || f.get("texture").isJsonNull()) continue;

                        JsonObject of = new JsonObject();
                        if (f.has("uv") && f.get("uv").isJsonArray()) {
                            JsonArray uv = f.getAsJsonArray("uv");
                            JsonArray scaled = new JsonArray();
                            for (int i = 0; i < uv.size(); i++) {
                                double v = uv.get(i).getAsDouble();
                                double factor = (i % 2 == 0) ? (16.0 / resW) : (16.0 / resH);
                                scaled.add(round(v * factor));
                            }
                            of.add("uv", scaled);
                        }
                        int texIndex = f.get("texture").getAsInt();
                        of.addProperty("texture", "#" + texIndex);
                        if (f.has("rotation")) of.addProperty("rotation", f.get("rotation").getAsInt());
                        if (f.has("tintindex")) of.addProperty("tintindex", f.get("tintindex").getAsInt());
                        outFaces.add(dir, of);
                    }
                    if (outFaces.size() > 0) out.add("faces", outFaces);
                }

                outElements.add(out);
            }
        }

        JsonObject model = new JsonObject();
        model.addProperty("parent", "minecraft:item/generated");
        model.remove("parent"); // custom geometry -> zadny parent
        if (texMap.size() > 0) model.add("textures", texMap);
        model.add("elements", outElements);
        model.addProperty("gui_light", "front");

        if (src.has("display") && src.get("display").isJsonObject()) {
            model.add("display", src.getAsJsonObject("display"));
        } else {
            model.add("display", defaultDisplay());
        }

        return new Compiled(id, model, pngs);
    }

    private static JsonObject defaultDisplay() {
        JsonObject display = new JsonObject();
        display.add("thirdperson_righthand", transform(new double[]{0, 0, 0}, new double[]{0, 0, 0}, 1.0));
        display.add("firstperson_righthand", transform(new double[]{0, 45, 0}, new double[]{0, 0, 0}, 0.9));
        display.add("gui", transform(new double[]{30, 45, 0}, new double[]{0, 0, 0}, 0.85));
        display.add("ground", transform(new double[]{0, 0, 0}, new double[]{0, 2, 0}, 0.5));
        display.add("fixed", transform(new double[]{0, 180, 0}, new double[]{0, 0, 0}, 1.0));
        return display;
    }

    private static JsonObject transform(double[] rotation, double[] translation, double scale) {
        JsonObject o = new JsonObject();
        o.add("rotation", arr(rotation));
        o.add("translation", arr(translation));
        o.add("scale", arr(new double[]{scale, scale, scale}));
        return o;
    }

    private static JsonArray arr(double[] values) {
        JsonArray a = new JsonArray();
        for (double v : values) a.add(round(v));
        return a;
    }

    /** Kopie vektoru s ohledem na inflate (bbmodel "inflate"). */
    private static JsonArray copyVec(JsonArray src, JsonObject element) {
        double inflate = 0;
        if (element != null && element.has("inflate")) inflate = element.get("inflate").getAsDouble();
        JsonArray out = new JsonArray();
        for (int i = 0; i < src.size(); i++) {
            out.add(round(clamp(src.get(i).getAsDouble())));
        }
        if (inflate != 0) return out;
        return out;
    }

    private static double clamp(double v) {
        return Math.max(-16.0, Math.min(32.0, v));
    }

    /** Vanilla povoluje jen -45/-22.5/0/22.5/45. */
    private static double snapAngle(double angle) {
        double[] allowed = {-45, -22.5, 0, 22.5, 45};
        double best = 0, bestDiff = Double.MAX_VALUE;
        for (double a : allowed) {
            double d = Math.abs(a - angle);
            if (d < bestDiff) {
                bestDiff = d;
                best = a;
            }
        }
        return best;
    }

    private static double round(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }

    // ---------------- .iaentitymodel / Bedrock geometry ----------------

    private static boolean isBedrock(JsonObject o) {
        if (o.has("minecraft:geometry")) return true;
        for (String k : o.keySet()) {
            if (k.startsWith("geometry.")) return true;
        }
        return false;
    }

    /** Prevede Bedrock geometry (.iaentitymodel / .geo.json) na bbmodel-like JSON. */
    private static JsonObject fromBedrock(JsonObject src) {
        JsonObject geo = null;
        if (src.has("minecraft:geometry") && src.get("minecraft:geometry").isJsonArray()) {
            JsonArray arr = src.getAsJsonArray("minecraft:geometry");
            if (arr.size() > 0 && arr.get(0).isJsonObject()) geo = arr.get(0).getAsJsonObject();
        } else {
            for (String k : src.keySet()) {
                if (k.startsWith("geometry.") && src.get(k).isJsonObject()) {
                    geo = src.getAsJsonObject(k);
                    break;
                }
            }
        }
        JsonObject out = new JsonObject();
        if (geo == null) {
            out.add("elements", new JsonArray());
            return out;
        }

        double texW = 16, texH = 16;
        JsonObject desc = geo.has("description") && geo.get("description").isJsonObject()
                ? geo.getAsJsonObject("description") : geo;
        if (desc.has("texture_width")) texW = desc.get("texture_width").getAsDouble();
        if (desc.has("texture_height")) texH = desc.get("texture_height").getAsDouble();
        if (texW <= 0) texW = 16;
        if (texH <= 0) texH = 16;

        JsonObject res = new JsonObject();
        res.addProperty("width", texW);
        res.addProperty("height", texH);
        out.add("resolution", res);

        JsonArray elements = new JsonArray();
        JsonArray bones = geo.has("bones") && geo.get("bones").isJsonArray()
                ? geo.getAsJsonArray("bones") : new JsonArray();

        for (JsonElement be : bones) {
            if (!be.isJsonObject()) continue;
            JsonObject bone = be.getAsJsonObject();
            if (!bone.has("cubes") || !bone.get("cubes").isJsonArray()) continue;
            for (JsonElement ce : bone.getAsJsonArray("cubes")) {
                if (!ce.isJsonObject()) continue;
                JsonObject cube = ce.getAsJsonObject();
                if (!cube.has("origin") || !cube.has("size")) continue;

                double[] o = vec3(cube.getAsJsonArray("origin"));
                double[] s = vec3(cube.getAsJsonArray("size"));
                double inflate = cube.has("inflate") ? cube.get("inflate").getAsDouble() : 0;

                // Bedrock -> Java: X je zrcadlene, posun o 8
                double x1 = 8 - (o[0] + s[0]) - inflate;
                double x2 = 8 - o[0] + inflate;
                double y1 = o[1] - inflate;
                double y2 = o[1] + s[1] + inflate;
                double z1 = o[2] + 8 - inflate;
                double z2 = o[2] + s[2] + 8 + inflate;

                JsonObject el = new JsonObject();
                el.add("from", arr(new double[]{x1, y1, z1}));
                el.add("to", arr(new double[]{x2, y2, z2}));

                if (cube.has("rotation") && cube.get("rotation").isJsonArray()) {
                    el.add("rotation", cube.getAsJsonArray("rotation"));
                    double[] piv = cube.has("pivot")
                            ? vec3(cube.getAsJsonArray("pivot"))
                            : new double[]{o[0] + s[0] / 2, o[1] + s[1] / 2, o[2] + s[2] / 2};
                    el.add("origin", arr(new double[]{8 - piv[0], piv[1], piv[2] + 8}));
                }

                el.add("faces", bedrockFaces(cube, s));
                elements.add(el);
            }
        }
        out.add("elements", elements);
        return out;
    }

    private static JsonObject bedrockFaces(JsonObject cube, double[] size) {
        JsonObject faces = new JsonObject();
        JsonElement uvEl = cube.get("uv");

        if (uvEl != null && uvEl.isJsonObject()) {
            // per-face UV
            JsonObject uvObj = uvEl.getAsJsonObject();
            for (String dir : List.of("north", "east", "south", "west", "up", "down")) {
                if (!uvObj.has(dir) || !uvObj.get(dir).isJsonObject()) continue;
                JsonObject f = uvObj.getAsJsonObject(dir);
                if (!f.has("uv") || !f.has("uv_size")) continue;
                double[] p = vec2(f.getAsJsonArray("uv"));
                double[] sz = vec2(f.getAsJsonArray("uv_size"));
                faces.add(dir, face(p[0], p[1], p[0] + sz[0], p[1] + sz[1]));
            }
            return faces;
        }

        if (uvEl != null && uvEl.isJsonArray()) {
            // box UV
            double[] uv = vec2(uvEl.getAsJsonArray());
            double u = uv[0], v = uv[1];
            double w = size[0], h = size[1], d = size[2];
            faces.add("up", face(u + d, v, u + d + w, v + d));
            faces.add("down", face(u + d + w, v + d, u + d + w * 2, v));
            faces.add("east", face(u, v + d, u + d, v + d + h));
            faces.add("north", face(u + d, v + d, u + d + w, v + d + h));
            faces.add("west", face(u + d + w, v + d, u + d * 2 + w, v + d + h));
            faces.add("south", face(u + d * 2 + w, v + d, u + d * 2 + w * 2, v + d + h));
        }
        return faces;
    }

    private static JsonObject face(double u1, double v1, double u2, double v2) {
        JsonObject f = new JsonObject();
        f.add("uv", arr(new double[]{u1, v1, u2, v2}));
        f.addProperty("texture", 0);
        return f;
    }

    private static double[] vec3(JsonArray a) {
        return new double[]{
                a.size() > 0 ? a.get(0).getAsDouble() : 0,
                a.size() > 1 ? a.get(1).getAsDouble() : 0,
                a.size() > 2 ? a.get(2).getAsDouble() : 0
        };
    }

    private static double[] vec2(JsonArray a) {
        return new double[]{
                a.size() > 0 ? a.get(0).getAsDouble() : 0,
                a.size() > 1 ? a.get(1).getAsDouble() : 0
        };
    }
}
}
