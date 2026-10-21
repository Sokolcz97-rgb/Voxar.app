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
    }
}
