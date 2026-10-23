using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Voxario.Ashes
{
    /// <summary>
    /// Spojení se serverem hry (Supabase): přihlášení účtem StudioVoxario a herní RPC.
    /// Server je autoritativní – stejné funkce používá webová verze.
    /// </summary>
    public class SupabaseClient
    {
        public const string Url = "https://rioexuvgvmdwvidfakxy.supabase.co";
        public const string PublishableKey = "sb_publishable_s0KxdrY9Wm7_j2mtI-PnJg_eYbQln9-";

        public string AccessToken { get; private set; }
        public string RefreshToken { get; private set; }
        public string Email { get; private set; }
        public bool SignedIn => !string.IsNullOrEmpty(AccessToken);

        [Serializable] class PasswordLogin { public string email; public string password; }
        [Serializable] class RefreshLogin { public string refresh_token; }
        [Serializable] class TicketLogin { public string type = "magiclink"; public string token_hash; }
        [Serializable] class TokenResponse { public string access_token; public string refresh_token; public User user; public string error_description; public string msg; }
        [Serializable] class User { public string email; }
        [Serializable] class ErrorResponse { public string message; public string error_description; public string msg; }

        public IEnumerator SignIn(string email, string password, Action<string> done)
        {
            var body = JsonUtility.ToJson(new PasswordLogin { email = email, password = password });
            yield return Send($"{Url}/auth/v1/token?grant_type=password", body, false, (ok, text) =>
            {
                if (!ok) { done(ReadError(text, "Přihlášení se nepodařilo. Zkontroluj e-mail a heslo.")); return; }
                var t = JsonUtility.FromJson<TokenResponse>(text);
                AccessToken = t.access_token;
                RefreshToken = t.refresh_token;
                Email = t.user != null ? t.user.email : email;
                PlayerPrefs.SetString("ashes.refresh", RefreshToken ?? "");
                done(null);
            });
        }

        /// <summary>
        /// Přihlášení jednorázovým lístkem z launcheru (účet StudioVoxario přihlášený v launcheru).
        /// Hra si z něj udělá vlastní relaci – heslo nezná ani launcher, ani hra.
        /// </summary>
        public IEnumerator SignInWithTicket(string tokenHash, Action<bool> done)
        {
            var body = JsonUtility.ToJson(new TicketLogin { token_hash = tokenHash });
            yield return Send($"{Url}/auth/v1/verify", body, false, (ok, text) =>
            {
                if (!ok) { done(false); return; }
                var t = JsonUtility.FromJson<TokenResponse>(text);
                if (t == null || string.IsNullOrEmpty(t.access_token)) { done(false); return; }
                AccessToken = t.access_token;
                RefreshToken = t.refresh_token;
                Email = t.user != null ? t.user.email : "";
                PlayerPrefs.SetString("ashes.refresh", RefreshToken ?? "");
                done(true);
            });
        }

        /// <summary>Přihlášení uloženým obnovovacím tokenem (bez hesla).</summary>
        public IEnumerator Resume(Action<bool> done)
        {
            var refresh = PlayerPrefs.GetString("ashes.refresh", "");
            if (string.IsNullOrEmpty(refresh)) { done(false); yield break; }
            var body = JsonUtility.ToJson(new RefreshLogin { refresh_token = refresh });
            yield return Send($"{Url}/auth/v1/token?grant_type=refresh_token", body, false, (ok, text) =>
            {
                if (!ok) { done(false); return; }
                var t = JsonUtility.FromJson<TokenResponse>(text);
                AccessToken = t.access_token;
                RefreshToken = t.refresh_token;
                Email = t.user != null ? t.user.email : "";
                PlayerPrefs.SetString("ashes.refresh", RefreshToken ?? "");
                done(true);
            });
        }

        public void SignOut()
        {
            AccessToken = null;
            RefreshToken = null;
            PlayerPrefs.DeleteKey("ashes.refresh");
        }

        /// <summary>Volání serverové funkce (RPC), odpověď jako JSON text.</summary>
        public IEnumerator Rpc(string fn, string jsonArgs, Action<string, string> done)
        {
            yield return Send($"{Url}/rest/v1/rpc/{fn}", string.IsNullOrEmpty(jsonArgs) ? "{}" : jsonArgs, true, (ok, text) =>
            {
                if (ok) done(text, null);
                else done(null, ReadError(text, "Server odmítl požadavek."));
            });
        }

        IEnumerator Send(string url, string json, bool auth, Action<bool, string> done)
        {
            using var req = new UnityWebRequest(url, "POST");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("apikey", PublishableKey);
            if (auth && SignedIn) req.SetRequestHeader("Authorization", "Bearer " + AccessToken);
            req.timeout = 20;
            yield return req.SendWebRequest();
            bool ok = req.result == UnityWebRequest.Result.Success;
            done(ok, req.downloadHandler != null ? req.downloadHandler.text : req.error);
        }

        static string ReadError(string text, string fallback)
        {
            try
            {
                var e = JsonUtility.FromJson<ErrorResponse>(text);
                var m = e.message ?? e.error_description ?? e.msg;
                if (!string.IsNullOrEmpty(m))
                {
                    if (m.Contains("Invalid login")) return fallback;
                    return m;
                }
            }
            catch { /* neplatný JSON */ }
            return fallback;
        }
    }
}
