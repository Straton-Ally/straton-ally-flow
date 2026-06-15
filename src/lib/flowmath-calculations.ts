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

export interface AttendancePenaltyResult {
  presentDays: number;
  lateDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  absentEquivalents: number;
  perDaySalary: number;
  attendanceDeduction: number;
  netSalary: number;
}

export interface AttendanceDayRecord {
  date: string;
  status: 'present' | 'late_day' | 'half_day' | 'absent' | 'leave';
  inTime: string | null;
  outTime: string | null;
  totalWorkMinutes: number;
  isLate: boolean;
  lateMinutes: number;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
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

/**
 * Calculate working days in a period (excluding weekends).
 */
export function getWorkingDaysInPeriod(periodStart: string, periodEnd: string): number {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count || 1;
}

/**
 * Calculate attendance penalties for payroll.
 * Rules: 3 late days = 1 absent, 2 half days = 1 absent.
 */
export function calculateAttendancePenalties(
  baseSalary: number,
  presentDays: number,
  lateDays: number,
  halfDays: number,
  absentDays: number,
  leaveDays: number,
  periodStart: string,
  periodEnd: string,
): AttendancePenaltyResult {
  const workingDays = getWorkingDaysInPeriod(periodStart, periodEnd);
  const perDaySalary = baseSalary / workingDays;
  const absentEquivalents = absentDays + Math.floor(lateDays / 3) + Math.floor(halfDays / 2);
  const attendanceDeduction = perDaySalary * absentEquivalents;
  const netSalary = Math.max(0, baseSalary - attendanceDeduction);

  return {
    presentDays,
    lateDays,
    halfDays,
    absentDays,
    leaveDays,
    absentEquivalents,
    perDaySalary,
    attendanceDeduction,
    netSalary,
  };
}

/**
 * Format work minutes as HH:mm.
 */
export function formatWorkMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes < 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Get a human-readable label for attendance status.
 */
export function getAttendanceStatusLabel(status: string): string {
  switch (status) {
    case "present":
      return "Present";
    case "late_day":
      return "Late Day";
    case "half_day":
      return "Half Day";
    case "absent":
      return "Absent";
    case "leave":
      return "Leave";
    default:
      return status;
  }
}

/**
 * Get badge variant for attendance status.
 */
export function getAttendanceStatusBadgeClass(status: string): string {
  switch (status) {
    case "present":
      return "bg-green-100 text-green-800 border-green-200";
    case "late_day":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "half_day":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "absent":
      return "bg-red-100 text-red-800 border-red-200";
    case "leave":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}
