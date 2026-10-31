import { describe, expect, it } from "vitest";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from "@/lib/units";

describe("unit conversions", () => {
  it("matches known values", () => {
    expect(lbToKg(100)).toBeCloseTo(45.359237, 6);
    expect(kgToLb(45.359237)).toBeCloseTo(100, 6);
    expect(ftInToCm(5, 0)).toBeCloseTo(152.4, 6);
    expect(ftInToCm(5, 6)).toBeCloseTo(167.64, 6);
    expect(ftInToCm(6)).toBeCloseTo(182.88, 6);
  });

  it("round-trips weight within precision (mandatory test #10)", () => {
    for (const kg of [20, 45.5, 62.3, 120, 400]) {
      expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 9);
    }
    for (const lb of [44.1, 110, 150.5, 881.8]) {
      expect(kgToLb(lbToKg(lb))).toBeCloseTo(lb, 9);
    }
  });

  it("round-trips height within the one-decimal-inch display precision", () => {
    for (const cm of [100, 152.4, 165, 170, 188.5, 250]) {
      const { feet, inches } = cmToFtIn(cm);
      expect(inches).toBeGreaterThanOrEqual(0);
      expect(inches).toBeLessThan(12);
      expect(Math.abs(ftInToCm(feet, inches) - cm)).toBeLessThanOrEqual(0.13); // half of 0.1 in
    }
  });

  it("carries inches that round up to 12 into the next foot", () => {
    // 5 ft 11.96 in rounds to 5 ft 12.0 in, which must show as 6 ft 0 in
    const cm = ftInToCm(5, 11.96);
    expect(cmToFtIn(cm)).toEqual({ feet: 6, inches: 0 });
  });

  it("gives whole feet exactly", () => {
    expect(cmToFtIn(182.88)).toEqual({ feet: 6, inches: 0 });
  });
});
