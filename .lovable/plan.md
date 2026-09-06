# Diagnosis: blank screen after clicking the bell (V28 notification center)

## What I verified (no code changed)

1. **The notifications table has no access grants.**
   `supabase/migrations/20260906173000_vox_notifications.sql` creates `public.vox_notifications`, enables RLS, adds policies and adds the table to the realtime publication — but contains **no `GRANT` statements**. A live check confirms it:
   `select grantee, privilege_type from information_schema.role_table_grants where table_name='vox_notifications'` returns **zero rows**, while `to_regclass('public.vox_notifications')` is non-null and the table is in the realtime publication.
   Consequence: every select/update/delete from the app fails with `42501 permission denied for table vox_notifications`, and the realtime authorization check for that topic also fails.

2. **The same realtime topic is subscribed twice at the same time.**
   `src/hooks/useVoxNotifications.ts:55` uses a fixed topic name: `` supabase.channel(`vox_notifications_${user.id}`) ``.
   The hook is mounted **twice** as soon as the bell is clicked:
   - `src/components/vox/reference/CommunityTopbar.tsx:61` — `useVoxNotifications(100)` for the badge (always mounted)
   - `src/components/vox/reference/CommunityNotifications.tsx:27` — `useVoxNotifications()` inside the overlay
   Two channel instances with an identical topic on one socket is exactly the pattern that already broke Profile and Live Now in this project; those were fixed by adding a random suffix (`src/hooks/useLiveStreams.ts:70`, `src/hooks/useNotifications.ts:64`). `useVoxNotifications` was written without that fix. When the second instance subscribes (and when either unmounts and calls `removeChannel` on the shared topic), supabase-js raises an error inside the subscribe/teardown callback, outside any `try/catch`.

3. **Nothing catches a thrown error.** `grep -rn "ErrorBoundary" src/` returns nothing — the app has no error boundary at any level. Any throw during render or inside an effect therefore unmounts the entire React tree, leaving only the dark page background. That matches the reported symptom exactly (the CSS was ruled out: `.sv-utility-overlay` in `community-suite-v25.css:1` is inset `left:102px right:7px top:120px bottom:8px`, so it cannot paint over the whole screen; all lucide icons used in V28 exist in the installed 0.462 build).

**Most likely exact failure:** clicking the bell mounts a second `useVoxNotifications`, which subscribes to the already-subscribed topic `vox_notifications_<user id>` and errors (permission-denied topic + duplicate topic). The error escapes the effect, and with no error boundary React unmounts the whole tree — blank dark background. The missing `GRANT`s are the underlying reason the notification data never loads even when the UI survives.

## Recommended minimal, robust fix (three small changes)

1. **Migration — add the missing grants** (new migration, do not edit the old one):
   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_notifications TO authenticated;
   GRANT ALL ON public.vox_notifications TO service_role;
   ```
   Also set `alter table public.vox_notifications replica identity full;` so realtime delivers updates/deletes.

2. **`src/hooks/useVoxNotifications.ts`** — make the topic unique per hook instance (`vox_notifications_${user.id}_${crypto.randomUUID()}`), wrap the whole subscribe/`removeChannel` block in `try/catch`, and guard the subscribe status callback so a `CHANNEL_ERROR` only sets the hook's `error` state instead of throwing. Optionally, share one instance via a small module-level cache so the badge and the overlay do not open two sockets at all.

3. **Add an error boundary around the utility overlay** (`CommunityUtilityOverlay` in `src/components/vox/reference/CommunityTopbar.tsx:205`) so a future failure inside a feature panel degrades to an inline "panel unavailable" message instead of blanking the app.

## Verification after the fix
- Reload `/app`, click the bell: the panel opens, shows either notifications or an empty state, and the rest of the UI stays visible.
- Close and reopen the panel several times, plus a page refresh, to confirm no duplicate-subscription error.
- Query `role_table_grants` again to confirm `authenticated` and `service_role` privileges exist.

Note: an unrelated pre-existing typecheck error remains at `src/components/vox/reference/CommunityMembers.tsx:210` (a `title` prop passed to a lucide icon); worth fixing in the same pass.
