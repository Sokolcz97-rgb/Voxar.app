package com.studiovoxario.voxarioupdater;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/** Male HTTP utilitko nad java.net.http. */
public final class Http {

    public static final Gson GSON = new Gson();
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public static final String UA = "VoxarioUpdater/1.0 (+https://studiovoxario.com)";

    public record Res(int code, String body) {
        public boolean ok() { return code >= 200 && code < 300; }
        public JsonElement json() { return JsonParser.parseString(body); }
    }

    private Http() {}

    public static Res get(String url, Map<String, String> headers) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", UA)
                    .header("Accept", "application/json")
                    .GET();
            if (headers != null) headers.forEach(b::header);
            HttpResponse<String> r = CLIENT.send(b.build(), HttpResponse.BodyHandlers.ofString());
            return new Res(r.statusCode(), r.body());
        } catch (Exception e) {
            return new Res(-1, e.getMessage() == null ? "error" : e.getMessage());
        }
    }

    public static Res post(String url, String contentType, String body, Map<String, String> headers) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", UA)
                    .header("Accept", "application/json")
                    .header("Content-Type", contentType)
                    .POST(HttpRequest.BodyPublishers.ofString(body == null ? "" : body));
            if (headers != null) headers.forEach(b::header);
            HttpResponse<String> r = CLIENT.send(b.build(), HttpResponse.BodyHandlers.ofString());
            return new Res(r.statusCode(), r.body());
        } catch (Exception e) {
            return new Res(-1, e.getMessage() == null ? "error" : e.getMessage());
        }
    }

    /** Stahne soubor. Vraci HTTP kod. */
    public static int download(String url, Map<String, String> headers, Path target) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofMinutes(5))
                    .header("User-Agent", UA)
                    .GET();
            if (headers != null) headers.forEach(b::header);
            HttpResponse<Path> r = CLIENT.send(b.build(), HttpResponse.BodyHandlers.ofFile(target));
            return r.statusCode();
        } catch (Exception e) {
            return -1;
        }
    }

    public static Map<String, String> h(String... kv) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
        return m;
    }
}
