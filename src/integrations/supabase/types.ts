export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bot_commands: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          guild_id: string | null
          id: string
          name: string
          response_type: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          guild_id?: string | null
          id?: string
          name: string
          response_type?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          guild_id?: string | null
          id?: string
          name?: string
          response_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_config: {
        Row: {
          automod_action: string
          automod_blocked_words: string[]
          automod_enabled: boolean
          automod_max_emojis: number
          automod_max_mentions: number
          automod_spam_threshold: number
          bot_maintenance: boolean
          bypass_role_ids: string[]
          default_alerts_channel: string | null
          default_log_channel: string | null
          default_welcome_channel: string | null
          id: string
          is_singleton: boolean
          maintenance_channel: string | null
          nsfw_allowed_channels: string[]
          nsfw_protection: boolean
          prefix: string
          updated_at: string
          updated_by: string | null
          web_maintenance: boolean
        }
        Insert: {
          automod_action?: string
          automod_blocked_words?: string[]
          automod_enabled?: boolean
          automod_max_emojis?: number
          automod_max_mentions?: number
          automod_spam_threshold?: number
          bot_maintenance?: boolean
          bypass_role_ids?: string[]
          default_alerts_channel?: string | null
          default_log_channel?: string | null
          default_welcome_channel?: string | null
          id?: string
          is_singleton?: boolean
          maintenance_channel?: string | null
          nsfw_allowed_channels?: string[]
          nsfw_protection?: boolean
          prefix?: string
          updated_at?: string
          updated_by?: string | null
          web_maintenance?: boolean
        }
        Update: {
          automod_action?: string
          automod_blocked_words?: string[]
          automod_enabled?: boolean
          automod_max_emojis?: number
          automod_max_mentions?: number
          automod_spam_threshold?: number
          bot_maintenance?: boolean
          bypass_role_ids?: string[]
          default_alerts_channel?: string | null
          default_log_channel?: string | null
          default_welcome_channel?: string | null
          id?: string
          is_singleton?: boolean
          maintenance_channel?: string | null
          nsfw_allowed_channels?: string[]
          nsfw_protection?: boolean
          prefix?: string
          updated_at?: string
          updated_by?: string | null
          web_maintenance?: boolean
        }
        Relationships: []
      }
      bot_guild_config: {
        Row: {
          automod_action: string
          automod_blocked_words: string[]
          automod_enabled: boolean
          automod_max_emojis: number
          automod_max_mentions: number
          automod_spam_threshold: number
          bot_maintenance: boolean
          bypass_role_ids: string[]
          default_alerts_channel: string | null
          default_log_channel: string | null
          default_welcome_channel: string | null
          guild_id: string
          id: string
          maintenance_channel: string | null
          nsfw_allowed_channels: string[]
          nsfw_protection: boolean
          prefix: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          automod_action?: string
          automod_blocked_words?: string[]
          automod_enabled?: boolean
          automod_max_emojis?: number
          automod_max_mentions?: number
          automod_spam_threshold?: number
          bot_maintenance?: boolean
          bypass_role_ids?: string[]
          default_alerts_channel?: string | null
          default_log_channel?: string | null
          default_welcome_channel?: string | null
          guild_id: string
          id?: string
          maintenance_channel?: string | null
          nsfw_allowed_channels?: string[]
          nsfw_protection?: boolean
          prefix?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          automod_action?: string
          automod_blocked_words?: string[]
          automod_enabled?: boolean
          automod_max_emojis?: number
          automod_max_mentions?: number
          automod_spam_threshold?: number
          bot_maintenance?: boolean
          bypass_role_ids?: string[]
          default_alerts_channel?: string | null
          default_log_channel?: string | null
          default_welcome_channel?: string | null
          guild_id?: string
          id?: string
          maintenance_channel?: string | null
          nsfw_allowed_channels?: string[]
          nsfw_protection?: boolean
          prefix?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_guild_config_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "bot_guilds"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      bot_guilds: {
        Row: {
          created_at: string
          guild_id: string
          icon_url: string | null
          id: string
          member_count: number | null
          name: string
          notes: string | null
          owner_discord_id: string | null
          owner_user_id: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: Database["public"]["Enums"]["bot_guild_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          guild_id: string
          icon_url?: string | null
          id?: string
          member_count?: number | null
          name: string
          notes?: string | null
          owner_discord_id?: string | null
          owner_user_id?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["bot_guild_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          guild_id?: string
          icon_url?: string | null
          id?: string
          member_count?: number | null
          name?: string
          notes?: string | null
          owner_discord_id?: string | null
          owner_user_id?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["bot_guild_status"]
          updated_at?: string
        }
        Relationships: []
      }
      bot_minecraft_config: {
        Row: {
          achievement_channel: string | null
          achievement_format: string
          allow_chat_relay: boolean
          allow_commands: boolean
          allow_discord_to_mc: boolean
          chat_channel: string | null
          chat_format: string
          console_channel: string | null
          death_channel: string | null
          death_format: string
          enabled: boolean
          guild_id: string
          id: string
          join_format: string
          join_leave_channel: string | null
          leave_format: string
          link_role_id: string | null
          plugin_token: string
          server_address: string | null
          server_status_channel: string | null
          server_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          achievement_channel?: string | null
          achievement_format?: string
          allow_chat_relay?: boolean
          allow_commands?: boolean
          allow_discord_to_mc?: boolean
          chat_channel?: string | null
          chat_format?: string
          console_channel?: string | null
          death_channel?: string | null
          death_format?: string
          enabled?: boolean
          guild_id: string
          id?: string
          join_format?: string
          join_leave_channel?: string | null
          leave_format?: string
          link_role_id?: string | null
          plugin_token?: string
          server_address?: string | null
          server_status_channel?: string | null
          server_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          achievement_channel?: string | null
          achievement_format?: string
          allow_chat_relay?: boolean
          allow_commands?: boolean
          allow_discord_to_mc?: boolean
          chat_channel?: string | null
          chat_format?: string
          console_channel?: string | null
          death_channel?: string | null
          death_format?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          join_format?: string
          join_leave_channel?: string | null
          leave_format?: string
          link_role_id?: string | null
          plugin_token?: string
          server_address?: string | null
          server_status_channel?: string | null
          server_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_minecraft_config_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: true
            referencedRelation: "bot_guilds"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      bot_minecraft_links: {
        Row: {
          discord_user_id: string | null
          guild_id: string
          id: string
          minecraft_name: string
          minecraft_uuid: string
          user_id: string | null
          verified_at: string
        }
        Insert: {
          discord_user_id?: string | null
          guild_id: string
          id?: string
          minecraft_name: string
          minecraft_uuid: string
          user_id?: string | null
          verified_at?: string
        }
        Update: {
          discord_user_id?: string | null
          guild_id?: string
          id?: string
          minecraft_name?: string
          minecraft_uuid?: string
          user_id?: string | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_minecraft_links_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "bot_guilds"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      bot_minecraft_pending_links: {
        Row: {
          code: string
          created_at: string
          discord_user_id: string | null
          expires_at: string
          guild_id: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          discord_user_id?: string | null
          expires_at?: string
          guild_id: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          discord_user_id?: string | null
          expires_at?: string
          guild_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_minecraft_pending_links_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "bot_guilds"
            referencedColumns: ["guild_id"]
          },
        ]
      }
      bot_open_tickets: {
        Row: {
          category_id: string | null
          category_label: string | null
          channel_id: string
          created_at: string
          guild_id: string
          id: string
          source: string
          user_id: string
          user_tag: string | null
          web_ticket_id: string | null
        }
        Insert: {
          category_id?: string | null
          category_label?: string | null
          channel_id: string
          created_at?: string
          guild_id: string
          id?: string
          source?: string
          user_id: string
          user_tag?: string | null
          web_ticket_id?: string | null
        }
        Update: {
          category_id?: string | null
          category_label?: string | null
          channel_id?: string
          created_at?: string
          guild_id?: string
          id?: string
          source?: string
          user_id?: string
          user_tag?: string | null
          web_ticket_id?: string | null
        }
        Relationships: []
      }
      bot_outbound_queue: {
        Row: {
          channel_id: string | null
          created_at: string
          error: string | null
          id: string
          payload: Json
          sent_at: string | null
          source: string
          webhook_url: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          payload: Json
          sent_at?: string | null
          source?: string
          webhook_url?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          source?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      bot_points: {
        Row: {
          guild_id: string
          last_milestone: number
          points: number
          total_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          guild_id: string
          last_milestone?: number
          points?: number
          total_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          guild_id?: string
          last_milestone?: number
          points?: number
          total_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_points_config: {
        Row: {
          announce_message: string
          bonus_multiplier: number
          bonus_role_ids: string[]
          created_at: string
          enabled: boolean
          goal_channel_id: string | null
          guild_id: string
          ignore_afk: boolean
          ignore_deafened: boolean
          ignore_muted: boolean
          ignored_channel_ids: string[]
          milestones: number[]
          min_members: number
          minutes_per_point: number
          public_leaderboard: boolean
          repeat_every: number
          updated_at: string
        }
        Insert: {
          announce_message?: string
          bonus_multiplier?: number
          bonus_role_ids?: string[]
          created_at?: string
          enabled?: boolean
          goal_channel_id?: string | null
          guild_id: string
          ignore_afk?: boolean
          ignore_deafened?: boolean
          ignore_muted?: boolean
          ignored_channel_ids?: string[]
          milestones?: number[]
          min_members?: number
          minutes_per_point?: number
          public_leaderboard?: boolean
          repeat_every?: number
          updated_at?: string
        }
        Update: {
          announce_message?: string
          bonus_multiplier?: number
          bonus_role_ids?: string[]
          created_at?: string
          enabled?: boolean
          goal_channel_id?: string | null
          guild_id?: string
          ignore_afk?: boolean
          ignore_deafened?: boolean
          ignore_muted?: boolean
          ignored_channel_ids?: string[]
          milestones?: number[]
          min_members?: number
          minutes_per_point?: number
          public_leaderboard?: boolean
          repeat_every?: number
          updated_at?: string
        }
        Relationships: []
      }
      bot_points_log: {
        Row: {
          actor_user_id: string | null
          created_at: string
          delta: number
          guild_id: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          delta: number
          guild_id: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          delta?: number
          guild_id?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bot_server_stats: {
        Row: {
          category_id: string | null
          category_name: string
          enabled: boolean
          guild_id: string
          id: string
          slots: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id?: string | null
          category_name?: string
          enabled?: boolean
          guild_id: string
          id?: string
          slots?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string | null
          category_name?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          slots?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      bot_status: {
        Row: {
          guild_count: number | null
          id: string
          is_singleton: boolean
          last_heartbeat: string | null
          version: string | null
        }
        Insert: {
          guild_count?: number | null
          id?: string
          is_singleton?: boolean
          last_heartbeat?: string | null
          version?: string | null
        }
        Update: {
          guild_count?: number | null
          id?: string
          is_singleton?: boolean
          last_heartbeat?: string | null
          version?: string | null
        }
        Relationships: []
      }
      bot_status_checks: {
        Row: {
          created_at: string
          discord_channel_id: string
          enabled: boolean
          guild_id: string | null
          id: string
          label: string
          last_changed_at: string | null
          last_checked_at: string | null
          last_status: string | null
          target: string
          target_type: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          discord_channel_id: string
          enabled?: boolean
          guild_id?: string | null
          id?: string
          label: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_status?: string | null
          target: string
          target_type?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          discord_channel_id?: string
          enabled?: boolean
          guild_id?: string | null
          id?: string
          label?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_status?: string | null
          target?: string
          target_type?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      bot_stream_notifications: {
        Row: {
          created_at: string
          discord_channel_id: string
          enabled: boolean
          guild_id: string | null
          handle: string
          id: string
          last_notified_at: string | null
          last_subscribed_at: string | null
          last_upload_id: string | null
          last_video_id: string | null
          platform: string
          template: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          discord_channel_id: string
          enabled?: boolean
          guild_id?: string | null
          handle: string
          id?: string
          last_notified_at?: string | null
          last_subscribed_at?: string | null
          last_upload_id?: string | null
          last_video_id?: string | null
          platform: string
          template?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          discord_channel_id?: string
          enabled?: boolean
          guild_id?: string | null
          handle?: string
          id?: string
          last_notified_at?: string | null
          last_subscribed_at?: string | null
          last_upload_id?: string | null
          last_video_id?: string | null
          platform?: string
          template?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      bot_ticket_categories: {
        Row: {
          created_at: string
          description: string | null
          discord_category_id: string | null
          emoji: string | null
          enabled: boolean
          guild_id: string
          id: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discord_category_id?: string | null
          emoji?: string | null
          enabled?: boolean
          guild_id: string
          id?: string
          label: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discord_category_id?: string | null
          emoji?: string | null
          enabled?: boolean
          guild_id?: string
          id?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      bot_tickets_config: {
        Row: {
          category_id: string | null
          external_webhook_url: string | null
          guild_id: string | null
          id: string
          mirror_enabled: boolean
          notify_channel_id: string | null
          panel_channel_id: string | null
          panel_mode: string
          support_role_id: string | null
          sync_channel_id: string | null
          sync_webhook_url: string | null
          transcripts_enabled: boolean
          updated_at: string
          welcome_md: string | null
        }
        Insert: {
          category_id?: string | null
          external_webhook_url?: string | null
          guild_id?: string | null
          id?: string
          mirror_enabled?: boolean
          notify_channel_id?: string | null
          panel_channel_id?: string | null
          panel_mode?: string
          support_role_id?: string | null
          sync_channel_id?: string | null
          sync_webhook_url?: string | null
          transcripts_enabled?: boolean
          updated_at?: string
          welcome_md?: string | null
        }
        Update: {
          category_id?: string | null
          external_webhook_url?: string | null
          guild_id?: string | null
          id?: string
          mirror_enabled?: boolean
          notify_channel_id?: string | null
          panel_channel_id?: string | null
          panel_mode?: string
          support_role_id?: string | null
          sync_channel_id?: string | null
          sync_webhook_url?: string | null
          transcripts_enabled?: boolean
          updated_at?: string
          welcome_md?: string | null
        }
        Relationships: []
      }
      bot_voice_sessions: {
        Row: {
          channel_id: string
          guild_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          guild_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          guild_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_welcome: {
        Row: {
          channel_id: string
          content: Json
          created_at: string
          enabled: boolean
          guild_id: string | null
          id: string
          message_type: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          content?: Json
          created_at?: string
          enabled?: boolean
          guild_id?: string | null
          id?: string
          message_type?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          content?: Json
          created_at?: string
          enabled?: boolean
          guild_id?: string | null
          id?: string
          message_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_bot_automod: {
        Row: {
          action: string
          allow_links_for_mods: boolean
          allow_links_for_subs: boolean
          blocked_words: string[]
          caps_min_length: number
          channel_id: string
          created_at: string
          link_whitelist: string[]
          max_caps_pct: number
          max_emojis: number
          max_links: number
          spam_threshold: number
          spam_window_seconds: number
          timeout_seconds: number
          updated_at: string
        }
        Insert: {
          action?: string
          allow_links_for_mods?: boolean
          allow_links_for_subs?: boolean
          blocked_words?: string[]
          caps_min_length?: number
          channel_id: string
          created_at?: string
          link_whitelist?: string[]
          max_caps_pct?: number
          max_emojis?: number
          max_links?: number
          spam_threshold?: number
          spam_window_seconds?: number
          timeout_seconds?: number
          updated_at?: string
        }
        Update: {
          action?: string
          allow_links_for_mods?: boolean
          allow_links_for_subs?: boolean
          blocked_words?: string[]
          caps_min_length?: number
          channel_id?: string
          created_at?: string
          link_whitelist?: string[]
          max_caps_pct?: number
          max_emojis?: number
          max_links?: number
          spam_threshold?: number
          spam_window_seconds?: number
          timeout_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_bot_automod_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "chat_bot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_bot_channels: {
        Row: {
          antiscam_enabled: boolean
          automod_enabled: boolean
          channel_id: string | null
          created_at: string
          display_name: string | null
          enabled: boolean
          handle: string
          id: string
          last_connected_at: string | null
          last_status: string | null
          owner_user_id: string | null
          platform: string
          updated_at: string
          welcome_enabled: boolean
          welcome_message: string | null
        }
        Insert: {
          antiscam_enabled?: boolean
          automod_enabled?: boolean
          channel_id?: string | null
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          handle: string
          id?: string
          last_connected_at?: string | null
          last_status?: string | null
          owner_user_id?: string | null
          platform: string
          updated_at?: string
          welcome_enabled?: boolean
          welcome_message?: string | null
        }
        Update: {
          antiscam_enabled?: boolean
          automod_enabled?: boolean
          channel_id?: string | null
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          handle?: string
          id?: string
          last_connected_at?: string | null
          last_status?: string | null
          owner_user_id?: string | null
          platform?: string
          updated_at?: string
          welcome_enabled?: boolean
          welcome_message?: string | null
        }
        Relationships: []
      }
      chat_bot_commands: {
        Row: {
          channel_id: string
          cooldown_seconds: number
          created_at: string
          enabled: boolean
          id: string
          mods_only: boolean
          response: string
          trigger: string
          updated_at: string
          uses: number
        }
        Insert: {
          channel_id: string
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          id?: string
          mods_only?: boolean
          response: string
          trigger: string
          updated_at?: string
          uses?: number
        }
        Update: {
          channel_id?: string
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          id?: string
          mods_only?: boolean
          response?: string
          trigger?: string
          updated_at?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_bot_commands_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_bot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_bot_log: {
        Row: {
          action: string
          channel_id: string | null
          created_at: string
          id: string
          message: string | null
          platform: string
          reason: string | null
          viewer_id: string | null
          viewer_name: string | null
        }
        Insert: {
          action: string
          channel_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          platform: string
          reason?: string | null
          viewer_id?: string | null
          viewer_name?: string | null
        }
        Update: {
          action?: string
          channel_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          platform?: string
          reason?: string | null
          viewer_id?: string | null
          viewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_bot_log_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_bot_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          cleared_at_a: string | null
          cleared_at_b: string | null
          created_at: string
          hidden_at_a: string | null
          hidden_at_b: string | null
          id: string
          updated_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          cleared_at_a?: string | null
          cleared_at_b?: string | null
          created_at?: string
          hidden_at_a?: string | null
          hidden_at_b?: string | null
          id?: string
          updated_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          cleared_at_a?: string | null
          cleared_at_b?: string | null
          created_at?: string
          hidden_at_a?: string | null
          hidden_at_b?: string | null
          id?: string
          updated_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      discord_oauth_sessions: {
        Row: {
          created_at: string
          discord_user_id: string | null
          discord_username: string | null
          expires_at: string
          guilds: Json
          state: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          discord_user_id?: string | null
          discord_username?: string | null
          expires_at?: string
          guilds?: Json
          state: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          discord_user_id?: string | null
          discord_username?: string | null
          expires_at?: string
          guilds?: Json
          state?: string
          user_id?: string | null
        }
        Relationships: []
      }
      discord_servers: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          icon_url: string | null
          id: string
          invite_url: string
          is_active: boolean
          is_featured: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          invite_url: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          invite_url?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      forum_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          slug: string
          title: string
          updated_at: string
          user_id: string
          views: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          slug: string
          title: string
          updated_at?: string
          user_id: string
          views?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          slug?: string
          title?: string
          updated_at?: string
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      game_releases: {
        Row: {
          cover_url: string | null
          created_at: string
          fetched_at: string
          genres: string[]
          hype: number | null
          id: string
          igdb_id: number
          is_released: boolean
          name: string
          platforms: string[]
          release_date: string | null
          release_human: string | null
          slug: string | null
          summary: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          fetched_at?: string
          genres?: string[]
          hype?: number | null
          id?: string
          igdb_id: number
          is_released?: boolean
          name: string
          platforms?: string[]
          release_date?: string | null
          release_human?: string | null
          slug?: string | null
          summary?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          fetched_at?: string
          genres?: string[]
          hype?: number | null
          id?: string
          igdb_id?: number
          is_released?: boolean
          name?: string
          platforms?: string[]
          release_date?: string | null
          release_human?: string | null
          slug?: string | null
          summary?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      games: {
        Row: {
          connection_type: Database["public"]["Enums"]["server_connection_type"]
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          slug: string
          steam_appid: number | null
          updated_at: string
        }
        Insert: {
          connection_type?: Database["public"]["Enums"]["server_connection_type"]
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          slug: string
          steam_appid?: number | null
          updated_at?: string
        }
        Update: {
          connection_type?: Database["public"]["Enums"]["server_connection_type"]
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          slug?: string
          steam_appid?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      live_streams_cache: {
        Row: {
          checked_at: string
          game_name: string | null
          handle: string
          id: string
          is_live: boolean
          platform: string
          scheduled_start_at: string | null
          started_at: string | null
          stream_url: string
          thumbnail_url: string | null
          title: string | null
          user_id: string
          viewer_count: number | null
        }
        Insert: {
          checked_at?: string
          game_name?: string | null
          handle: string
          id?: string
          is_live?: boolean
          platform: string
          scheduled_start_at?: string | null
          started_at?: string | null
          stream_url: string
          thumbnail_url?: string | null
          title?: string | null
          user_id: string
          viewer_count?: number | null
        }
        Update: {
          checked_at?: string
          game_name?: string | null
          handle?: string
          id?: string
          is_live?: boolean
          platform?: string
          scheduled_start_at?: string | null
          started_at?: string | null
          stream_url?: string
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string
          viewer_count?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_log: {
        Row: {
          action: string
          created_at: string
          id: string
          original: string
          reason: string | null
          result: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          original: string
          reason?: string | null
          result?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          original?: string
          reason?: string | null
          result?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_models: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          license: string
          name: string
          source_url: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          license?: string
          name: string
          source_url: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          license?: string
          name?: string
          source_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string | null
          description: string | null
          id: string
          is_public_request: boolean
          model_id: string | null
          notes: string | null
          notify_preference: string | null
          phone: string | null
          price: number | null
          product_size: string | null
          product_url: string | null
          status: Database["public"]["Enums"]["order_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          is_public_request?: boolean
          model_id?: string | null
          notes?: string | null
          notify_preference?: string | null
          phone?: string | null
          price?: number | null
          product_size?: string | null
          product_url?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          is_public_request?: boolean
          model_id?: string | null
          notes?: string | null
          notify_preference?: string | null
          phone?: string | null
          price?: number | null
          product_size?: string | null
          product_url?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          created_at: string
          created_by: string | null
          draft_blocks: Json
          id: string
          is_published: boolean
          is_system: boolean
          nav_label: string | null
          nav_position: number
          published_at: string | null
          published_blocks: Json
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draft_blocks?: Json
          id?: string
          is_published?: boolean
          is_system?: boolean
          nav_label?: string | null
          nav_position?: number
          published_at?: string | null
          published_blocks?: Json
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draft_blocks?: Json
          id?: string
          is_published?: boolean
          is_system?: boolean
          nav_label?: string | null
          nav_position?: number
          published_at?: string | null
          published_blocks?: Json
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          label: string
          module: string
          position: number
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          module: string
          position?: number
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          module?: string
          position?: number
        }
        Relationships: []
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          kick_username: string | null
          last_seen_at: string | null
          notify_browser: boolean
          notify_sound: boolean
          twitch_username: string | null
          updated_at: string
          user_id: string
          username: string | null
          youtube_handle: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          kick_username?: string | null
          last_seen_at?: string | null
          notify_browser?: boolean
          notify_sound?: boolean
          twitch_username?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          youtube_handle?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          kick_username?: string | null
          last_seen_at?: string | null
          notify_browser?: boolean
          notify_sound?: boolean
          twitch_username?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          youtube_handle?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_builtin: boolean
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      servers: {
        Row: {
          created_at: string
          description: string | null
          discord_url: string | null
          game_id: string
          id: string
          invite_code: string | null
          ip: string | null
          is_approved: boolean
          is_featured: boolean
          is_online: boolean
          last_pinged_at: string | null
          name: string
          owner_id: string
          players_max: number | null
          players_online: number | null
          port: number | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discord_url?: string | null
          game_id: string
          id?: string
          invite_code?: string | null
          ip?: string | null
          is_approved?: boolean
          is_featured?: boolean
          is_online?: boolean
          last_pinged_at?: string | null
          name: string
          owner_id: string
          players_max?: number | null
          players_online?: number | null
          port?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discord_url?: string | null
          game_id?: string
          id?: string
          invite_code?: string | null
          ip?: string | null
          is_approved?: boolean
          is_featured?: boolean
          is_online?: boolean
          last_pinged_at?: string | null
          name?: string
          owner_id?: string
          players_max?: number | null
          players_online?: number | null
          port?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      site_announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          link_label: string | null
          link_url: string | null
          sort_order: number
          starts_at: string | null
          title: string | null
          updated_at: string
          variant: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string
          variant?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          contact_address: string | null
          contact_full_name: string | null
          contact_ico: string | null
          contact_phone_dial_code: string | null
          contact_phone_number: string | null
          contact_registration: string | null
          contact_section_title: string | null
          contact_zip: string | null
          favicon_url: string | null
          footer_text: string | null
          hero_badge: string | null
          hero_cta_label: string | null
          hero_subtitle: string | null
          hero_title_1: string | null
          hero_title_2: string | null
          id: string
          is_singleton: boolean
          logo_url: string | null
          site_name: string
          site_tagline: string | null
          updated_at: string
          updated_by: string | null
          web_tickets_category_id: string | null
          web_tickets_guild_id: string | null
          web_tickets_notify_channel_id: string | null
        }
        Insert: {
          contact_address?: string | null
          contact_full_name?: string | null
          contact_ico?: string | null
          contact_phone_dial_code?: string | null
          contact_phone_number?: string | null
          contact_registration?: string | null
          contact_section_title?: string | null
          contact_zip?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          hero_badge?: string | null
          hero_cta_label?: string | null
          hero_subtitle?: string | null
          hero_title_1?: string | null
          hero_title_2?: string | null
          id?: string
          is_singleton?: boolean
          logo_url?: string | null
          site_name?: string
          site_tagline?: string | null
          updated_at?: string
          updated_by?: string | null
          web_tickets_category_id?: string | null
          web_tickets_guild_id?: string | null
          web_tickets_notify_channel_id?: string | null
        }
        Update: {
          contact_address?: string | null
          contact_full_name?: string | null
          contact_ico?: string | null
          contact_phone_dial_code?: string | null
          contact_phone_number?: string | null
          contact_registration?: string | null
          contact_section_title?: string | null
          contact_zip?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          hero_badge?: string | null
          hero_cta_label?: string | null
          hero_subtitle?: string | null
          hero_title_1?: string | null
          hero_title_2?: string | null
          id?: string
          is_singleton?: boolean
          logo_url?: string | null
          site_name?: string
          site_tagline?: string | null
          updated_at?: string
          updated_by?: string | null
          web_tickets_category_id?: string | null
          web_tickets_guild_id?: string | null
          web_tickets_notify_channel_id?: string | null
        }
        Relationships: []
      }
      streamer_overrides: {
        Row: {
          created_at: string
          id: string
          is_included: boolean
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_included?: boolean
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_included?: boolean
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      ticket_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string
          discord_channel_id: string | null
          discord_message_id: string | null
          guild_id: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          source: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description: string
          discord_channel_id?: string | null
          discord_message_id?: string | null
          guild_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          source?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string
          discord_channel_id?: string | null
          discord_message_id?: string | null
          guild_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          source?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_discord_links: {
        Row: {
          created_at: string
          discord_user_id: string
          discord_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discord_user_id: string
          discord_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discord_user_id?: string
          discord_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_restrictions: {
        Row: {
          banned_until: string | null
          can_comment: boolean
          can_message: boolean
          can_post_forum: boolean
          can_upload: boolean
          created_at: string
          muted_until: string | null
          reason: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          banned_until?: string | null
          can_comment?: boolean
          can_message?: boolean
          can_post_forum?: boolean
          can_upload?: boolean
          created_at?: string
          muted_until?: string | null
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          banned_until?: string | null
          can_comment?: boolean
          can_message?: boolean
          can_post_forum?: boolean
          can_upload?: boolean
          created_at?: string
          muted_until?: string | null
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      site_settings_public: {
        Row: {
          favicon_url: string | null
          footer_text: string | null
          hero_badge: string | null
          hero_cta_label: string | null
          hero_subtitle: string | null
          hero_title_1: string | null
          hero_title_2: string | null
          id: string | null
          logo_url: string | null
          site_name: string | null
          site_tagline: string | null
          updated_at: string | null
        }
        Insert: {
          favicon_url?: string | null
          footer_text?: string | null
          hero_badge?: string | null
          hero_cta_label?: string | null
          hero_subtitle?: string | null
          hero_title_1?: string | null
          hero_title_2?: string | null
          id?: string | null
          logo_url?: string | null
          site_name?: string | null
          site_tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          favicon_url?: string | null
          footer_text?: string | null
          hero_badge?: string | null
          hero_cta_label?: string | null
          hero_subtitle?: string | null
          hero_title_1?: string | null
          hero_title_2?: string | null
          id?: string | null
          logo_url?: string | null
          site_name?: string | null
          site_tagline?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can: { Args: { _action: string; _module: string }; Returns: boolean }
      clear_conversation_for_me: {
        Args: { _conv_id: string }
        Returns: undefined
      }
      current_user_discord_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      discord_id_for_user: { Args: { _user_id: string }; Returns: string }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_featured_streamers: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_my_notification_prefs: {
        Args: never
        Returns: {
          notify_browser: boolean
          notify_sound: boolean
        }[]
      }
      get_or_create_conversation: {
        Args: { _other_user: string }
        Returns: string
      }
      get_page_draft_blocks: { Args: { _slug: string }; Returns: Json }
      get_public_site_settings: {
        Args: never
        Returns: {
          contact_address: string
          contact_full_name: string
          contact_ico: string
          contact_phone_dial_code: string
          contact_phone_number: string
          contact_registration: string
          contact_section_title: string
          contact_zip: string
          favicon_url: string
          footer_text: string
          hero_badge: string
          hero_cta_label: string
          hero_subtitle: string
          hero_title_1: string
          hero_title_2: string
          id: string
          logo_url: string
          site_name: string
          site_tagline: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hide_conversation_for_me: {
        Args: { _conv_id: string }
        Returns: undefined
      }
      is_guild_manager: {
        Args: { _guild_id: string; _user_id: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: number
      }
      mark_message_read: { Args: { _message_id: string }; Returns: undefined }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      user_can_do: { Args: { _capability: string }; Returns: boolean }
      user_has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "user" | "banned" | "content_creator"
      bot_guild_status: "pending" | "approved" | "rejected" | "suspended"
      order_status: "paid" | "done" | "processing" | "cancelled" | "paused"
      server_connection_type: "ip_port" | "invite_code"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "user", "banned", "content_creator"],
      bot_guild_status: ["pending", "approved", "rejected", "suspended"],
      order_status: ["paid", "done", "processing", "cancelled", "paused"],
      server_connection_type: ["ip_port", "invite_code"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
