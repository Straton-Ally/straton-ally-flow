import { describe, expect, it } from "vitest";
import {
  calculatePayrollNet,
  formatFlowMathCurrency,
  getJournalTotals,
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
});
