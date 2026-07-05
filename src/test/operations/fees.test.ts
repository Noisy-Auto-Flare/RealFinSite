import { describe, it, expect } from "vitest";
import { detectImplicitFees, FeeDetectionInput } from "@/lib/operations/fees";

describe("detectImplicitFees", () => {
  it("should return null when principal entries are balanced", () => {
    const entries: FeeDetectionInput[] = [
      { accountId: 1, currency: "RUB", amount: 1000, type: "principal" },
      { accountId: 1, currency: "RUB", amount: -1000, type: "principal" },
    ];
    expect(detectImplicitFees(entries)).toBeNull();
  });

  it("should detect fee when principal entries have remainder", () => {
    const entries: FeeDetectionInput[] = [
      { accountId: 1, currency: "RUB", amount: 1000, type: "principal" },
      { accountId: 1, currency: "RUB", amount: -950, type: "principal" },
    ];
    const result = detectImplicitFees(entries);
    expect(result).not.toBeNull();
    expect(result!.accountId).toBe(1);
    expect(result!.currency).toBe("RUB");
    expect(Math.abs(result!.amount)).toBeGreaterThan(0);
  });

  it("should return null when only one principal entry", () => {
    const entries: FeeDetectionInput[] = [
      { accountId: 1, currency: "RUB", amount: -500, type: "principal" },
    ];
    expect(detectImplicitFees(entries)).toBeNull();
  });

  it("should return null for empty entries", () => {
    expect(detectImplicitFees([])).toBeNull();
  });

  it("should handle multiple currencies independently", () => {
    const entries: FeeDetectionInput[] = [
      { accountId: 1, currency: "RUB", amount: 1000, type: "principal" },
      { accountId: 1, currency: "RUB", amount: -1000, type: "principal" },
      { accountId: 1, currency: "USD", amount: 100, type: "principal" },
      { accountId: 1, currency: "USD", amount: -95, type: "principal" },
    ];
    const result = detectImplicitFees(entries);
    expect(result).not.toBeNull();
    expect(result!.currency).toBe("USD");
  });
});
