import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  crossUserGameRead: false,
  presence: {
    onlineIds: new Set(["self", "other"]),
    isOnline: () => true,
    visitorCount: 0,
    registeredCount: 0,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "self" } }) }));
vi.mock("@/contexts/PresenceContext", () => ({ usePresence: () => mock.presence }));
vi.mock("react-router-dom", () => ({ Link: ({ children }: any) => <a>{children}</a> }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/components/UserAvatar", () => ({ UserAvatar: () => <div /> }));
// Radix Dialog measures the DOM; in jsdom it never settles, so the dialog is stubbed to render inline.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query: any = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        in: () => {
          if (table === "user_games") mock.crossUserGameRead = true;
          return query;
        },
        then: (resolve: any) =>
          Promise.resolve({
            data:
              table === "user_games"
                ? [{ games: { id: "windrose", name: "Windrose", color_tag: "#0ff" } }]
                : [{ user_id: "other", display_name: "Other", username: "other", avatar_url: null }],
          }).then(resolve),
      };
      return query;
    },
    rpc: (name: string, args: any) => {
      mock.rpc(name, args);
      return Promise.resolve({ data: ["other"] });
    },
  },
}));

import { LfgWidget } from "./LfgWidget";

afterEach(() => {
  cleanup();
  mock.rpc.mockClear();
  mock.crossUserGameRead = false;
});

describe("LFG matchmaking", () => {
  it("asks the server who plays the game instead of reading other members' game libraries", async () => {
    render(<LfgWidget />);
    const chips = await screen.findAllByText("Windrose");
    fireEvent.click(chips[chips.length - 1]);

    await waitFor(() =>
      expect(mock.rpc).toHaveBeenCalledWith("lfg_players_with_game", {
        _game_id: "windrose",
        _candidate_ids: ["other"],
      }),
    );
    expect(mock.crossUserGameRead).toBe(false);
    expect(await screen.findByText("Other")).toBeTruthy();
  });
});
