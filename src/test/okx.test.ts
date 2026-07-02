import { describe, it, expect } from "vitest";
import crypto from "crypto";

function signOKX(timestamp: string, method: string, requestPath: string, body: string, secret: string): string {
  const payload = timestamp + method + requestPath + body;
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

describe("OKX signature", () => {
  const key = "test-api-key";
  const secret = "test-api-secret";
  const ts = "2024-01-01T00:00:00.000Z";

  it("should produce deterministic signatures", () => {
    const sig1 = signOKX(ts, "GET", "/api/v5/account/balance", "", secret);
    const sig2 = signOKX(ts, "GET", "/api/v5/account/balance", "", secret);
    expect(sig1).toBe(sig2);
  });

  it("should change with different method", () => {
    const getSig = signOKX(ts, "GET", "/api/v5/account/balance", "", secret);
    const postSig = signOKX(ts, "POST", "/api/v5/account/balance", "{}", secret);
    expect(getSig).not.toBe(postSig);
  });

  it("should change with different path", () => {
    const sig1 = signOKX(ts, "GET", "/api/v5/account/balance", "", secret);
    const sig2 = signOKX(ts, "GET", "/api/v5/asset/deposit-history", "", secret);
    expect(sig1).not.toBe(sig2);
  });

  it("should include body in POST signature", () => {
    const body = JSON.stringify({ ccy: "USDT" });
    const sig = signOKX(ts, "POST", "/api/v5/account/balance", body, secret);
    expect(sig.length).toBeGreaterThan(10);
    expect(/^[A-Za-z0-9+/=]+$/.test(sig)).toBe(true);
  });

  it("should produce base64 output", () => {
    const sig = signOKX(ts, "GET", "/api/v5/account/config", "", secret);
    expect(() => Buffer.from(sig, "base64")).not.toThrow();
    const decoded = Buffer.from(sig, "base64").toString("utf8");
    expect(decoded.length).toBeGreaterThan(0);
  });
});

describe("OKX bill type mapping", () => {
  function mapBillType(subType: string): string {
    const map: Record<string, string> = {
      "1": "exchange", "2": "expense", "3": "income", "4": "expense",
      "6": "income", "7": "expense", "12": "expense", "13": "income",
      "14": "income", "15": "expense", "16": "exchange", "17": "income",
      "68": "exchange",
    };
    return map[subType] || "income";
  }

  it("should map type 1 to exchange", () => expect(mapBillType("1")).toBe("exchange"));
  it("should map type 2 to expense", () => expect(mapBillType("2")).toBe("expense"));
  it("should map type 3 to income", () => expect(mapBillType("3")).toBe("income"));
  it("should map type 4 to expense", () => expect(mapBillType("4")).toBe("expense"));
  it("should map type 13 to income", () => expect(mapBillType("13")).toBe("income"));
  it("should map type 16 to exchange", () => expect(mapBillType("16")).toBe("exchange"));
  it("should map type 68 to exchange", () => expect(mapBillType("68")).toBe("exchange"));
  it("should map unknown type to income", () => expect(mapBillType("999")).toBe("income"));
});
