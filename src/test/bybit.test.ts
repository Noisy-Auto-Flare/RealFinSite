import { describe, it, expect } from "vitest";
import crypto from "crypto";

function signRequest(apiKey: string, secret: string, timestamp: string): string {
  const payload = `${timestamp}${apiKey}${5000}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("Bybit HMAC signing", () => {
  it("should produce deterministic signatures", () => {
    const key = "test-api-key";
    const secret = "test-api-secret";
    const ts = "1712345678000";

    const sig1 = signRequest(key, secret, ts);
    const sig2 = signRequest(key, secret, ts);
    expect(sig1).toBe(sig2);
  });

  it("should change signature when timestamp changes", () => {
    const key = "test-api-key";
    const secret = "test-api-secret";

    const sig1 = signRequest(key, secret, "1712345678000");
    const sig2 = signRequest(key, secret, "1712345679000");
    expect(sig1).not.toBe(sig2);
  });

  it("should change signature when api key changes", () => {
    const secret = "test-api-secret";
    const ts = "1712345678000";

    const sig1 = signRequest("key-a", secret, ts);
    const sig2 = signRequest("key-b", secret, ts);
    expect(sig1).not.toBe(sig2);
  });

  it("should produce correct length hex string", () => {
    const sig = signRequest("k", "s", "1712345678000");
    expect(sig.length).toBe(64);
    expect(/^[a-f0-9]+$/.test(sig)).toBe(true);
  });

  it("should include body in payload when provided", () => {
    function signWithBody(key: string, secret: string, ts: string, body: string): string {
      const payload = `${ts}${key}${5000}${body}`;
      return crypto.createHmac("sha256", secret).update(payload).digest("hex");
    }
    const withBody = signWithBody("k", "s", "1712345678000", "accountType=UNIFIED");
    const withoutBody = signWithBody("k", "s", "1712345678000", "");
    expect(withBody).not.toBe(withoutBody);
  });
});

describe("Bybit transaction type mapping", () => {
  function mapTxType(bybitType: string): string {
    const map: Record<string, string> = {
      DEPOSIT: "income",
      WITHDRAW: "expense",
      REALISED_PNL: "income",
      COMMISSION: "expense",
      FUNDING_FEE: "expense",
      TRANSFER_IN: "transfer",
      TRANSFER_OUT: "transfer",
      SWAP_IN: "exchange",
      SWAP_OUT: "exchange",
    };
    return map[bybitType] || "income";
  }

  it("should map DEPOSIT to income", () => expect(mapTxType("DEPOSIT")).toBe("income"));
  it("should map WITHDRAW to expense", () => expect(mapTxType("WITHDRAW")).toBe("expense"));
  it("should map REALISED_PNL to income", () => expect(mapTxType("REALISED_PNL")).toBe("income"));
  it("should map COMMISSION to expense", () => expect(mapTxType("COMMISSION")).toBe("expense"));
  it("should map FUNDING_FEE to expense", () => expect(mapTxType("FUNDING_FEE")).toBe("expense"));
  it("should map TRANSFER_IN to transfer", () => expect(mapTxType("TRANSFER_IN")).toBe("transfer"));
  it("should map TRANSFER_OUT to transfer", () => expect(mapTxType("TRANSFER_OUT")).toBe("transfer"));
  it("should map SWAP_IN to exchange", () => expect(mapTxType("SWAP_IN")).toBe("exchange"));
  it("should map SWAP_OUT to exchange", () => expect(mapTxType("SWAP_OUT")).toBe("exchange"));
  it("should map unknown type to income", () => expect(mapTxType("UNKNOWN_TYPE")).toBe("income"));
});
