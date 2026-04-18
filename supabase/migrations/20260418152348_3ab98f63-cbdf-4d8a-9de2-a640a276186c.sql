
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_sound boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_browser boolean NOT NULL DEFAULT true;
