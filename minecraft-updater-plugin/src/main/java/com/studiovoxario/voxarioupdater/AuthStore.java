package com.studiovoxario.voxarioupdater;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.attribute.PosixFilePermission;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

/**
 * Bezpecne ulozeni tokenu jednotlivych platforem.
 *
 * Zasady ochrany soukromi:
 *  - Hesla se NIKDY neukladaji ani neposilaji nasim serverum.
 *  - Ukladaji se pouze API / OAuth tokeny, sifrovane AES-256-GCM.
 *  - Klic lezi v samostatnem souboru s pravy 600 (kde to OS umi).
 *  - Token lze kdykoliv smazat prikazem /voxupdate logout <platforma>.
 */
public final class AuthStore {

    private final File keyFile;
    private final File dataFile;
    private final Map<String, String> tokens = new HashMap<>();
    private SecretKey key;

    public AuthStore(File folder) {
        folder.mkdirs();
        this.keyFile = new File(folder, "auth.key");
        this.dataFile = new File(folder, "auth.dat");
        try {
            this.key = loadOrCreateKey();
            load();
        } catch (Exception e) {
            this.key = null;
        }
    }

    private SecretKey loadOrCreateKey() throws Exception {
        if (keyFile.isFile()) {
            byte[] raw = Base64.getDecoder().decode(Files.readString(keyFile.toPath()).trim());
            return new SecretKeySpec(raw, "AES");
        }
        KeyGenerator kg = KeyGenerator.getInstance("AES");
        kg.init(256);
        SecretKey k = kg.generateKey();
        Files.writeString(keyFile.toPath(), Base64.getEncoder().encodeToString(k.getEncoded()));
        lockDown(keyFile);
        return k;
    }

    private void lockDown(File f) {
        try {
            Set<PosixFilePermission> perms = new HashSet<>();
            perms.add(PosixFilePermission.OWNER_READ);
            perms.add(PosixFilePermission.OWNER_WRITE);
            Files.setPosixFilePermissions(f.toPath(), perms);
        } catch (Exception ignored) {
            f.setReadable(false, false);
            f.setReadable(true, true);
            f.setWritable(false, false);
            f.setWritable(true, true);
        }
    }

    private void load() throws Exception {
        tokens.clear();
        if (!dataFile.isFile()) return;
        Properties p = new Properties();
        try (var in = Files.newInputStream(dataFile.toPath())) { p.load(in); }
        for (String name : p.stringPropertyNames()) {
            String dec = decrypt(p.getProperty(name));
            if (dec != null) tokens.put(name, dec);
        }
    }

    private void save() {
        try {
            Properties p = new Properties();
            tokens.forEach((k, v) -> p.setProperty(k, encrypt(v)));
            try (var out = Files.newOutputStream(dataFile.toPath())) {
                p.store(out, "VoxarioUpdater - sifrovane tokeny (AES-GCM). Nikdy nesdilej tento soubor.");
            }
            lockDown(dataFile);
        } catch (Exception ignored) {}
    }

    private String encrypt(String plain) {
        try {
            byte[] iv = new byte[12];
            new SecureRandom().nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] all = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, all, 0, iv.length);
            System.arraycopy(ct, 0, all, iv.length, ct.length);
            return Base64.getEncoder().encodeToString(all);
        } catch (Exception e) {
            return "";
        }
    }

    private String decrypt(String enc) {
        try {
            byte[] all = Base64.getDecoder().decode(enc);
            byte[] iv = new byte[12];
            System.arraycopy(all, 0, iv, 0, 12);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            return new String(c.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    public boolean has(String provider) {
        String t = tokens.get(provider);
        return t != null && !t.isBlank();
    }

    public String get(String provider) {
        return tokens.getOrDefault(provider, "");
    }

    public void set(String provider, String token) {
        tokens.put(provider, token);
        save();
    }

    public void clear(String provider) {
        tokens.remove(provider);
        save();
    }

    public Set<String> providers() {
        return tokens.keySet();
    }
}
