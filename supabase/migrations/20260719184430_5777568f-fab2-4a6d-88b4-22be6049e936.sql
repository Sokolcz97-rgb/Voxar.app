
-- Prevent self-claiming arbitrary Discord IDs, which could otherwise be used
-- to claim ownership of pending bot_guilds via matching owner_discord_id.
-- Require the discord_user_id to match a verified Discord OAuth identity
-- attached to the user in auth.identities.

DROP POLICY IF EXISTS "Users can create their own Discord link" ON public.user_discord_links;
DROP POLICY IF EXISTS "Users can update their own Discord link" ON public.user_discord_links;

CREATE POLICY "Users can create their own verified Discord link"
ON public.user_discord_links
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = auth.uid()
      AND i.provider = 'discord'
      AND i.provider_id = user_discord_links.discord_user_id
  )
);

CREATE POLICY "Users can update their own verified Discord link"
ON public.user_discord_links
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = auth.uid()
      AND i.provider = 'discord'
      AND i.provider_id = user_discord_links.discord_user_id
  )
);
