package com.studiovoxario.voxarioupdater;

import java.util.Locale;

/** Porovnavani verzi (semver-ish, tolerantni k prefixum a suffixum). */
public final class Versions {

    private Versions() {}

    public static String clean(String v) {
        if (v == null) return "0";
        String s = v.trim().toLowerCase(Locale.ROOT);
        if (s.startsWith("v")) s = s.substring(1);
        int sp = s.indexOf(' ');
        if (sp > 0) s = s.substring(0, sp);
        return s;
    }

    /** true, kdyz je "latest" novejsi nez "current". */
    public static boolean isNewer(String latest, String current) {
        String a = clean(latest), b = clean(current);
        if (a.equals(b)) return false;
        String[] as = a.split("[^0-9]+");
        String[] bs = b.split("[^0-9]+");
        int n = Math.max(as.length, bs.length);
        for (int i = 0; i < n; i++) {
            long x = num(as, i), y = num(bs, i);
            if (x != y) return x > y;
        }
        // Cisla stejna -> release je novejsi nez snapshot/beta
        boolean aPre = a.matches(".*(snapshot|beta|alpha|rc|pre).*");
        boolean bPre = b.matches(".*(snapshot|beta|alpha|rc|pre).*");
        return bPre && !aPre;
    }

    private static long num(String[] arr, int i) {
        if (i >= arr.length) return 0;
        String s = arr[i];
        if (s == null || s.isBlank()) return 0;
        try { return Long.parseLong(s); } catch (Exception e) { return 0; }
    }
}
