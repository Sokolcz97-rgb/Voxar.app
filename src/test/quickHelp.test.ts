import { describe, expect, it } from "vitest";
import { findQuickHelp, generateSecurePassword } from "@/lib/quickHelp";

describe("Voxario no-AI fallback", () => {
  it("finds deterministic help without an AI request", () => {
    const results = findQuickHelp("potřebuji ticket s problémem");
    expect(results[0]?.href).toBe("/tickets");
  });

  it("generates a local strong password", () => {
    const password = generateSecurePassword(24);
    expect(password).toHaveLength(24);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%&*+\-_=?.]/);
  });
});
