import { describe, it, expect } from "vitest";
import { getEntryTypeLabel } from "@/lib/operation-types";

describe("operation-types", () => {
  it("should return label for known type", () => {
    expect(getEntryTypeLabel("principal")).toBe("Основное движение");
    expect(getEntryTypeLabel("fee")).toBe("Комиссия");
    expect(getEntryTypeLabel("interest")).toBe("Проценты");
  });

  it("should return the value itself for unknown type", () => {
    expect(getEntryTypeLabel("unknown_type")).toBe("unknown_type");
  });
});
