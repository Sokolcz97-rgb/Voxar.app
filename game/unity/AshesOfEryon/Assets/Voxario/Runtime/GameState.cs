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
        public long gold;
        public int honor;
        public int chapter;
        public bool is_eryon;
        public bool is_azkar;
        public Appearance appearance;
    }

    [Serializable]
    public class GameState
    {
        public bool allowed;
        public bool admin;
        public Character character;
        public int hp;
        public WQuest[] wquests;

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
