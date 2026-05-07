import { supabase } from "@/integrations/supabase/client";
/* eslint-disable @typescript-eslint/no-explicit-any */

export type FlowMathAccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type FlowMathDocumentType = "expense" | "invoice" | "bill" | "payment";
export type FlowMathDocumentStatus = "draft" | "posted" | "paid" | "void";

export interface FlowMathSettings {
  id: string;
  base_currency: string;
  currency_symbol: string;
  timezone: string;
  fiscal_year_start_month: number;
  tax_label: string;
}

export interface FlowMathAccount {
  id: string;
  code: string;
  name: string;
  account_type: FlowMathAccountType;
  normal_balance: "debit" | "credit";
  is_cash: boolean;
  is_system: boolean;
  is_active: boolean;
  description: string | null;
}

export interface FlowMathCounterparty {
  id: string;
  type: "vendor" | "customer";
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  opening_balance: number;
  is_active: boolean;
}

export interface FlowMathJournalEntry {
  id: string;
  entry_no: string;
  entry_date: string;
  source_type: string;
  memo: string | null;
  status: "draft" | "posted" | "void";
  posted_at: string | null;
}

export interface FlowMathJournalLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  description: string | null;
  debit: number;
  credit: number;
  line_no: number;
  account?: Pick<FlowMathAccount, "code" | "name" | "account_type"> | null;
}

export interface FlowMathDocument {
  id: string;
  document_type: FlowMathDocumentType;
  document_no: string;
  document_date: string;
  due_date: string | null;
  memo: string | null;
  status: FlowMathDocumentStatus;
  total_amount: number;
  counterparty_id: string | null;
  journal_entry_id: string | null;
  counterparty?: Pick<FlowMathCounterparty, "name" | "type"> | null;
}

export interface FlowMathPayrollRun {
  id: string;
  run_no: string;
  period_start: string;
  period_end: string;
  status: "draft" | "posted" | "paid" | "void";
  gross_amount: number;
  allowance_amount: number;
  deduction_amount: number;
  net_amount: number;
}

export interface FlowMathPayrollItem {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  total_work_minutes: number;
  notes: string | null;
  employee?: {
    employee_id: string;
    designation: string | null;
    profile?: { full_name: string } | null;
  } | null;
}

export interface FlowMathAccessCandidate {
  employee_id: string;
  user_id: string;
  employee_code: string;
  full_name: string;
  department_name: string | null;
  override_allowed: boolean | null;
  effective_access: boolean;
}

const db = supabase as any;

export async function canAccessFlowMath(userId: string | undefined | null) {
  if (!userId) return false;
  const { data, error } = await db.rpc("can_access_flowmath", { _user_id: userId });
  if (error) throw error;
  return Boolean(data);
}

export async function getFlowMathSettings(): Promise<FlowMathSettings> {
  const { data, error } = await db.from("flowmath_settings").select("*").limit(1).single();
  if (error) throw error;
  return data;
}

export async function updateFlowMathSettings(values: Partial<FlowMathSettings>) {
  const settings = await getFlowMathSettings();
  const { data, error } = await db.from("flowmath_settings").update(values).eq("id", settings.id).select("*").single();
  if (error) throw error;
  return data as FlowMathSettings;
}

