import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

describe("Auth utilities", () => {
  it("should hash and verify password", async () => {
    const password = "securepassword123";
    const hash = await bcrypt.hash(password, 12);

    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2")).toBe(true);

    const valid = await bcrypt.compare(password, hash);
    expect(valid).toBe(true);

    const invalid = await bcrypt.compare("wrongpassword", hash);
    expect(invalid).toBe(false);
  });

  it("should reject empty password", async () => {
    const hash = await bcrypt.hash("test", 12);
    const valid = await bcrypt.compare("", hash);
    expect(valid).toBe(false);
  });
});
