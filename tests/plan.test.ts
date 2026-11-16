import { describe, expect, test } from "bun:test";
import { homeTarget, mortgage, projection } from "../src/domain/plan";
import { defaultPlan } from "../src/model";

describe("home planning", () => {
  test("uses semiannual compounding when calculating a fixed Canadian mortgage", () => {
    const payment = mortgage(1000, 5, 25);
    expect(payment).toBeCloseTo(5.82, 2);
  });
  test("divides principal evenly when interest is zero", () => {
    const payment = mortgage(120000, 0, 10);
    expect(payment).toBe(1000);
  });
  test("includes costs and reserves when setting a cash target", () => {
    const result = homeTarget(defaultPlan);
    expect(result).toBe(122000);
  });
  test("reaches goal in 10 months when contributions close a 10000 gap without returns", () => {
    const result = projection(112000, { ...defaultPlan, monthly: 1000, annualReturn: 0 });
    expect(result.months).toBe(10);
    expect(result.points.at(-1)?.value).toBe(122000);
  });
  test("has no finite timeline when money cannot grow", () => {
    const result = projection(1000, { ...defaultPlan, monthly: 0, annualReturn: 0 });
    expect(result.months).toBeNull();
  });
  test("needs zero months when already funded", () => {
    const result = projection(122000, defaultPlan);
    expect(result.months).toBe(0);
  });
  test("does not treat market losses as progress when contributions are zero", () => {
    const result = projection(10000, { ...defaultPlan, monthly: 0, annualReturn: -10 });
    expect(result.months).toBeNull();
    expect(result.points.at(-1)?.value).toBeLessThan(10000);
  });
});
