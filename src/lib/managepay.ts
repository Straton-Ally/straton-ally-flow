import { supabase } from "@/integrations/supabase/client";
/* eslint-disable @typescript-eslint/no-explicit-any */

const db = supabase as any;

export type ManagePayInvoiceStatus = "pending" | "paid" | "failed" | "canceled";
export type ManagePayPaymentMethod = "card" | "mobile" | "qr" | "payment_link";

export interface ManagePayCompany {
  id: string;
  name: string;
  email: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  logo_has_dark_bg: boolean;
  payment_base_url: string | null;
  tax_id: string | null;
  stripe_account_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManagePayClient {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManagePayInvoiceService {
  id: string;
  name: string;
  description: string | null;
  default_rate: number;
  created_at: string;
  updated_at: string;
}

export interface ManagePayLineItem {
  id: string;
  serviceId?: string | null;
  serviceName?: string | null;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface ManagePayInvoiceMetadata {
  company?: Record<string, unknown>;
  client?: Record<string, unknown>;
  items?: ManagePayLineItem[];
  subtotal?: number;
  tax?: number;
  taxRate?: number;
  total?: number;
  notes?: string;
  paymentUrl?: string;
}

export interface ManagePayInvoice {
  id: string;
  invoice_number: string;
  seller_id: string;
  client_id: string | null;
  client_email: string;
  amount_in_cents: number;
  currency: string;
  description: string | null;
  due_date: string | null;
  status: ManagePayInvoiceStatus;
  stripe_payment_intent_id: string | null;
  metadata: ManagePayInvoiceMetadata;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManagePayTerminalTransaction {
  id: string;
  user_id: string;
  amount_in_cents: number;
  fee_in_cents: number;
  total_in_cents: number;
  currency: string;
  description: string | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: ManagePayPaymentMethod;
  status: "pending" | "completed" | "failed" | "canceled";
  provider_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ManagePayAccessCandidate {
  employee_id: string;
  user_id: string;
  employee_code: string;
  full_name: string;
  department_name: string | null;
  override_allowed: boolean | null;
  effective_access: boolean;
  allowed_company_ids: string[];
}

export interface ManagePayInvoiceCreator {
  user_id: string;
  full_name: string;
  email: string | null;
  employee_code: string | null;
}

export function centsToAmount(cents: number | null | undefined) {
  return Number(cents || 0) / 100;
}

export function amountToCents(amount: number) {
  return Math.round(Number(amount || 0) * 100);
}

export function formatManagePayMoney(cents: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(centsToAmount(cents));
  } catch {
    return `${currency.toUpperCase()} ${centsToAmount(cents).toFixed(2)}`;
  }
}

export function normalizePaymentBaseUrl(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export function getInvoicePaymentUrl(invoice: Pick<ManagePayInvoice, "id" | "metadata">) {
  const company = (invoice.metadata?.company || {}) as { paymentBaseUrl?: string | null; payment_base_url?: string | null };
  const baseUrl = normalizePaymentBaseUrl(company.paymentBaseUrl || company.payment_base_url);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${baseUrl || origin}/pay/${invoice.id}`;
}

export function getInvoiceClientPreviewUrl(invoice: Pick<ManagePayInvoice, "id">) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/managepay/client-preview/${invoice.id}`;
}

export async function uploadManagePayCompanyLogo(file: File, companyName: string) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  const safeCompany = companyName.trim().replace(/[^a-zA-Z0-9._-]/g, "_") || "company";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${safeCompany}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const { error } = await db.storage
    .from("managepay-company-logos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = db.storage.from("managepay-company-logos").getPublicUrl(path);
  return data.publicUrl;
}

export async function canAccessManagePay(userId: string | undefined | null) {
  if (!userId) return false;
  const { data, error } = await db.rpc("can_access_managepay", { _user_id: userId });
  if (error) throw error;
  return Boolean(data);
}

export async function listManagePayAccessCandidates(): Promise<ManagePayAccessCandidate[]> {
  const { data, error } = await db.rpc("list_managepay_access_candidates");
  if (error) throw error;
  return (data ?? []) as ManagePayAccessCandidate[];
}

export async function saveManagePayAccessOverride(employeeId: string, allowed: boolean) {
  const { error } = await db
    .from("managepay_access_overrides")
    .upsert({ employee_id: employeeId, allowed, reason: "Managed from ManagePay settings" }, { onConflict: "employee_id" });
  if (error) throw error;
}

export async function clearManagePayAccessOverride(employeeId: string) {
  const { error } = await db.from("managepay_access_overrides").delete().eq("employee_id", employeeId);
  if (error) throw error;
}

export async function setManagePayEmployeeCompanyAccess(employeeId: string, companyIds: string[]) {
  const { error } = await db.rpc("set_managepay_employee_company_access", {
    _employee_id: employeeId,
    _company_ids: companyIds,
  });
  if (error) throw error;
}

export async function listManagePayCompanies(activeOnly = false): Promise<ManagePayCompany[]> {
  let query = db.from("managepay_companies").select("*").order("name");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ManagePayCompany[];
}

export async function saveManagePayCompany(payload: Partial<ManagePayCompany> & { name: string; email: string }, id?: string) {
  const query = id
    ? db.from("managepay_companies").update(payload).eq("id", id)
    : db.from("managepay_companies").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteManagePayCompany(id: string) {
  const { error } = await db.from("managepay_companies").delete().eq("id", id);
  if (error) throw error;
}

export async function listManagePayClients(): Promise<ManagePayClient[]> {
  const { data, error } = await db.from("managepay_clients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ManagePayClient[];
}

export async function saveManagePayClient(payload: Partial<ManagePayClient> & { user_id: string; name: string; email: string }, id?: string) {
  const query = id
    ? db.from("managepay_clients").update(payload).eq("id", id).select("*").single()
    : db.from("managepay_clients").insert(payload).select("*").single();
  const { data, error } = await query;
  if (error) throw error;
  return data as ManagePayClient;
}

export async function deleteManagePayClient(id: string) {
  const { error } = await db.from("managepay_clients").delete().eq("id", id);
  if (error) throw error;
}

export async function listManagePayServices(): Promise<ManagePayInvoiceService[]> {
  const { data, error } = await db.from("managepay_invoice_services").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as ManagePayInvoiceService[];
}

export async function saveManagePayService(payload: Partial<ManagePayInvoiceService> & { name: string }, id?: string) {
  const query = id
    ? db.from("managepay_invoice_services").update(payload).eq("id", id)
    : db.from("managepay_invoice_services").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteManagePayService(id: string) {
  const { error } = await db.from("managepay_invoice_services").delete().eq("id", id);
  if (error) throw error;
}

export async function listManagePayInvoices(): Promise<ManagePayInvoice[]> {
  const { data, error } = await db.from("managepay_invoices").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(((data ?? []) as ManagePayInvoice[]).map(hydrateInvoiceCompanyBranding));
}

export async function listManagePayInvoiceCreators(userIds: string[]): Promise<Record<string, ManagePayInvoiceCreator>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const [{ data: profiles, error: profilesError }, { data: employees, error: employeesError }] = await Promise.all([
    db.from("profiles").select("id, full_name, email").in("id", uniqueIds),
    db.from("employees").select("user_id, employee_id").in("user_id", uniqueIds),
  ]);
  if (profilesError) throw profilesError;
  if (employeesError) throw employeesError;

  const employeeByUserId = new Map((employees ?? []).map((employee: any) => [employee.user_id, employee.employee_id]));
  return Object.fromEntries(
    uniqueIds.map((userId) => {
      const profile = (profiles ?? []).find((entry: any) => entry.id === userId);
      return [
        userId,
        {
          user_id: userId,
          full_name: profile?.full_name || employeeByUserId.get(userId) || "Unknown user",
          email: profile?.email ?? null,
          employee_code: employeeByUserId.get(userId) ?? null,
        },
      ];
    }),
  );
}

export async function createManagePayInvoice(payload: {
  invoice_number: string;
  seller_id: string;
  client_id: string;
  client_email: string;
  amount_in_cents: number;
  currency: string;
  description: string;
  due_date?: string | null;
  metadata: ManagePayInvoiceMetadata;
}) {
  const { data, error } = await db.from("managepay_invoices").insert(payload).select("*").single();
  if (error) throw error;
  return hydrateInvoiceCompanyBranding(data as ManagePayInvoice);
}

export async function updateManagePayInvoice(id: string, payload: Partial<ManagePayInvoice>) {
  const { data, error } = await db.from("managepay_invoices").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return hydrateInvoiceCompanyBranding(data as ManagePayInvoice);
}

export async function deleteManagePayInvoice(id: string) {
  const { data: invoice, error: fetchError } = await db
    .from("managepay_invoices")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (invoice?.status === "paid") {
    throw new Error("Paid invoices cannot be deleted");
  }

  const { error } = await db.from("managepay_invoices").delete().eq("id", id).neq("status", "paid");
  if (error) throw error;
}

export async function getPublicManagePayInvoice(invoiceRef: string): Promise<ManagePayInvoice | null> {
  const { data, error } = await db.rpc("get_managepay_public_invoice", { _invoice_ref: invoiceRef });
  if (error) throw error;
  const invoice = ((data ?? [])[0] ?? null) as ManagePayInvoice | null;
  return invoice ? hydrateInvoiceCompanyBranding(invoice) : null;
}

export async function listManagePayTerminalTransactions(): Promise<ManagePayTerminalTransaction[]> {
  const { data, error } = await db.from("managepay_terminal_transactions").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as ManagePayTerminalTransaction[];
}

export async function createManagePayTerminalTransaction(payload: Omit<ManagePayTerminalTransaction, "id" | "created_at">) {
  const { data, error } = await db.from("managepay_terminal_transactions").insert(payload).select("*").single();
  if (error) throw error;
  return data as ManagePayTerminalTransaction;
}

async function hydrateInvoiceCompanyBranding(invoice: ManagePayInvoice): Promise<ManagePayInvoice> {
  const company = (invoice.metadata?.company || {}) as {
    id?: string;
    logoUrl?: string | null;
    logo_url?: string | null;
    logoHasDarkBg?: boolean;
    logo_has_dark_bg?: boolean;
  };

  if (!company.id || company.logoUrl || company.logo_url) {
    return invoice;
  }

  const { data, error } = await db
    .from("managepay_companies")
    .select("logo_url,logo_has_dark_bg")
    .eq("id", company.id)
    .maybeSingle();

  if (error || !data?.logo_url) {
    return invoice;
  }

  return {
    ...invoice,
    metadata: {
      ...invoice.metadata,
      company: {
        ...company,
        logoUrl: data.logo_url,
        logo_url: data.logo_url,
        logoHasDarkBg: data.logo_has_dark_bg,
        logo_has_dark_bg: data.logo_has_dark_bg,
      },
    },
  };
}
