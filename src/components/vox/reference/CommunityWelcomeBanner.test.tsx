import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityWelcomeBanner } from "./CommunityWelcomeBanner";

const channels = [
  { id: "text", guild_id: "guild", name: "obecné", type: "text", position: 0 },
  { id: "voice", guild_id: "guild", name: "hlas", type: "voice", position: 1 },
] as any;

afterEach(cleanup);

describe("community welcome banner", () => {
  it("renders the welcome banner with readable copy and working actions", () => {
    const { container } = render(
      <CommunityWelcomeBanner
        guildName="StudioVoxario"
        channels={channels}
        onSelectChannel={vi.fn()}
      />,
    );

    expect(container.querySelector("section.sv-welcome")).toBeTruthy();
    expect(container.querySelector(".sv-welcome-scene-image")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Vítej v komunitě!" })).toBeInTheDocument();
    expect(screen.getByText(/Voxar\.app je místo pro hráče/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Připojit se na hlas/ })).toBeEnabled();
  });
});
