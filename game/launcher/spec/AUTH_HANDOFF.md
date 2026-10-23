# StudioVoxario account handoff

## Current website authentication observed in the repository

The website currently uses:

- Supabase Auth for email/password sign-up and sign-in.
- `user_roles` for application roles.
- Lovable auth for Google OAuth and then establishes the Supabase session.
- Website auth route: `/auth`.

The game launcher must reuse this identity rather than create a second independent account database.

## Target launcher flow

```
Launcher
  |
  | 1. Create random state + PKCE verifier/challenge
  v
System browser -> StudioVoxario web auth
  |
  | 2. User signs in using the existing website flow
  | 3. Website/backend issues a short-lived one-time launcher code
  v
Loopback callback on 127.0.0.1 (preferred)
  |
  | 4. Launcher verifies state
  | 5. Launcher exchanges one-time code + PKCE verifier
  v
Short-lived launcher session
  |
  v
Game session / multiplayer server
```

## Why browser-based sign-in

- The launcher never sees the user's website password.
- Existing email/password and Google sign-in remain centralized on the website.
- Future MFA/account security changes remain web-owned.
- Launcher login can be revoked independently from the website session.

## Preferred callback

Use a temporary loopback listener on `127.0.0.1` with a random available port.

Example concept:

```
http://127.0.0.1:49321/auth/callback
```

The launcher starts the listener before opening the browser.

A custom URI scheme can be added later as a fallback, but the loopback flow is preferred for the initial Windows launcher.

## Token rules

- One-time code lifetime: short.
- One-time code: single use.
- Launcher access token: short-lived.
- Refresh/session token: store only in Windows-protected credential storage.
- Never write access/refresh tokens to normal logs.
- Never store plaintext passwords.
- Validate `state` and PKCE on every handoff.

## Server-side requirement

The current website frontend can authenticate users, but a secure launcher handoff requires a trusted backend endpoint/function to mint and redeem one-time launcher codes.

That endpoint is intentionally not implemented in Foundation v0.1. It should be added only after the server-side auth path and deployment ownership are agreed.

## Roles and bans

The launcher/game gateway should check account status server-side.

At minimum:
- banned users cannot obtain a valid game session
- admin/editor website roles do not automatically grant gameplay powers
- game permissions should be separate from website moderation roles unless explicitly mapped

## Implementace (launcher 0.5.0, hra 0.8.0)

- Web: `/game/auth/launcher` (`src/pages/LauncherAuth.tsx`) – potvrzení launcheru, požadavek se přes přihlášení drží v `localStorage` (15 min).
- Server: edge funkce `launcher-auth` (`start` / `redeem` / `ticket`), tabulka `launcher_auth_codes` (jen SHA-256 otisk kódu, platnost 2 min, jednorázový), `launcher_sessions_log` (90 dní).
- Launcher: `app/auth.cjs` – PKCE (S256), loopback `127.0.0.1:<náhodný port>/callback`, kontrola `state`, relace z `POST /auth/v1/verify` (token_hash),
  obnovovací token šifrovaně přes `safeStorage` (DPAPI) v `userData/account.bin`. Bez šifrování se přihlášení neukládá.
- Hra: launcher před spuštěním vyžádá `ticket` a předá ho v proměnné prostředí `ASHES_LAUNCHER_TICKET`; hra (`SupabaseClient.SignInWithTicket`)
  si vytvoří vlastní relaci a proměnnou hned smaže. Když lístek selže, použije se uložené přihlášení / přihlašovací obrazovka hry.
