import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";

const voiceMock = vi.hoisted(() => ({
  join: vi.fn<(channelId: string | null) => Promise<void>>(),
  leave: vi.fn<() => Promise<void>>(async () => undefined),
}));

vi.mock("@/hooks/useVoxVoice", () => ({
  useVoxVoice: (channelId: string | null) => ({
    room: {},
    connected: false,
    connecting: false,
    muted: false,
    deafened: false,
    videoOn: false,
    screenOn: false,
    localVideoStream: null,
    remotes: {},
    selfLevel: 0,
    presentIds: new Set<string>(),
    join: () => voiceMock.join(channelId),
    leave: voiceMock.leave,
    toggleMute: vi.fn(),
    toggleDeafen: vi.fn(),
    toggleVideo: vi.fn(),
    toggleScreen: vi.fn(),
    startVideo: vi.fn(),
    stopVideo: vi.fn(),
    startScreen: vi.fn(),
    stopScreen: vi.fn(),
    applyCamQuality: vi.fn(),
  }),
}));

vi.mock("@livekit/components-react", () => ({
  RoomContext: { Provider: ({ children }: { children: ReactNode }) => <>{children}</> },
  RoomAudioRenderer: () => null,
}));

import { VoiceCallProvider, useVoiceCall } from "./VoiceCallContext";

const channel = { id: "voice-1", guild_id: "guild-1", name: "Herní hlas", type: "voice", position: 0 } as any;

function Harness() {
  const { channel: active, joinChannel } = useVoiceCall();
  const [status, setStatus] = useState("idle");
  const join = () => {
    setStatus("waiting");
    void joinChannel(channel).then(() => setStatus("done")).catch(() => setStatus("failed"));
  };
  return <><button onClick={join}>Join</button><span data-testid="status">{status}</span><span data-testid="channel">{active?.id ?? "none"}</span></>;
}

afterEach(() => {
  cleanup();
  voiceMock.join.mockReset();
  voiceMock.leave.mockClear();
});

describe("VoiceCallProvider join lifecycle", () => {
  it("keeps joinChannel pending until the LiveKit join actually resolves", async () => {
    let resolveJoin!: () => void;
    voiceMock.join.mockImplementation(() => new Promise<void>((resolve) => { resolveJoin = resolve; }));
    render(<VoiceCallProvider><Harness /></VoiceCallProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() => expect(voiceMock.join).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("status")).toHaveTextContent("waiting");
    expect(screen.getByTestId("channel")).toHaveTextContent("voice-1");

    resolveJoin();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"));
  });

  it("rejects the requested join and clears the selected channel when LiveKit fails", async () => {
    voiceMock.join.mockRejectedValue(new Error("token failed"));
    render(<VoiceCallProvider><Harness /></VoiceCallProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("failed"));
    expect(screen.getByTestId("channel")).toHaveTextContent("none");
  });
});
