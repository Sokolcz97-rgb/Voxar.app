using System;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Texty NPC a úkolů převzaté z webové verze (Resources/content.json).</summary>
    [Serializable]
    public class Content
    {
        [Serializable]
        public class QuestDef
        {
            public string id, faction, giver, type, target, title, offer, objective, done, goalNpc;
            public int count;
            public string[] req;
        }

        [Serializable]
        public class Lore { public string q, a; }

        [Serializable]
        public class NpcTalk
        {
            public string id, greet;
            public Lore[] lore;
        }

        public QuestDef[] quests;
        public NpcTalk[] npcs;

        static Content s_Instance;
        public static Content Data
        {
            get
            {
                if (s_Instance != null) return s_Instance;
                var text = Resources.Load<TextAsset>("content");
                s_Instance = text != null ? JsonUtility.FromJson<Content>(text.text) : new Content { quests = Array.Empty<QuestDef>(), npcs = Array.Empty<NpcTalk>() };
                return s_Instance;
            }
        }

        public NpcTalk Talk(string npc)
        {
            foreach (var n in npcs) if (n.id == npc) return n;
            return null;
        }

        public QuestDef Quest(string id)
        {
            foreach (var q in quests) if (q.id == id) return q;
            return null;
        }
    }
}
