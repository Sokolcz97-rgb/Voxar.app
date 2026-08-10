package com.studiovoxario.voxariobridge;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Uplne minimalni JSON encoder + primitivni parser pro odpovedi bridge. */
public final class Json {

    private Json() {}

    public static String escape(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.toString();
    }

    public static String object(Map<String, String> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> e : map.entrySet()) {
            if (e.getValue() == null) continue;
            if (!first) sb.append(',');
            first = false;
            sb.append('"').append(escape(e.getKey())).append("\":\"").append(escape(e.getValue())).append('"');
        }
        return sb.append('}').toString();
    }

    /** Vrati hodnotu stringoveho klice na nejvyssi urovni (jednoduche, staci pro nase odpovedi). */
    public static String getString(String json, String key) {
        if (json == null) return null;
        String needle = "\"" + key + "\"";
        int i = json.indexOf(needle);
        if (i < 0) return null;
        i = json.indexOf(':', i + needle.length());
        if (i < 0) return null;
        i++;
        while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
        if (i >= json.length() || json.charAt(i) != '"') return null;
        i++;
        StringBuilder sb = new StringBuilder();
        while (i < json.length()) {
            char c = json.charAt(i);
            if (c == '\\' && i + 1 < json.length()) {
                char n = json.charAt(++i);
                switch (n) {
                    case 'n': sb.append('\n'); break;
                    case 'r': sb.append('\r'); break;
                    case 't': sb.append('\t'); break;
                    case 'u':
                        sb.append((char) Integer.parseInt(json.substring(i + 1, i + 5), 16));
                        i += 4;
                        break;
                    default: sb.append(n);
                }
            } else if (c == '"') {
                break;
            } else {
                sb.append(c);
            }
            i++;
        }
        return sb.toString();
    }

    /** Rozdeli pole objektu "messages":[{...},{...}] na jednotlive objekty. */
    public static List<String> getObjectArray(String json, String key) {
        List<String> out = new ArrayList<>();
        if (json == null) return out;
        String needle = "\"" + key + "\"";
        int i = json.indexOf(needle);
        if (i < 0) return out;
        i = json.indexOf('[', i);
        if (i < 0) return out;
        int depth = 0, start = -1;
        for (int j = i; j < json.length(); j++) {
            char c = json.charAt(j);
            if (c == '{') { if (depth == 0) start = j; depth++; }
            else if (c == '}') { depth--; if (depth == 0 && start >= 0) out.add(json.substring(start, j + 1)); }
            else if (c == ']' && depth == 0) break;
        }
        return out;
    }
}
