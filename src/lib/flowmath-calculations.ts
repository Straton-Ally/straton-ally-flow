export interface FlowMathSettingsLike {
  base_currency?: string | null;
  currency_symbol?: string | null;
}

export interface JournalLineAmount {
  debit?: number | string | null;
  credit?: number | string | null;
}

export interface PayrollAmounts {
  baseSalary: number;
  allowances: number;
  deductions: number;
}

const toNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getJournalTotals(lines: JournalLineAmount[]) {
  return lines.reduce(
    (totals, line) => ({
      debit: totals.debit + toNumber(line.debit),
      credit: totals.credit + toNumber(line.credit),
    }),
    { debit: 0, credit: 0 },
  );
}

export function isBalancedJournal(lines: JournalLineAmount[]) {
  const totals = getJournalTotals(lines);
  return totals.debit > 0 && totals.credit > 0 && Math.abs(totals.debit - totals.credit) < 0.005;
}

export function calculatePayrollNet({ baseSalary, allowances, deductions }: PayrollAmounts) {
  return Math.max(0, toNumber(baseSalary) + toNumber(allowances) - toNumber(deductions));
}

export function formatFlowMathCurrency(amount: number, settings?: FlowMathSettingsLike | null) {
  const currency = settings?.base_currency || "PKR";

  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${settings?.currency_symbol || currency} ${Math.round(amount).toLocaleString("en-PK")}`;
  }
}
