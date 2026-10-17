import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

import {
  fetchGuildResources,
  invalidateGuildResources,
} from "@/components/GuildResourceSelect";

function response(body: string, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    text: async () => body,
    headers: { get: () => "application/json" },
  } as Response;
}

describe("Discord guild resources API", () => {
  beforeEach(() => {
    mocks.fetch.mockReset();
    mocks.getSession.mockReset();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "user-token" } },
    });
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("uses an absolute configured Supabase functions URL instead of a relative undefined path", async () => {
    const guildId = "1403845575379783743";
    invalidateGuildResources(guildId);
    mocks.fetch.mockResolvedValueOnce(
      response(JSON.stringify({ channels: [], roles: [] })),
    );

    await expect(fetchGuildResources(guildId)).resolves.toEqual({
      channels: [],
      roles: [],
    });

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(String(url)).toMatch(
      /^https:\/\/.+\/functions\/v1\/discord-guild-resources\?guild_id=1403845575379783743$/,
    );
    expect(String(url)).not.toContain("undefined/functions");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer user-token",
    });
    expect((init as RequestInit).headers).toHaveProperty("apikey");
    expect(String(((init as RequestInit).headers as Record<string, string>).apikey).length).toBeGreaterThan(0);
  });

  it("turns an HTML SPA fallback into a useful error and does not cache the failed response", async () => {
    const guildId = "2403845575379783743";
    invalidateGuildResources(guildId);

    mocks.fetch
      .mockResolvedValueOnce(response("<!doctype html><html><body>Voxar.app</body></html>"))
      .mockResolvedValueOnce(response(JSON.stringify({ channels: [], roles: [] })));

    await expect(fetchGuildResources(guildId)).rejects.toThrow(
      /API vrátilo HTML místo JSON/,
    );

    await expect(fetchGuildResources(guildId)).resolves.toEqual({
      channels: [],
      roles: [],
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
