import { describe, it, expect } from "vitest";
import { ValueObject } from "@/core/domain/value-object";

class Sample extends ValueObject<string> {
  constructor(v: string) {
    super(v);
  }
}

describe("smoke: ValueObject", () => {
  it("compara por valor", () => {
    expect(new Sample("a").equals(new Sample("a"))).toBe(true);
    expect(new Sample("a").equals(new Sample("b"))).toBe(false);
  });
});
