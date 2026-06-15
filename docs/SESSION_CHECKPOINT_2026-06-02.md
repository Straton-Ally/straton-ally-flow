# FlowMath Attendance-Based Payroll — Session Checkpoint

> **Date:** 2026-06-02
> **Status:** Core system implemented; fixes applied for status constraint ambiguity and absent-recovery.

---

## What Was Built

A complete attendance-driven payroll system for FlowMath that:

1. **Tracks attendance with rules:**
   - 8 hours = full day (480 min net work)
   - 45 min break + 15 min grace = total 9h span, actual 8h work
   - Present: `total_work_minutes >= 450` (7.5h net)
   - Late Day: `total_work_minutes >= 360` and `< 450` (6h–7.5h), OR late arrival/early departure beyond 15 min grace
   - Half Day: `total_work_minutes >= 240` and `< 360` (4h–6h)
   - Absent: `total_work_minutes < 240` (4h)

2. **Applies payroll penalties:**
   - **3 late days = 1 absent equivalent**
   - **2 half days = 1 absent equivalent**
   - Deduction = `(base_salary / working_days) * absent_equivalents`

3. **Provides UI:**
   - Payroll run creation with period picker
   - Per-employee attendance summary (Present / Late / Half / Absent / Leave counts)
   - Attendance deduction shown in red
   - **View Attendance** dialog (eye icon) showing day-by-day breakdown with status badges, scheduled times, late minutes
   - **Delete** button for draft/void runs

---

## Files Created

### Database Migrations

| File | Purpose |
|------|---------|
| `supabase/migrations/20260601000001_flowmath_attendance_payroll.sql` | Core migration: new attendance columns, evaluation function, trigger, backfill, payroll generation with penalties, delete function |
| `supabase/migrations/20260601000002_fix_attendance_absent_all.sql` | **RECOVERY + FIX** for the "everyone marked absent" bug. Fixes trigger to skip open records, re-evaluates historical records properly, approximates work minutes from in/out times when total_work_minutes is missing |

### TypeScript / React

| File | What Changed |
|------|-------------|
| `src/lib/flowmath.ts` | Added `late_days`, `half_days`, `absent_equivalents`, `attendance_deduction`, `attendance_details` to `FlowMathPayrollItem` interface. Added `getEmployeeAttendanceForPeriod()` and `deletePayrollRun()` API functions. |
| `src/lib/flowmath-calculations.ts` | Added `getWorkingDaysInPeriod()`, `calculateAttendancePenalties()`, `formatWorkMinutes()`, `getAttendanceStatusLabel()`, `getAttendanceStatusBadgeClass()` |
| `src/pages/flowmath/FlowMathPages.tsx` | Complete rewrite of the Payroll page: summary cards, attendance breakdown table, attendance deduction column, **View Attendance** dialog, **Delete** button, improved error handling with `getErrorText()` |
| `src/test/flowmath-calculations.test.ts` | Added 5 new tests: working days, work minutes formatting, status labels, penalty calculation, zero-penalty path |

---

## Key Fixes Applied During Session

### Fix 1: `attendance_status_check` constraint blocked `late_day`
- **Error:** `new row for relation "attendance" violates check constraint "attendance_status_check"`
- **Fix:** Added `DROP CONSTRAINT IF EXISTS attendance_status_check` and recreated it with `'late_day'` in the allowed list

### Fix 2: Ambiguous column reference
- **Error:** `column reference "attendance_deduction" is ambiguous`
- **Fix:** Added explicit table aliases (`i.`) to all column references in the `totals` subquery inside `create_flowmath_payroll_run` and `refresh_flowmath_payroll_totals`

### Fix 3: Everyone marked as absent
- **Error:** After migration, all employees showed absent in dashboards
- **Root cause:** The `attendance_auto_evaluate` trigger evaluated every record at check-in time when `total_work_minutes` was `NULL` → `COALESCE(NULL,0) = 0` → marked absent immediately. The backfill also processed old records with missing `total_work_minutes` the same way.
- **Fix (in 02 migration):**
  1. Trigger now skips open records (`out_time IS NULL` AND `total_work_minutes IS NULL`)
  2. `evaluate_attendance_status()` now approximates work minutes from `in_time`/`out_time` when `total_work_minutes` is missing
  3. Recovery block sets open records back to `present` and re-evaluates historical records properly

---

## Remaining / Pending Items

1. **Re-run the fix migration** (`20260601000002_fix_attendance_absent_all.sql`) in Supabase SQL Editor if the "everyone absent" issue is still visible.

2. **Verify payroll generation** after the fix migration:
   - Create a new run for a period with real attendance data
   - Confirm present/late/half/absent counts look correct
   - Confirm deductions are calculated properly

3. **Edge cases not yet handled:**
   - Holidays / public holidays (currently all Mon-Fri are counted as working days)
   - Overtime pay calculations
   - Partial-month new hires
   - Leave requests table (doesn't exist yet; only `attendance.status = 'leave'` is tracked)

4. **Auto-checkout evaluation** — the `auto_checkout_attendance` function sets the record, but the trigger may need to fire on the subsequent `UPDATE` that sets `out_time`. Confirm this works in practice.

5. **Manual admin attendance override** — if an admin wants to manually mark a day as "present" or "leave" without using check-in/check-out, the UI doesn't exist yet.

---

## How to Resume Next Session

1. Re-read this file
2. Check if `20260601000002_fix_attendance_absent_all.sql` has been run in Supabase
3. Test creating a payroll run and verify attendance counts
4. If there are new errors, check the Supabase logs for the exact SQL error message
5. Build and test: `npm run test && npm run build`

---

## Architecture Decisions

- **Status values:** `present`, `late_day`, `half_day`, `absent`, `leave`
- **Evaluation happens in database triggers** so frontend can't accidentally misclassify
- **Payroll net formula:** `base_salary + allowances - deductions - attendance_deduction`
- **Deduction formula:** `per_day_salary * absent_equivalents` where `per_day_salary = base_salary / working_days`
- **Working days:** Mon–Fri only (weekends excluded)
- **Grace period:** 15 minutes for both check-in and check-out
- **Break duration:** 45 minutes SOP; auto-checkout and check-out logic already subtracts actual break time from duty duration

---

## Commands

```bash
# Run tests
npm run test

# Build for production
npm run build

# Apply migrations (from project root)
supabase db push
```
