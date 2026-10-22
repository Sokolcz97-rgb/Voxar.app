using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Okno zavřené klávesou Escape v tomto snímku – aby se zároveň neotevřelo nastavení.</summary>
    public static class UiFocus
    {
        public static int ClosedFrame = -1;
        public static void MarkClosed() => ClosedFrame = Time.frameCount;
        public static bool ClosedThisFrame => ClosedFrame == Time.frameCount;
    }
}
