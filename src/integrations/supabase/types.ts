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
      abuse_events: {
        Row: {
          action: string
          created_at: string
          delete_after: string | null
          deleted_at: string | null
          id: string
          reasons: Json
          risk_score: number
          severity: string
          source: string
          subject_snapshot: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          delete_after?: string | null
          deleted_at?: string | null
          id?: string
          reasons?: Json
          risk_score: number
          severity: string
          source?: string
          subject_snapshot?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          delete_after?: string | null
          deleted_at?: string | null
          id?: string
          reasons?: Json
          risk_score?: number
          severity?: string
          source?: string
          subject_snapshot?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          model: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_access_ips: {
        Row: {
          code_id: string | null
          created_at: string
          id: string
          ip: string
          last_seen_at: string
          user_id: string | null
        }
        Insert: {
          code_id?: string | null
          created_at?: string
          id?: string
          ip: string
          last_seen_at?: string
          user_id?: string | null
        }
        Update: {
          code_id?: string | null
          created_at?: string
          id?: string
          ip?: string
          last_seen_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_access_ips_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "download_access_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      ashes_access: {
        Row: {
          created_at: string
          granted_by: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ashes_changelog: {
        Row: {
          created_at: string
          id: string
          image: string | null
          kind: string
          published_at: string
          text_cs: string
          text_en: string | null
          title_cs: string
          title_en: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image?: string | null
          kind?: string
          published_at?: string
          text_cs?: string
          text_en?: string | null
          title_cs: string
          title_en?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image?: string | null
          kind?: string
          published_at?: string
          text_cs?: string
          text_en?: string | null
          title_cs?: string
          title_en?: string | null
        }
        Relationships: []
      }
      ashes_character_slots: {
        Row: {
          appearance: Json
          class: string
          data: Json
          faction: string
          id: string
          items: Json
          level: number
          name: string
          quests: Json
          saved_at: string
          user_id: string
          wquests: Json
        }
        Insert: {
          appearance?: Json
          class: string
          data: Json
          faction?: string
          id?: string
          items?: Json
          level?: number
          name: string
          quests?: Json
          saved_at?: string
          user_id: string
          wquests?: Json
        }
        Update: {
          appearance?: Json
          class?: string
          data?: Json
          faction?: string
          id?: string
          items?: Json
          level?: number
          name?: string
          quests?: Json
          saved_at?: string
          user_id?: string
          wquests?: Json
        }
        Relationships: []
      }
      ashes_characters: {
        Row: {
          appearance: Json
          arena_ready_at: string
          boss_ready_at: string
          chapter: number
          chapter_progress: number
          class: string
          courage: number
          courage_day: string
          created_at: string
          daily_gift_day: string | null
          faction: string
          gold: number
          honor: number
          intelekt: number
          is_azkar: boolean
          is_eryon: boolean
          last_seen: string
          last_world_fight_at: string
          level: number
          losses: number
          name: string
          obratnost: number
          shop_at: string | null
          shop_day: string | null
          shop_level: number | null
          sila: number
          stesti: number
          user_id: string
          vydrz: number
          wins: number
          xp: number
        }
        Insert: {
          appearance?: Json
          arena_ready_at?: string
          boss_ready_at?: string
          chapter?: number
          chapter_progress?: number
          class: string
          courage?: number
          courage_day?: string
          created_at?: string
          daily_gift_day?: string | null
          faction?: string
          gold?: number
          honor?: number
          intelekt?: number
          is_azkar?: boolean
          is_eryon?: boolean
          last_seen?: string
          last_world_fight_at?: string
          level?: number
          losses?: number
          name: string
          obratnost?: number
          shop_at?: string | null
          shop_day?: string | null
          shop_level?: number | null
          sila?: number
          stesti?: number
          user_id: string
          vydrz?: number
          wins?: number
          xp?: number
        }
        Update: {
          appearance?: Json
          arena_ready_at?: string
          boss_ready_at?: string
          chapter?: number
          chapter_progress?: number
          class?: string
          courage?: number
          courage_day?: string
          created_at?: string
          daily_gift_day?: string | null
          faction?: string
          gold?: number
          honor?: number
          intelekt?: number
          is_azkar?: boolean
          is_eryon?: boolean
          last_seen?: string
          last_world_fight_at?: string
          level?: number
          losses?: number
          name?: string
          obratnost?: number
          shop_at?: string | null
          shop_day?: string | null
          shop_level?: number | null
          sila?: number
          stesti?: number
          user_id?: string
          vydrz?: number
          wins?: number
          xp?: number
        }
        Relationships: []
      }
      ashes_chat: {
        Row: {
          channel: string
          created_at: string
          id: number
          name: string
          tag: string
          text: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: number
          name: string
          tag?: string
          text: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: number
          name?: string
          tag?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      ashes_chronicle: {
        Row: {
          created_at: string
          id: number
          kind: string
          text: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          text: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          text?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ashes_crash_reports: {
        Row: {
          created_at: string
          gpu: string | null
          id: number
          log: string | null
          user_id: string
          version: string | null
        }
        Insert: {
          created_at?: string
          gpu?: string | null
          id?: number
          log?: string | null
          user_id?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          gpu?: string | null
          id?: number
          log?: string | null
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      ashes_feedback: {
        Row: {
          character_name: string | null
          context: Json
          created_at: string
          id: number
          kind: string
          resolved: boolean
          text: string
          user_id: string
        }
        Insert: {
          character_name?: string | null
          context?: Json
          created_at?: string
          id?: never
          kind?: string
          resolved?: boolean
          text: string
          user_id: string
        }
        Update: {
          character_name?: string | null
          context?: Json
          created_at?: string
          id?: never
          kind?: string
          resolved?: boolean
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      ashes_items: {
        Row: {
          armor: number
          created_at: string
          equipped: boolean
          id: string
          in_shop: boolean
          intelekt: number
          level: number
          name: string
          obratnost: number
          price: number
          rarity: number
          sila: number
          slot: string
          stesti: number
          user_id: string
          vydrz: number
          wmax: number
          wmin: number
        }
        Insert: {
          armor?: number
          created_at?: string
          equipped?: boolean
          id?: string
          in_shop?: boolean
          intelekt?: number
          level?: number
          name: string
          obratnost?: number
          price?: number
          rarity?: number
          sila?: number
          slot: string
          stesti?: number
          user_id: string
          vydrz?: number
          wmax?: number
          wmin?: number
        }
        Update: {
          armor?: number
          created_at?: string
          equipped?: boolean
          id?: string
          in_shop?: boolean
          intelekt?: number
          level?: number
          name?: string
          obratnost?: number
          price?: number
          rarity?: number
          sila?: number
          slot?: string
          stesti?: number
          user_id?: string
          vydrz?: number
          wmax?: number
          wmin?: number
        }
        Relationships: []
      }
      ashes_live_fights: {
        Row: {
          calls: number
          defenses: Json
          e: Json
          enemy_id: string
          finished_at: string | null
          hp_e: number
          hp_p: number
          id: string
          last_attack_at: string | null
          last_dodge_at: string | null
          last_skill_at: string | null
          lvl: number
          max_e: number
          max_p: number
          next_swing_at: string
          p: Json
          region: string
          result: Json | null
          started_at: string
          status: string
          swing_index: number
          swing_ms: number
          user_id: string
        }
        Insert: {
          calls?: number
          defenses?: Json
          e: Json
          enemy_id: string
          finished_at?: string | null
          hp_e: number
          hp_p: number
          id?: string
          last_attack_at?: string | null
          last_dodge_at?: string | null
          last_skill_at?: string | null
          lvl: number
          max_e: number
          max_p: number
          next_swing_at: string
          p: Json
          region: string
          result?: Json | null
          started_at?: string
          status?: string
          swing_index?: number
          swing_ms: number
          user_id: string
        }
        Update: {
          calls?: number
          defenses?: Json
          e?: Json
          enemy_id?: string
          finished_at?: string | null
          hp_e?: number
          hp_p?: number
          id?: string
          last_attack_at?: string | null
          last_dodge_at?: string | null
          last_skill_at?: string | null
          lvl?: number
          max_e?: number
          max_p?: number
          next_swing_at?: string
          p?: Json
          region?: string
          result?: Json | null
          started_at?: string
          status?: string
          swing_index?: number
          swing_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      ashes_oddil: {
        Row: {
          created_at: string
          faction: string
          id: string
          leader: string
          motto: string
          name: string
          tag: string
        }
        Insert: {
          created_at?: string
          faction: string
          id?: string
          leader: string
          motto?: string
          name: string
          tag: string
        }
        Update: {
          created_at?: string
          faction?: string
          id?: string
          leader?: string
          motto?: string
          name?: string
          tag?: string
        }
        Relationships: []
      }
      ashes_oddil_invites: {
        Row: {
          created_at: string
          invited_by: string
          oddil_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by: string
          oddil_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string
          oddil_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ashes_oddil_invites_oddil_id_fkey"
            columns: ["oddil_id"]
            isOneToOne: false
            referencedRelation: "ashes_oddil"
            referencedColumns: ["id"]
          },
        ]
      }
      ashes_oddil_members: {
        Row: {
          joined_at: string
          oddil_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          oddil_id: string
          role?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          oddil_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ashes_oddil_members_oddil_id_fkey"
            columns: ["oddil_id"]
            isOneToOne: false
            referencedRelation: "ashes_oddil"
            referencedColumns: ["id"]
          },
        ]
      }
      ashes_quests: {
        Row: {
          chapter: number
          created_at: string
          ends_at: string | null
          enemy: Json
          gold: number
          id: string
          item_chance: number
          minutes: number
          started_at: string | null
          state: string
          story: string
          title: string
          user_id: string
          xp: number
        }
        Insert: {
          chapter: number
          created_at?: string
          ends_at?: string | null
          enemy: Json
          gold: number
          id?: string
          item_chance?: number
          minutes: number
          started_at?: string | null
          state?: string
          story: string
          title: string
          user_id: string
          xp: number
        }
        Update: {
          chapter?: number
          created_at?: string
          ends_at?: string | null
          enemy?: Json
          gold?: number
          id?: string
          item_chance?: number
          minutes?: number
          started_at?: string | null
          state?: string
          story?: string
          title?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      ashes_races: {
        Row: {
          best_ms: number | null
          day: string | null
          runs_today: number
          started_at: string | null
          user_id: string
        }
        Insert: {
          best_ms?: number | null
          day?: string | null
          runs_today?: number
          started_at?: string | null
          user_id: string
        }
        Update: {
          best_ms?: number | null
          day?: string | null
          runs_today?: number
          started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ashes_rate: {
        Row: {
          calls: number
          user_id: string
          win_start: string
        }
        Insert: {
          calls?: number
          user_id: string
          win_start?: string
        }
        Update: {
          calls?: number
          user_id?: string
          win_start?: string
        }
        Relationships: []
      }
      ashes_roadmap: {
        Row: {
          act: string | null
          id: string
          items: Json
          sort: number
          starts_at: string | null
          status: string
          text_cs: string
          text_en: string
          title_cs: string
          title_en: string
          updated_at: string
          when_cs: string
          when_en: string
        }
        Insert: {
          act?: string | null
          id?: string
          items?: Json
          sort?: number
          starts_at?: string | null
          status?: string
          text_cs?: string
          text_en?: string
          title_cs?: string
          title_en?: string
          updated_at?: string
          when_cs?: string
          when_en?: string
        }
        Update: {
          act?: string | null
          id?: string
          items?: Json
          sort?: number
          starts_at?: string | null
          status?: string
          text_cs?: string
          text_en?: string
          title_cs?: string
          title_en?: string
          updated_at?: string
          when_cs?: string
          when_en?: string
        }
        Relationships: []
      }
      ashes_world: {
        Row: {
          arena_cooldown_s: number
          azkar_shout: string | null
          azkar_shout_at: string | null
          boss_cooldown_s: number
          eryon_shout: string | null
          eryon_shout_at: string | null
          id: number
          open_to_all: boolean
          quest_minutes_max: number
          quest_minutes_min: number
          wall_points: number
          wall_updated_at: string
        }
        Insert: {
          arena_cooldown_s?: number
          azkar_shout?: string | null
          azkar_shout_at?: string | null
          boss_cooldown_s?: number
          eryon_shout?: string | null
          eryon_shout_at?: string | null
          id?: number
          open_to_all?: boolean
          quest_minutes_max?: number
          quest_minutes_min?: number
          wall_points?: number
          wall_updated_at?: string
        }
        Update: {
          arena_cooldown_s?: number
          azkar_shout?: string | null
          azkar_shout_at?: string | null
          boss_cooldown_s?: number
          eryon_shout?: string | null
          eryon_shout_at?: string | null
          id?: number
          open_to_all?: boolean
          quest_minutes_max?: number
          quest_minutes_min?: number
          wall_points?: number
          wall_updated_at?: string
        }
        Relationships: []
      }
      ashes_world_boss: {
        Row: {
          cls: string
          generation: number
          hp: number
          hp_max: number
          id: number
          killed_at: string | null
          killer: string | null
          name: string
          spawned_at: string
        }
        Insert: {
          cls?: string
          generation?: number
          hp?: number
          hp_max?: number
          id?: number
          killed_at?: string | null
          killer?: string | null
          name?: string
          spawned_at?: string
        }
        Update: {
          cls?: string
          generation?: number
          hp?: number
          hp_max?: number
          id?: number
          killed_at?: string | null
          killer?: string | null
          name?: string
          spawned_at?: string
        }
        Relationships: []
      }
      ashes_world_boss_hits: {
        Row: {
          damage: number
          generation: number
          hits: number
          name: string | null
          user_id: string
        }
        Insert: {
          damage?: number
          generation: number
          hits?: number
          name?: string | null
          user_id: string
        }
        Update: {
          damage?: number
          generation?: number
          hits?: number
          name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ashes_wquests: {
        Row: {
          created_at: string
          progress: number
          quest_id: string
          state: string
          targets: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          progress?: number
          quest_id: string
          state?: string
          targets?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          progress?: number
          quest_id?: string
          state?: string
          targets?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          antiscam_allow_invites: boolean
          antiscam_allowed_domains: string[]
          antiscam_blocked_domains: string[]
          antiscam_enabled: boolean
          antiscam_sensitivity: string
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
          antiscam_allow_invites?: boolean
          antiscam_allowed_domains?: string[]
          antiscam_blocked_domains?: string[]
          antiscam_enabled?: boolean
          antiscam_sensitivity?: string
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
          antiscam_allow_invites?: boolean
          antiscam_allowed_domains?: string[]
          antiscam_blocked_domains?: string[]
          antiscam_enabled?: boolean
          antiscam_sensitivity?: string
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
          antiscam_allow_invites: boolean
          antiscam_allowed_domains: string[]
          antiscam_blocked_domains: string[]
          antiscam_enabled: boolean
          antiscam_sensitivity: string
          auto_verify: boolean
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
          unverified_role_id: string | null
          updated_at: string
          updated_by: string | null
          verified_role_id: string | null
        }
        Insert: {
          antiscam_allow_invites?: boolean
          antiscam_allowed_domains?: string[]
          antiscam_blocked_domains?: string[]
          antiscam_enabled?: boolean
          antiscam_sensitivity?: string
          auto_verify?: boolean
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
          unverified_role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          verified_role_id?: string | null
        }
        Update: {
          antiscam_allow_invites?: boolean
          antiscam_allowed_domains?: string[]
          antiscam_blocked_domains?: string[]
          antiscam_enabled?: boolean
          antiscam_sensitivity?: string
          auto_verify?: boolean
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
          unverified_role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          verified_role_id?: string | null
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
          owner_discord_id: string | null
          owner_user_id: string | null
          requested_at: string
          reviewed_at: string | null
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
          owner_discord_id?: string | null
          owner_user_id?: string | null
          requested_at?: string
          reviewed_at?: string | null
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
          owner_discord_id?: string | null
          owner_user_id?: string | null
          requested_at?: string
          reviewed_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["bot_guild_status"]
          updated_at?: string
        }
        Relationships: []
      }
      bot_guilds_review: {
        Row: {
          guild_row_id: string
          notes: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          guild_row_id: string
          notes?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          guild_row_id?: string
          notes?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_guilds_review_guild_row_id_fkey"
            columns: ["guild_row_id"]
            isOneToOne: true
            referencedRelation: "bot_guilds"
            referencedColumns: ["id"]
          },
        ]
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
      bot_moderation_events: {
        Row: {
          channel_id: string | null
          content: string | null
          created_at: string
          guild_id: string
          id: number
          level: string
          moderator: string | null
          reasons: string[]
          resolution: string | null
          resolved_at: string | null
          score: number | null
          source: string
          user_id: string
          user_tag: string | null
        }
        Insert: {
          channel_id?: string | null
          content?: string | null
          created_at?: string
          guild_id: string
          id?: never
          level: string
          moderator?: string | null
          reasons?: string[]
          resolution?: string | null
          resolved_at?: string | null
          score?: number | null
          source?: string
          user_id: string
          user_tag?: string | null
        }
        Update: {
          channel_id?: string | null
          content?: string | null
          created_at?: string
          guild_id?: string
          id?: never
          level?: string
          moderator?: string | null
          reasons?: string[]
          resolution?: string | null
          resolved_at?: string | null
          score?: number | null
          source?: string
          user_id?: string
          user_tag?: string | null
        }
        Relationships: []
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
      bounties: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: string
          id: string
          reward_cosmetic_id: string | null
          reward_label: string
          slots: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string
          id?: string
          reward_cosmetic_id?: string | null
          reward_label?: string
          slots?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string
          id?: string
          reward_cosmetic_id?: string | null
          reward_label?: string
          slots?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bounty_contracts: {
        Row: {
          accepted_at: string
          bounty_id: string
          completed_at: string | null
          id: string
          note: string | null
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          bounty_id: string
          completed_at?: string | null
          id?: string
          note?: string | null
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          bounty_id?: string
          completed_at?: string | null
          id?: string
          note?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_contracts_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
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
      cosmetic_styles: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string
          name: string
          scale: number
          sort_order: number
          storage_path: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id: string
          image_url: string
          name: string
          scale?: number
          sort_order?: number
          storage_path?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string
          name?: string
          scale?: number
          sort_order?: number
          storage_path?: string | null
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
      download_access_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          max_uses: number | null
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_uses?: number | null
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_uses?: number | null
          uses?: number
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
      form_fields: {
        Row: {
          created_at: string
          description: string | null
          form_id: string
          id: string
          label: string
          options: Json
          position: number
          required: boolean
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          form_id: string
          id?: string
          label: string
          options?: Json
          position?: number
          required?: boolean
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          form_id?: string
          id?: string
          label?: string
          options?: Json
          position?: number
          required?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          answers: Json
          form_id: string
          id: string
          respondent_id: string | null
          submitted_at: string
        }
        Insert: {
          answers?: Json
          form_id: string
          id?: string
          respondent_id?: string | null
          submitted_at?: string
        }
        Update: {
          answers?: Json
          form_id?: string
          id?: string
          respondent_id?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          accent_color: string | null
          allow_anonymous: boolean
          cover_emoji: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          owner_id: string
          slug: string
          success_message: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          allow_anonymous?: boolean
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          owner_id: string
          slug: string
          success_message?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          allow_anonymous?: boolean
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          owner_id?: string
          slug?: string
          success_message?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      forum_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          position: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
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
      games: {
        Row: {
          color_tag: string
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
          color_tag?: string
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
          color_tag?: string
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
      launcher_auth_codes: {
        Row: {
          challenge: string
          code_hash: string
          created_at: string
          device: string | null
          expires_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          challenge: string
          code_hash: string
          created_at?: string
          device?: string | null
          expires_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          challenge?: string
          code_hash?: string
          created_at?: string
          device?: string | null
          expires_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      launcher_sessions_log: {
        Row: {
          created_at: string
          device: string | null
          event: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          device?: string | null
          event: string
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string
          device?: string | null
          event?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      lfg_requests: {
        Row: {
          created_at: string
          expires_at: string
          game_id: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          game_id: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          game_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lfg_requests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
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
      security_blocked_email_domains: {
        Row: {
          created_at: string
          domain: string
          enabled: boolean
          reason: string
        }
        Insert: {
          created_at?: string
          domain: string
          enabled?: boolean
          reason?: string
        }
        Update: {
          created_at?: string
          domain?: string
          enabled?: boolean
          reason?: string
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
      shop_entitlements: {
        Row: {
          created_at: string
          download_count: number
          expires_at: string
          first_download_at: string | null
          id: string
          item_id: string
          purchase_id: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          expires_at: string
          first_download_at?: string | null
          id?: string
          item_id: string
          purchase_id?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          download_count?: number
          expires_at?: string
          first_download_at?: string | null
          id?: string
          item_id?: string
          purchase_id?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_entitlements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_entitlements_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "shop_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_items: {
        Row: {
          access_minutes: number | null
          active: boolean
          cosmetic_id: string | null
          created_at: string
          description: string | null
          features: string[]
          file_name: string | null
          file_parts: string[]
          file_sha256: string | null
          file_size: number | null
          file_uploaded_at: string | null
          file_version: string | null
          id: string
          image_url: string | null
          kind: string
          price_czk: number
          price_year_czk: number | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          access_minutes?: number | null
          active?: boolean
          cosmetic_id?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          file_name?: string | null
          file_parts?: string[]
          file_sha256?: string | null
          file_size?: number | null
          file_uploaded_at?: string | null
          file_version?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          price_czk?: number
          price_year_czk?: number | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          access_minutes?: number | null
          active?: boolean
          cosmetic_id?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          file_name?: string | null
          file_parts?: string[]
          file_sha256?: string | null
          file_size?: number | null
          file_uploaded_at?: string | null
          file_version?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          price_czk?: number
          price_year_czk?: number | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      shop_purchases: {
        Row: {
          amount_czk: number
          auto_renew: boolean
          contact: string | null
          cosmetic_id: string | null
          created_at: string
          currency: string
          fulfilled: boolean
          id: string
          item_id: string | null
          kind: string
          note: string | null
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          period: string | null
          refund_reason: string | null
          refund_requested_at: string | null
          refunded_at: string | null
          renewal: boolean
          requires_manual: boolean
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          title: string
          updated_at: string
          user_id: string | null
          waiver_accepted_at: string | null
        }
        Insert: {
          amount_czk?: number
          auto_renew?: boolean
          contact?: string | null
          cosmetic_id?: string | null
          created_at?: string
          currency?: string
          fulfilled?: boolean
          id?: string
          item_id?: string | null
          kind?: string
          note?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period?: string | null
          refund_reason?: string | null
          refund_requested_at?: string | null
          refunded_at?: string | null
          renewal?: boolean
          requires_manual?: boolean
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
          waiver_accepted_at?: string | null
        }
        Update: {
          amount_czk?: number
          auto_renew?: boolean
          contact?: string | null
          cosmetic_id?: string | null
          created_at?: string
          currency?: string
          fulfilled?: boolean
          id?: string
          item_id?: string | null
          kind?: string
          note?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period?: string | null
          refund_reason?: string | null
          refund_requested_at?: string | null
          refunded_at?: string | null
          renewal?: boolean
          requires_manual?: boolean
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          waiver_accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_purchases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_settings: {
        Row: {
          account_number: string | null
          bank_recipient: string | null
          donate_max: number
          donate_min: number
          iban: string | null
          id: string
          paypal_email: string | null
          paypal_me: string | null
          refund_notice: string | null
          stripe_enabled: boolean
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_recipient?: string | null
          donate_max?: number
          donate_min?: number
          iban?: string | null
          id?: string
          paypal_email?: string | null
          paypal_me?: string | null
          refund_notice?: string | null
          stripe_enabled?: boolean
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_recipient?: string | null
          donate_max?: number
          donate_min?: number
          iban?: string | null
          id?: string
          paypal_email?: string | null
          paypal_me?: string | null
          refund_notice?: string | null
          stripe_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      shop_subscriptions: {
        Row: {
          auto_renew: boolean
          item_id: string
          period: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          item_id: string
          period?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          item_id?: string
          period?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_subscriptions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
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
      user_cosmetics: {
        Row: {
          cosmetic_id: string
          created_at: string
          equipped: boolean
          id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cosmetic_id: string
          created_at?: string
          equipped?: boolean
          id?: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cosmetic_id?: string
          created_at?: string
          equipped?: boolean
          id?: string
          quantity?: number
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
      user_games: {
        Row: {
          created_at: string
          game_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
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
      vox_categories: {
        Row: {
          created_at: string
          emoji: string | null
          guild_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          guild_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          emoji?: string | null
          guild_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "vox_categories_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_channels: {
        Row: {
          category: string | null
          created_at: string
          emoji: string | null
          guild_id: string
          id: string
          name: string
          position: number
          topic: string | null
          type: Database["public"]["Enums"]["vox_channel_type"]
        }
        Insert: {
          category?: string | null
          created_at?: string
          emoji?: string | null
          guild_id: string
          id?: string
          name: string
          position?: number
          topic?: string | null
          type?: Database["public"]["Enums"]["vox_channel_type"]
        }
        Update: {
          category?: string | null
          created_at?: string
          emoji?: string | null
          guild_id?: string
          id?: string
          name?: string
          position?: number
          topic?: string | null
          type?: Database["public"]["Enums"]["vox_channel_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vox_channels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_event_attendees: {
        Row: {
          created_at: string
          event_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "vox_events"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_events: {
        Row: {
          capacity: number | null
          channel_id: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          guild_id: string
          id: string
          location: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          channel_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          guild_id: string
          id?: string
          location?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          channel_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          guild_id?: string
          id?: string
          location?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "vox_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vox_events_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_guild_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          guild_id: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          guild_id: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          guild_id?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_guild_bans_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_guild_members: {
        Row: {
          guild_id: string
          joined_at: string
          muted_until: string | null
          nickname: string | null
          role: Database["public"]["Enums"]["vox_member_role"]
          user_id: string
        }
        Insert: {
          guild_id: string
          joined_at?: string
          muted_until?: string | null
          nickname?: string | null
          role?: Database["public"]["Enums"]["vox_member_role"]
          user_id: string
        }
        Update: {
          guild_id?: string
          joined_at?: string
          muted_until?: string | null
          nickname?: string | null
          role?: Database["public"]["Enums"]["vox_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_guild_members_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_guilds: {
        Row: {
          cosmetic_id: string | null
          created_at: string
          icon_url: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          cosmetic_id?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          invite_code?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          cosmetic_id?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      vox_member_roles: {
        Row: {
          assigned_at: string
          guild_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          guild_id: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          guild_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_member_roles_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vox_member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "vox_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_message_pins: {
        Row: {
          channel_id: string
          created_at: string
          guild_id: string
          message_id: string
          pinned_by: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          guild_id: string
          message_id: string
          pinned_by?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          guild_id?: string
          message_id?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_message_pins_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "vox_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vox_message_pins_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vox_message_pins_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "vox_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_message_reactions: {
        Row: {
          channel_id: string
          created_at: string
          emoji: string
          guild_id: string
          message_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          emoji: string
          guild_id: string
          message_id: string
          user_id?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          emoji?: string
          guild_id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_message_reactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "vox_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vox_message_reactions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vox_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "vox_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_messages: {
        Row: {
          attachments: Json
          author_id: string
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          channel_id: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "vox_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          guild_id: string | null
          id: string
          is_read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          guild_id?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          guild_id?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_notifications_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_presence: {
        Row: {
          custom_status: string | null
          last_seen: string
          status: Database["public"]["Enums"]["vox_presence_status"]
          user_id: string
        }
        Insert: {
          custom_status?: string | null
          last_seen?: string
          status?: Database["public"]["Enums"]["vox_presence_status"]
          user_id: string
        }
        Update: {
          custom_status?: string | null
          last_seen?: string
          status?: Database["public"]["Enums"]["vox_presence_status"]
          user_id?: string
        }
        Relationships: []
      }
      vox_protect_build_policies: {
        Row: {
          active: boolean
          app_version: string
          created_at: string
          enforcement: string
          id: string
          integrity_hash: string
          platform: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          app_version: string
          created_at?: string
          enforcement?: string
          id?: string
          integrity_hash: string
          platform: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          app_version?: string
          created_at?: string
          enforcement?: string
          id?: string
          integrity_hash?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      vox_protect_challenges: {
        Row: {
          created_at: string
          decision: string | null
          expires_at: string
          id: string
          nonce_hash: string
          scope: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          decision?: string | null
          expires_at: string
          id?: string
          nonce_hash: string
          scope?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          decision?: string | null
          expires_at?: string
          id?: string
          nonce_hash?: string
          scope?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vox_protect_incidents: {
        Row: {
          app_version: string
          created_at: string
          flags: string[]
          id: string
          integrity_hash: string
          kind: string
          scope: string
          user_id: string
        }
        Insert: {
          app_version: string
          created_at?: string
          flags?: string[]
          id?: string
          integrity_hash: string
          kind: string
          scope: string
          user_id: string
        }
        Update: {
          app_version?: string
          created_at?: string
          flags?: string[]
          id?: string
          integrity_hash?: string
          kind?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      vox_roles: {
        Row: {
          badge_url: string | null
          color: string
          created_at: string
          guild_id: string
          hoist: boolean
          icon: string | null
          id: string
          is_default: boolean
          name: string
          permissions: Json
          position: number
          updated_at: string
        }
        Insert: {
          badge_url?: string | null
          color?: string
          created_at?: string
          guild_id: string
          hoist?: boolean
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          permissions?: Json
          position?: number
          updated_at?: string
        }
        Update: {
          badge_url?: string | null
          color?: string
          created_at?: string
          guild_id?: string
          hoist?: boolean
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          permissions?: Json
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_roles_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "vox_guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      vox_voice_participants: {
        Row: {
          channel_id: string
          is_deafened: boolean
          is_muted: boolean
          joined_at: string
          last_seen: string
          session_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          is_deafened?: boolean
          is_muted?: boolean
          joined_at?: string
          last_seen?: string
          session_id: string
          user_id: string
        }
        Update: {
          channel_id?: string
          is_deafened?: boolean
          is_muted?: boolean
          joined_at?: string
          last_seen?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vox_voice_participants_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "vox_channels"
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
      ashes_admin_access_grant: {
        Args: { p_note?: string; p_who: string }
        Returns: Json
      }
      ashes_admin_access_list: { Args: never; Returns: Json }
      ashes_admin_access_revoke: { Args: { p_user: string }; Returns: Json }
      ashes_admin_world: { Args: { p_open: boolean }; Returns: Json }
      ashes_archive_active: { Args: { uid: string }; Returns: undefined }
      ashes_arena_fight: { Args: { p_target: string }; Returns: Json }
      ashes_arena_opponents: { Args: never; Returns: Json }
      ashes_arena_spar: { Args: never; Returns: Json }
      ashes_bag_count: { Args: { uid: string }; Returns: number }
      ashes_boss_attack: { Args: never; Returns: Json }
      ashes_boss_respawn_if_due: { Args: never; Returns: undefined }
      ashes_boss_state: { Args: never; Returns: Json }
      ashes_buy: { Args: { p_item: string }; Returns: Json }
      ashes_can_play: { Args: never; Returns: boolean }
      ashes_chapter: { Args: { ch: number }; Returns: Json }
      ashes_chapter_for: {
        Args: { ch: number; p_faction: string }
        Returns: Json
      }
      ashes_chapter_legie: { Args: { ch: number }; Returns: Json }
      ashes_characters_list: { Args: never; Returns: Json }
      ashes_chat_recent: { Args: { p_after?: number }; Returns: Json }
      ashes_chat_send: {
        Args: { p_channel: string; p_text: string }
        Returns: Json
      }
      ashes_claim_hero: { Args: { p_on: boolean }; Returns: Json }
      ashes_clean_text: { Args: { p: string; p_max: number }; Returns: string }
      ashes_create_character: {
        Args: {
          p_appearance: Json
          p_class: string
          p_faction?: string
          p_name: string
        }
        Returns: Json
      }
      ashes_daily_gift: { Args: never; Returns: Json }
      ashes_delete_character: { Args: { p_slot: string }; Returns: Json }
      ashes_display_name: {
        Args: { ch: Database["public"]["Tables"]["ashes_characters"]["Row"] }
        Returns: string
      }
      ashes_enemy: {
        Args: {
          cls: string
          diff: number
          look?: Json
          lvl: number
          nm: string
        }
        Returns: Json
      }
      ashes_equip: { Args: { p_item: string; p_on?: boolean }; Returns: Json }
      ashes_feedback_send: {
        Args: { p_context?: Json; p_kind: string; p_text: string }
        Returns: Json
      }
      ashes_fight_boss: { Args: never; Returns: Json }
      ashes_fighter: { Args: { uid: string }; Returns: Json }
      ashes_finish_quest: { Args: { p_skip?: boolean }; Returns: Json }
      ashes_grant: {
        Args: { add_gold: number; add_xp: number; uid: string }
        Returns: number
      }
      ashes_hall_of_fame: { Args: never; Returns: Json }
      ashes_hero_say: { Args: { p_text: string }; Returns: Json }
      ashes_hp: { Args: { f: Json }; Returns: number }
      ashes_is_admin: { Args: never; Returns: boolean }
      ashes_live_act: {
        Args: { p_action: string; p_id: string; p_index?: number }
        Returns: Json
      }
      ashes_live_begin: {
        Args: { p_enemy: string; p_region: string }
        Returns: Json
      }
      ashes_live_hit: {
        Args: { att: Json; def: Json; mult: number; passive: number }
        Returns: Json
      }
      ashes_live_reward: {
        Args: { lvl: number; p_enemy: string; uid: string }
        Returns: Json
      }
      ashes_live_rules: { Args: { cls: string }; Returns: Json }
      ashes_log: { Args: { kind: string; msg: string }; Returns: undefined }
      ashes_main: { Args: { f: Json }; Returns: number }
      ashes_make_item: {
        Args: {
          cls: string
          lvl: number
          rarity_bonus?: number
          shop?: boolean
          uid: string
          want_slot?: string
        }
        Returns: string
      }
      ashes_my_oddil: {
        Args: { p_uid: string }
        Returns: {
          faction: string
          oddil_id: string
          role: string
          tag: string
        }[]
      }
      ashes_n: { Args: { j: Json; k: string }; Returns: number }
      ashes_new_character: { Args: never; Returns: Json }
      ashes_oddil_answer: {
        Args: { p_accept: boolean; p_oddil: string }
        Returns: Json
      }
      ashes_oddil_create: {
        Args: { p_motto?: string; p_name: string; p_tag: string }
        Returns: Json
      }
      ashes_oddil_info: { Args: never; Returns: Json }
      ashes_oddil_invite: { Args: { p_name: string }; Returns: Json }
      ashes_oddil_leave: { Args: never; Returns: Json }
      ashes_oddil_member: {
        Args: { p_action: string; p_user: string }
        Returns: Json
      }
      ashes_offer_quests: { Args: { uid: string }; Returns: undefined }
      ashes_race_finish: { Args: never; Returns: Json }
      ashes_race_start: { Args: never; Returns: Json }
      ashes_race_top: { Args: never; Returns: Json }
      ashes_region_enemies: { Args: never; Returns: Json }
      ashes_report_crash: {
        Args: { p_gpu: string; p_log: string; p_version: string }
        Returns: boolean
      }
      ashes_require: { Args: never; Returns: string }
      ashes_scaled_enemy_level: {
        Args: { player_level: number; region_min: number }
        Returns: number
      }
      ashes_sell: { Args: { p_item: string }; Returns: Json }
      ashes_shop: { Args: never; Returns: Json }
      ashes_shop_next: { Args: never; Returns: number }
      ashes_simulate: {
        Args: { a: Json; a_mult?: number; b: Json }
        Returns: Json
      }
      ashes_start_quest: { Args: { p_quest: string }; Returns: Json }
      ashes_state: { Args: never; Returns: Json }
      ashes_switch_character: { Args: { p_slot: string }; Returns: Json }
      ashes_train: { Args: { p_stat: string }; Returns: Json }
      ashes_train_cost: { Args: { val: number }; Returns: number }
      ashes_wall_add: { Args: { delta: number }; Returns: number }
      ashes_world_fight: {
        Args: { p_enemy: string; p_region: string }
        Returns: Json
      }
      ashes_wq_accept: { Args: { p_quest: string }; Returns: Json }
      ashes_wq_catalog: { Args: never; Returns: Json }
      ashes_wq_event: {
        Args: { p_kind: string; p_target: string }
        Returns: Json
      }
      ashes_wq_reqs_done: {
        Args: { reqs: Json; uid: string }
        Returns: boolean
      }
      ashes_wq_turnin: { Args: { p_quest: string }; Returns: Json }
      ashes_xp_need: { Args: { lvl: number }; Returns: number }
      bot_moderation_events_cleanup: { Args: never; Returns: undefined }
      bounty_complete: { Args: { _contract_id: string }; Returns: undefined }
      can: { Args: { _action: string; _module: string }; Returns: boolean }
      can_manage_vox_events: {
        Args: { _guild: string; _user: string }
        Returns: boolean
      }
      clear_conversation_for_me: {
        Args: { _conv_id: string }
        Returns: undefined
      }
      current_user_discord_id: { Args: never; Returns: string }
      discord_id_for_user: { Args: { _user_id: string }; Returns: string }
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
      get_my_permissions: {
        Args: never
        Returns: {
          action: string
          module: string
        }[]
      }
      get_or_create_conversation: {
        Args: { _other_user: string }
        Returns: string
      }
      get_page_draft_blocks: { Args: { _slug: string }; Returns: Json }
      get_platform_stats: { Args: never; Returns: Json }
      get_public_shop_config: {
        Args: never
        Returns: {
          account_number: string
          bank_recipient: string
          donate_max: number
          donate_min: number
          iban: string
          id: string
          paypal_me: string
          refund_notice: string
          stripe_enabled: boolean
        }[]
      }
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
      get_public_team: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          role: string
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
      is_vox_event_member: {
        Args: { _event: string; _user: string }
        Returns: boolean
      }
      is_vox_member: {
        Args: { _guild: string; _user: string }
        Returns: boolean
      }
      launcher_auth_cleanup: { Args: never; Returns: undefined }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: number
      }
      mark_message_read: { Args: { _message_id: string }; Returns: undefined }
      redeem_download_code: { Args: { _code: string }; Returns: boolean }
      security_evaluate_user: { Args: { _user_id: string }; Returns: number }
      security_html_escape: { Args: { _value: string }; Returns: string }
      security_purge_abusive_users: { Args: never; Returns: number }
      security_send_admin_dm: { Args: { _content: string }; Returns: undefined }
      security_system_user_id: { Args: never; Returns: string }
      shop_admin_delete: { Args: { _id: string }; Returns: undefined }
      shop_admin_reject: { Args: { _id: string }; Returns: undefined }
      shop_approve_purchase: { Args: { _id: string }; Returns: undefined }
      shop_can_download: { Args: { p_item: string }; Returns: boolean }
      shop_fulfill_purchase: { Args: { _id: string }; Returns: undefined }
      shop_grant_download: {
        Args: { p_item: string; p_minutes: number; p_user: string }
        Returns: undefined
      }
      shop_log_download: { Args: { p_item: string }; Returns: undefined }
      shop_mark_refunded: { Args: { _id: string }; Returns: undefined }
      shop_my_downloads: {
        Args: never
        Returns: {
          activated_at: string
          active: boolean
          auto_renew: boolean
          expires_at: string
          file_name: string
          file_parts: string[]
          file_sha256: string
          file_size: number
          file_version: string
          item_id: string
          pending_amount: number
          pending_period: string
          pending_purchase: string
          period: string
          refundable_until: string
          title: string
        }[]
      }
      shop_notify_recipients: { Args: never; Returns: string[] }
      shop_period_interval: { Args: { p_period: string }; Returns: string }
      shop_refund_used: {
        Args: { p_item: string; p_user: string }
        Returns: boolean
      }
      shop_renewal_pay: {
        Args: { p_method: string; p_purchase: string; p_terms?: string }
        Returns: undefined
      }
      shop_request_refund: {
        Args: { p_item: string; p_reason?: string }
        Returns: Json
      }
      shop_run_renewals: { Args: never; Returns: number }
      shop_set_auto_renew: {
        Args: { p_item: string; p_on: boolean; p_period?: string }
        Returns: undefined
      }
      shop_vs: { Args: { p_id: string }; Returns: string }
      user_can_do: { Args: { _capability: string }; Returns: boolean }
      user_has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      vox_ban_member: {
        Args: { _guild: string; _reason?: string; _user: string }
        Returns: undefined
      }
      vox_channel_guild: { Args: { _channel: string }; Returns: string }
      vox_has_perm: {
        Args: { _guild: string; _perm: string; _user: string }
        Returns: boolean
      }
      vox_heartbeat: {
        Args: {
          _custom?: string
          _status?: Database["public"]["Enums"]["vox_presence_status"]
        }
        Returns: undefined
      }
      vox_join_by_invite: { Args: { _code: string }; Returns: string }
      vox_kick_member: {
        Args: { _guild: string; _user: string }
        Returns: undefined
      }
      vox_legal_cleanup: { Args: never; Returns: undefined }
      vox_member_role: {
        Args: { _guild: string; _user: string }
        Returns: Database["public"]["Enums"]["vox_member_role"]
      }
      vox_mute_member: {
        Args: { _guild: string; _minutes: number; _user: string }
        Returns: undefined
      }
      vox_set_guild_cosmetic: {
        Args: { _cosmetic: string; _guild: string }
        Returns: undefined
      }
      vox_unban_member: {
        Args: { _guild: string; _user: string }
        Returns: undefined
      }
      vox_voice_heartbeat: { Args: { _channel: string }; Returns: undefined }
      vox_voice_purge_stale: { Args: { _channel?: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "editor" | "user" | "banned" | "content_creator"
      bot_guild_status: "pending" | "approved" | "rejected" | "suspended"
      order_status: "paid" | "done" | "processing" | "cancelled" | "paused"
      server_connection_type: "ip_port" | "invite_code"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
      vox_channel_type: "text" | "voice"
      vox_member_role: "owner" | "mod" | "member"
      vox_presence_status: "online" | "idle" | "dnd" | "offline"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      vox_channel_type: ["text", "voice"],
      vox_member_role: ["owner", "mod", "member"],
      vox_presence_status: ["online", "idle", "dnd", "offline"],
    },
  },
} as const
