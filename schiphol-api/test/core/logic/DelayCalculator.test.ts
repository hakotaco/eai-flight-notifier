import { describe, expect, test } from "bun:test";
import {
  calculateDelayMinutes,
  hasDelayChanged,
} from "../../../src/core/logic/DelayCalculator";

describe("DelayCalculator", () => {
  test("returns 0 if actual time is missing", () => {
    const schedule = new Date("2025-12-25T10:00:00Z");
    expect(calculateDelayMinutes(schedule, null)).toBe(0);
  });

  test("returns 0 if flight is on time", () => {
    const schedule = new Date("2025-12-25T10:00:00Z");
    const actual = new Date("2025-12-25T10:00:00Z");
    expect(calculateDelayMinutes(schedule, actual)).toBe(0);
  });

  test("returns 0 if flight is early (negative delay)", () => {
    const schedule = new Date("2025-12-25T10:00:00Z");
    const actual = new Date("2025-12-25T09:50:00Z"); // Early 10 mins
    expect(calculateDelayMinutes(schedule, actual)).toBe(0);
  });

  test("returns correct minutes for delay", () => {
    const schedule = new Date("2025-12-25T10:00:00Z");
    const actual = new Date("2025-12-25T10:15:30Z"); // Delayed 15m 30s
    // Should be 15 (floored)
    expect(calculateDelayMinutes(schedule, actual)).toBe(15);
  });
});

describe("ChangeDetection", () => {
  test("returns true if delay increased", () => {
    expect(hasDelayChanged(10, 20)).toBe(true);
  });

  test("returns true if delay decreased but still delayed", () => {
    expect(hasDelayChanged(20, 10)).toBe(true);
  });

  test("returns true if flight became delayed from on-time", () => {
    expect(hasDelayChanged(0, 5)).toBe(true);
  });

  test("returns false if delay is same", () => {
    expect(hasDelayChanged(15, 15)).toBe(false);
  });

  test("returns false if both are 0 (on time)", () => {
    expect(hasDelayChanged(0, 0)).toBe(false);
  });
});
