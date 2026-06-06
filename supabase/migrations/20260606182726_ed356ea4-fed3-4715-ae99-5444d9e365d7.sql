UPDATE public.bot_stream_notifications
SET handle = '@sokolcze', last_video_id = NULL, last_notified_at = NULL
WHERE platform = 'youtube' AND handle = 'Sokolcz';