export async function listFlowMathAccessCandidates(): Promise<FlowMathAccessCandidate[]> {
  const { data: employees, error: employeesError } = await db
    .from("employees")
    .select("id,user_id,employee_id,department_id")
    .order("employee_id");
  if (employeesError) throw employeesError;

  const departmentIds = [...new Set((employees ?? []).map((employee: { department_id: string | null }) => employee.department_id).filter(Boolean))];
  const userIds = (employees ?? []).map((employee: { user_id: string }) => employee.user_id).filter(Boolean);
  const employeeIds = (employees ?? []).map((employee: { id: string }) => employee.id);

  const [{ data: departments, error: departmentsError }, { data: profiles, error: profilesError }, { data: overrides, error: overridesError }] = await Promise.all([
    departmentIds.length ? db.from("departments").select("id,name").in("id", departmentIds) : Promise.resolve({ data: [], error: null }),
    userIds.length ? db.from("profiles").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    employeeIds.length ? db.from("flowmath_access_overrides").select("employee_id,allowed").in("employee_id", employeeIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (departmentsError) throw departmentsError;
  if (profilesError) throw profilesError;
  if (overridesError) throw overridesError;

  const departmentById = new Map((departments ?? []).map((department: { id: string; name: string }) => [department.id, department.name]));
  const profileById = new Map((profiles ?? []).map((profile: { id: string; full_name: string }) => [profile.id, profile.full_name]));
  const overrideByEmployeeId = new Map((overrides ?? []).map((override: { employee_id: string; allowed: boolean }) => [override.employee_id, override.allowed]));

  return (employees ?? []).map((employee: { id: string; user_id: string; employee_id: string; department_id: string | null }) => {
    const departmentName = employee.department_id ? departmentById.get(employee.department_id) || null : null;
    const override = overrideByEmployeeId.has(employee.id) ? overrideByEmployeeId.get(employee.id) ?? null : null;
    const financeDefault = String(departmentName || "").toLowerCase() === "finance";
    return {
      employee_id: employee.id,
      user_id: employee.user_id,
      employee_code: employee.employee_id,
      full_name: profileById.get(employee.user_id) || employee.employee_id,
      department_name: departmentName,
      override_allowed: override,
      effective_access: override ?? financeDefault,
    };
  });
}

export async function saveFlowMathAccessOverride(employeeId: string, allowed: boolean) {
  const { error } = await db
    .from("flowmath_access_overrides")
    .upsert({ employee_id: employeeId, allowed, reason: "Managed from FlowMath settings" }, { onConflict: "employee_id" });
  if (error) throw error;
}

export async function clearFlowMathAccessOverride(employeeId: string) {
  const { error } = await db.from("flowmath_access_overrides").delete().eq("employee_id", employeeId);
  if (error) throw error;
}

export async function listAccounts() {
  const { data, error } = await db.from("flowmath_accounts").select("*").order("code");
  if (error) throw error;
  return (data ?? []) as FlowMathAccount[];
}

export async function createAccount(payload: Partial<FlowMathAccount>) {
  const { error } = await db.from("flowmath_accounts").insert(payload);
  if (error) throw error;
}

export async function updateAccount(id: string, payload: Partial<FlowMathAccount>) {
  const { error } = await db.from("flowmath_accounts").update(payload).eq("id", id);
  if (error) throw error;
}

export async function listCounterparties(type?: "vendor" | "customer") {
  let query = db.from("flowmath_counterparties").select("*").order("name");
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FlowMathCounterparty[];
}

export async function saveCounterparty(payload: Partial<FlowMathCounterparty> & { type: "vendor" | "customer"; name: string }, id?: string) {
  const query = id ? db.from("flowmath_counterparties").update(payload).eq("id", id) : db.from("flowmath_counterparties").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function listJournalEntries() {
  const { data, error } = await db.from("flowmath_journal_entries").select("*").order("entry_date", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as FlowMathJournalEntry[];
}

export async function listJournalLines(entryId?: string) {
  let query = db
    .from("flowmath_journal_lines")
    .select("*, account:flowmath_accounts(code,name,account_type)")
    .order("line_no");
  if (entryId) query = query.eq("journal_entry_id", entryId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FlowMathJournalLine[];
}

export async function createJournalEntry(payload: { entry_date: string; memo: string; lines: Array<{ account_id: string; description?: string; debit: number; credit: number }> }) {
  const { data: entry, error: entryError } = await db
    .from("flowmath_journal_entries")
    .insert({ entry_no: `JE-${Date.now()}`, entry_date: payload.entry_date, memo: payload.memo, source_type: "manual" })
    .select("*")
    .single();
  if (entryError) throw entryError;

  const lines = payload.lines.map((line, index) => ({
    journal_entry_id: entry.id,
    account_id: line.account_id,
    description: line.description || payload.memo,
    debit: line.debit,
    credit: line.credit,
    line_no: index + 1,
  }));
  const { error: linesError } = await db.from("flowmath_journal_lines").insert(lines);
  if (linesError) throw linesError;
  return entry as FlowMathJournalEntry;
}

export async function postJournalEntry(id: string) {
  const { error } = await db.rpc("post_flowmath_journal_entry", { _journal_entry_id: id });
  if (error) throw error;
}

export async function listDocuments(documentType?: FlowMathDocumentType) {
  let query = db
    .from("flowmath_documents")
    .select("*, counterparty:flowmath_counterparties(name,type)")
    .order("document_date", { ascending: false });
  if (documentType) query = query.eq("document_type", documentType);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FlowMathDocument[];
}

export async function createDocument(payload: {
  document_type: FlowMathDocumentType;
  document_date: string;
  due_date?: string | null;
  memo: string;
  counterparty_id?: string | null;
  lines: Array<{ description: string; debit_account_id: string; credit_account_id: string; quantity: number; unit_amount: number }>;
}) {
  const { data: doc, error: docError } = await db
    .from("flowmath_documents")
    .insert({
      document_no: `${payload.document_type.toUpperCase()}-${Date.now()}`,
      document_type: payload.document_type,
      document_date: payload.document_date,
      due_date: payload.due_date || null,
      memo: payload.memo,
      counterparty_id: payload.counterparty_id || null,
    })
    .select("*")
    .single();
  if (docError) throw docError;

  const { error: lineError } = await db.from("flowmath_document_lines").insert(
    payload.lines.map((line, index) => ({
      document_id: doc.id,
      ...line,
      line_no: index + 1,
    })),
  );
  if (lineError) throw lineError;
  return doc as FlowMathDocument;
}

export async function postDocument(id: string) {
  const { error } = await db.rpc("post_flowmath_document", { _document_id: id });
  if (error) throw error;
}

export async function listPayrollRuns() {
  const { data, error } = await db.from("flowmath_payroll_runs").select("*").order("period_start", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FlowMathPayrollRun[];
}

export async function listPayrollItems(runId: string) {
  const { data, error } = await db
    .from("flowmath_payroll_items")
    .select("*")
    .eq("payroll_run_id", runId)
    .order("created_at");
  if (error) throw error;

  const items = (data ?? []) as FlowMathPayrollItem[];
  const employeeIds = items.map((item) => item.employee_id);
  if (employeeIds.length === 0) return items;

  const { data: employees, error: employeesError } = await db
    .from("employees")
    .select("id, employee_id, designation, user_id")
    .in("id", employeeIds);
  if (employeesError) throw employeesError;

  const userIds = (employees ?? []).map((employee: { user_id: string }) => employee.user_id).filter(Boolean);
  const { data: profiles, error: profilesError } = userIds.length
    ? await db.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) throw profilesError;

  const profileById = new Map((profiles ?? []).map((profile: { id: string; full_name: string }) => [profile.id, profile]));
  const employeeById = new Map(
    (employees ?? []).map((employee: { id: string; employee_id: string; designation: string | null; user_id: string }) => [
      employee.id,
      {
        employee_id: employee.employee_id,
        designation: employee.designation,
        profile: profileById.get(employee.user_id) ? { full_name: profileById.get(employee.user_id)?.full_name || "" } : null,
      },
    ]),
  );

  return items.map((item) => ({ ...item, employee: employeeById.get(item.employee_id) ?? null }));
}

export async function createPayrollRun(periodStart: string, periodEnd: string) {
  const { error } = await db.rpc("create_flowmath_payroll_run", { _period_start: periodStart, _period_end: periodEnd });
  if (error) throw error;
}

export async function updatePayrollItem(id: string, payload: Pick<FlowMathPayrollItem, "allowances" | "deductions" | "notes">) {
  const net_salary = Number(payload.allowances || 0) - Number(payload.deductions || 0);
  const { data: current, error: currentError } = await db.from("flowmath_payroll_items").select("base_salary,payroll_run_id").eq("id", id).single();
  if (currentError) throw currentError;
  const { error } = await db
    .from("flowmath_payroll_items")
    .update({ ...payload, net_salary: Number(current.base_salary || 0) + net_salary })
    .eq("id", id);
  if (error) throw error;
  await db.rpc("refresh_flowmath_payroll_totals", { _payroll_run_id: current.payroll_run_id });
}

export async function postPayrollRun(id: string) {
  const { error } = await db.rpc("post_flowmath_payroll_run", { _payroll_run_id: id });
  if (error) throw error;
}

export async function markPayrollPaid(id: string) {
  const { error } = await db.rpc("mark_flowmath_payroll_paid", { _payroll_run_id: id });
  if (error) throw error;
}

export async function getFlowMathDashboard() {
  const [settings, accounts, journals, docs, payrollRuns] = await Promise.all([
    getFlowMathSettings(),
    listAccounts(),
    listJournalEntries(),
    listDocuments(),
    listPayrollRuns(),
  ]);
  const lines = await listJournalLines();
  return { settings, accounts, journals, docs, payrollRuns, lines };
}
