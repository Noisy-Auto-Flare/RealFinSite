import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto", () => {
  it("should encrypt and decrypt a string", () => {
    const original = "my-super-secret-api-key-12345";
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted.split(":").length).toBe(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("should produce different ciphertexts for the same plaintext", () => {
    const text = "test-value";
    const a = encrypt(text);
    const b = encrypt(text);
    expect(a).not.toBe(b);
  });

  it("should handle empty string", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("should throw on invalid format", () => {
    expect(() => decrypt("invalid-format")).toThrow("Invalid encrypted format");
    expect(() => decrypt("a:b:c:d")).toThrow("Invalid encrypted format");
  });

  it("should handle special characters", () => {
    const text = "!@#$%^&*()_+{}[]|\\:;\"'<>,.?/~`你好";
    const encrypted = encrypt(text);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });
});
