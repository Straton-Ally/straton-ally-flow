import { describe, expect, it } from "vitest";
import {
  calculateAttendancePenalties,
  calculatePayrollNet,
  formatFlowMathCurrency,
  formatWorkMinutes,
  getAttendanceStatusLabel,
  getJournalTotals,
  getWorkingDaysInPeriod,
  isBalancedJournal,
} from "@/lib/flowmath-calculations";

describe("FlowMath calculations", () => {
  it("calculates debit and credit totals", () => {
    expect(getJournalTotals([{ debit: 100 }, { credit: "75" }, { credit: 25 }])).toEqual({
      debit: 100,
      credit: 100,
    });
  });

  it("validates balanced journals", () => {
    expect(isBalancedJournal([{ debit: 100 }, { credit: 100 }])).toBe(true);
    expect(isBalancedJournal([{ debit: 100 }, { credit: 90 }])).toBe(false);
  });

  it("formats currency with FlowMath settings", () => {
    expect(formatFlowMathCurrency(250000, { base_currency: "PKR", currency_symbol: "Rs" })).toContain("250,000");
  });

  it("calculates payroll base plus manual adjustments", () => {
    expect(calculatePayrollNet({ baseSalary: 100000, allowances: 15000, deductions: 5000 })).toBe(110000);
  });

  it("counts working days excluding weekends", () => {
    expect(getWorkingDaysInPeriod("2026-06-01", "2026-06-07")).toBe(5); // Mon-Fri
    expect(getWorkingDaysInPeriod("2026-06-01", "2026-06-01")).toBe(1);
  });

  it("formats work minutes as HH:mm", () => {
    expect(formatWorkMinutes(480)).toBe("08:00");
    expect(formatWorkMinutes(75)).toBe("01:15");
    expect(formatWorkMinutes(null)).toBe("—");
    expect(formatWorkMinutes(-5)).toBe("—");
  });

  it("returns attendance status labels", () => {
    expect(getAttendanceStatusLabel("present")).toBe("Present");
    expect(getAttendanceStatusLabel("late_day")).toBe("Late Day");
    expect(getAttendanceStatusLabel("half_day")).toBe("Half Day");
    expect(getAttendanceStatusLabel("absent")).toBe("Absent");
    expect(getAttendanceStatusLabel("leave")).toBe("Leave");
  });

  it("calculates attendance penalties correctly", () => {
    const result = calculateAttendancePenalties(
      90000, // base salary
      20,    // present
      3,     // late days -> 1 absent equivalent
      2,     // half days -> 1 absent equivalent
      1,     // absent
      2,     // leave
      "2026-06-01",
      "2026-06-30",
    );

    // Working days in June 2026 = 22 (Mon-Fri only)
    const workingDays = getWorkingDaysInPeriod("2026-06-01", "2026-06-30");
    expect(workingDays).toBe(22);

    const perDay = 90000 / 22;
    expect(result.perDaySalary).toBeCloseTo(perDay, 2);
    // absent_equivalents = 1 + floor(3/3) + floor(2/2) = 1 + 1 + 1 = 3
    expect(result.absentEquivalents).toBe(3);
    expect(result.attendanceDeduction).toBeCloseTo(perDay * 3, 2);
    expect(result.netSalary).toBeCloseTo(90000 - perDay * 3, 2);
  });

  it("calculates zero penalties for perfect attendance", () => {
    const result = calculateAttendancePenalties(60000, 22, 0, 0, 0, 0, "2026-06-01", "2026-06-30");
    expect(result.absentEquivalents).toBe(0);
    expect(result.attendanceDeduction).toBe(0);
    expect(result.netSalary).toBe(60000);
  });
});
