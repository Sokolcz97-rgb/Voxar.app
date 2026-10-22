using System;

namespace Voxario.Ashes
{
    // Odpověď serverové funkce ashes_state (jen pole, která tahle verze používá).
    [Serializable]
    public class Appearance
    {
        public string gender;
    }

    [Serializable]
    public class Character
    {
        public string name;
        public string display_name;
        public string @class;
        public string faction;
        public int level;
        public long xp;
        public long xp_need;
        public int wins;
        public int losses;
        public long gold;
        public int honor;
        public int chapter;
        public bool is_eryon;
        public bool is_azkar;
        public int sila, obratnost, intelekt, vydrz, stesti;
        public int chapter_progress, courage;
        public string boss_ready_at, arena_ready_at;
        public Appearance appearance;
    }

    /// <summary>Předmět (výbava, batoh, zboží u kováře).</summary>
    [Serializable]
    public class Item
    {
        public string id, slot, name;
        public int rarity, level, wmin, wmax, armor, sila, obratnost, intelekt, vydrz, stesti, price;
        public bool equipped, in_shop;
        public bool Valid => !string.IsNullOrEmpty(id);
    }

    [Serializable] public class ItemList { public Item[] items; }

    /// <summary>Bojové hodnoty postavy včetně výbavy (ashes_fighter).</summary>
    [Serializable]
    public class FighterStats
    {
        public int level, sila, obratnost, intelekt, vydrz, stesti, wmin, wmax, armor;
        public bool shield;
    }

    /// <summary>Výprava (časová mise za odvahu, ashes_quests).</summary>
    [Serializable]
    public class Expedition
    {
        public string id, title, story, state, started_at, ends_at;
        public int chapter, minutes, xp, gold, item_chance;
        public ExpeditionEnemy enemy;
        public int CourageCost => 8 + minutes * 2;
    }

    [Serializable] public class ExpeditionEnemy { public string name, @class; public int level; }

    [Serializable] public class ChapterBoss { public string c, e, s, t, win; }

    /// <summary>Aktuální kapitola příběhu (ashes_chapter_for + číslo n).</summary>
    [Serializable]
    public class ChapterInfo
    {
        public int n, need;
        public string title, intro, song;
        public ChapterBoss boss;
    }

    [Serializable] public class TrainCost { public int sila, obratnost, intelekt, vydrz, stesti; }

    [Serializable]
    public class GameState
    {
        public bool allowed;
        public bool admin;
        public Character character;
        public float hp;
        public WQuest[] wquests;
        public Item[] items;
        public FighterStats fighter;
        public TrainCost train_cost;
        public int bag_max;
        public string now;
        public Expedition[] quests;
        public ChapterInfo chapter;

        public int BagCount
        {
            get { int n = 0; if (items != null) foreach (var i in items) if (!i.equipped) n++; return n; }
        }

        public WQuest Quest(string id)
        {
            if (wquests == null) return null;
            foreach (var q in wquests) if (q.quest_id == id) return q;
            return null;
        }
    }

    /// <summary>Stav úkolu od NPC (pravidla drží server).</summary>
    [Serializable]
    public class WQuest
    {
        public string quest_id;
        public string state; // active | ready | done
        public int progress;
        public string[] targets;
    }

    [Serializable]
    public class TurnInResult
    {
        public string quest;
        public int xp;
        public int gold;
        public int levels;
        public GameState state;
    }
}
