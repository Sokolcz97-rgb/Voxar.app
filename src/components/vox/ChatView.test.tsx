import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ fail: true, insert: vi.fn(), toast: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "self" } }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: mock.toast }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => {
    const query: any = { select: () => query, eq: () => query, in: () => query, order: () => query,
      limit: () => Promise.resolve({data: []}), then: (resolve: any) => Promise.resolve({data: []}).then(resolve),
      insert: (payload: any) => { mock.insert(payload); return { select: () => ({ single: async () => mock.fail ? {error: new Error("offline")} : {data: {...payload,id:"new-message",created_at:new Date().toISOString()}} }) }; }
    }; return query;
  },
  channel: () => { const c: any = {on: () => c, subscribe: () => c}; return c; },
  removeChannel: () => Promise.resolve(),
} }));
vi.mock("./reference/CommunityMessageList", () => ({CommunityMessageList: () => <div />}));
vi.mock("./reference/CommunityChannelHeader", () => ({CommunityChannelHeader: () => <div />}));
vi.mock("./reference/CommunityWelcomeBanner", () => ({CommunityWelcomeBanner: () => <div />}));
vi.mock("./reference/communityChatBridge", () => ({useCommunityChatBridge: () => null}));
import { ChatView } from "./ChatView";
afterEach(() => { cleanup(); mock.insert.mockClear(); });
const channel = {id:"channel", guild_id:"guild", name:"obecné", type:"text",position:0} as any;
describe("chat delivery", () => {
  it("preserves text when delivery fails and clears it after a successful retry", async () => {
    mock.fail = true; render(<ChatView channel={channel} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, {target: {value: "Důležitá rozepsaná zpráva"}});
    fireEvent.click(screen.getByTitle("Odeslat zprávu"));
    await waitFor(() => expect(mock.toast).toHaveBeenCalled());
    expect(input).toHaveValue("Důležitá rozepsaná zpráva");
    mock.fail = false;
    fireEvent.click(screen.getByTitle("Odeslat zprávu"));
    await waitFor(() => expect(input).toHaveValue(""));
    expect(mock.insert).toHaveBeenCalledTimes(2);
  });
});
