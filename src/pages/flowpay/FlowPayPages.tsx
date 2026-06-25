import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  amountToCents,
  centsToAmount,
  clearFlowPayAccessOverride,
  createFlowPayInvoice,
  createFlowPayTerminalTransaction,
  deleteFlowPayClient,
  deleteFlowPayCompany,
  deleteFlowPayInvoice,
  deleteFlowPayService,
  formatFlowPayMoney,
  getInvoiceClientPreviewUrl,
  getInvoicePaymentUrl,
  getPublicFlowPayInvoice,
  listFlowPayAccessCandidates,
  listFlowPayClients,
  listFlowPayCompanies,
  listFlowPayInvoiceCreators,
  listFlowPayInvoices,
  listFlowPayServices,
  listFlowPayTerminalTransactions,
  FlowPayAccessCandidate,
  FlowPayClient,
  FlowPayCompany,
  FlowPayInvoice,
  FlowPayInvoiceCreator,
  FlowPayInvoiceService,
  FlowPayLineItem,
  FlowPayPaymentMethod,
  FlowPayTerminalTransaction,
  saveFlowPayAccessOverride,
  saveFlowPayClient,
  saveFlowPayCompany,
  saveFlowPayService,
  setFlowPayEmployeeCompanyAccess,
  updateFlowPayInvoice,
  uploadFlowPayCompanyLogo,
} from "@/lib/flowpay";
import { cn } from "@/lib/utils";
import { Copy, Eye, ImagePlus, Mail, MessageCircle, Pencil, Plus, QrCode, Search, Trash2 } from "lucide-react";
import { InvoicePaymentView } from "@/pages/flowpay/PublicInvoicePay";
import { useParams } from "react-router-dom";

const includesText = (value: unknown, query: string) => String(value ?? "").toLowerCase().includes(query.toLowerCase().trim());
const newInvoiceNo = () => `INV-${format(new Date(), "yyyyMMdd-HHmmss")}`;
const newLine = (): FlowPayLineItem => ({ id: crypto.randomUUID(), description: "", quantity: 1, rate: 0, amount: 0 });
const formatFlowPayDateTime = (value: string) => {
  try {
    return format(new Date(value), "dd MMM yyyy, h:mm a");
  } catch {
    return value;
  }
};

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "paid" || status === "completed"
      ? "badge-success"
      : status === "pending"
        ? "badge-warning"
        : "badge-destructive";
  return <Badge variant="outline" className={className}>{status}</Badge>;
}

function SearchInput({ value, onChange, placeholder = "Search" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input className="pl-9" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

async function copyText(value: string, title: string, toast: ReturnType<typeof useToast>["toast"]) {
  await navigator.clipboard.writeText(value);
  toast({ title });
}

export function FlowPayDashboardPage() {
  const [invoices, setInvoices] = useState<FlowPayInvoice[]>([]);
  const [clients, setClients] = useState<FlowPayClient[]>([]);
  const [companies, setCompanies] = useState<FlowPayCompany[]>([]);
  const [invoiceCreators, setInvoiceCreators] = useState<Record<string, FlowPayInvoiceCreator>>({});
  const [companyFilter, setCompanyFilter] = useState("all");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const refresh = async () => {
      const [nextInvoices, nextClients, nextCompanies] = await Promise.all([listFlowPayInvoices(), listFlowPayClients(), listFlowPayCompanies()]);
      setInvoices(nextInvoices);
      setClients(nextClients);
      setCompanies(nextCompanies);
      setInvoiceCreators(isAdmin ? await listFlowPayInvoiceCreators(nextInvoices.map((invoice) => invoice.seller_id)) : {});
    };

    void refresh();
  }, [isAdmin]);

  const visibleInvoices = invoices.filter((invoice) => {
    if (companyFilter === "all") return true;
    const company = invoice.metadata?.company as { id?: string } | undefined;
    return company?.id === companyFilter;
  });

  const paidRevenue = visibleInvoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.amount_in_cents, 0);
  const totalInvoiced = visibleInvoices.reduce((sum, invoice) => sum + invoice.amount_in_cents, 0);
  const pending = visibleInvoices.filter((invoice) => invoice.status === "pending").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="FlowPay Dashboard" description="Revenue, payment links, clients, and invoice status in one operational view." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Filter by company" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Paid revenue", formatFlowPayMoney(paidRevenue)],
          ["Total invoiced", formatFlowPayMoney(totalInvoiced)],
          ["Invoices", String(visibleInvoices.length)],
          ["Pending", String(pending)],
          ["Active clients", String(clients.filter((client) => client.is_active).length)],
        ].map(([label, value]) => (
          <Card key={label} className="card-elevated">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 truncate text-xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">Recent invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <InvoicesTable
            invoices={visibleInvoices.slice(0, 8)}
            creators={invoiceCreators}
            showCreator={isAdmin}
            onRefresh={async () => {
              const nextInvoices = await listFlowPayInvoices();
              setInvoices(nextInvoices);
              setInvoiceCreators(isAdmin ? await listFlowPayInvoiceCreators(nextInvoices.map((invoice) => invoice.seller_id)) : {});
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function FlowPayCompaniesPage() {
  const [companies, setCompanies] = useState<FlowPayCompany[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FlowPayCompany | null>(null);
  const [form, setForm] = useState({ name: "", email: "", address: "", phone: "", website: "", logo_url: "", payment_base_url: "", tax_id: "", logo_has_dark_bg: false, is_active: true });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const refresh = () => listFlowPayCompanies().then(setCompanies);
  useEffect(() => { void refresh(); }, []);

  const reset = () => {
    setEditing(null);
    setLogoFile(null);
    setForm({ name: "", email: "", address: "", phone: "", website: "", logo_url: "", payment_base_url: "", tax_id: "", logo_has_dark_bg: false, is_active: true });
  };

  const save = async () => {
    try {
      setIsUploadingLogo(true);
      const logoUrl = logoFile ? await uploadFlowPayCompanyLogo(logoFile, form.name) : form.logo_url;
      await saveFlowPayCompany({ ...form, logo_url: logoUrl }, editing?.id);
      reset();
      await refresh();
      toast({ title: editing ? "Company updated" : "Company created" });
    } catch (error) {
      toast({ title: "Company save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const visible = companies.filter((company) => [company.name, company.email, company.phone, company.website].some((value) => includesText(value, search)));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Companies" description="Manage invoice brands, contact details, uploaded logos, and payment base URLs." />
      {isAdmin ? (
        <Card className="card-elevated">
          <CardHeader><CardTitle className="text-base">{editing ? "Edit company" : "Add company"}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="managepay-company-logo">Logo</Label>
              <Input id="managepay-company-logo" type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            </div>
            <Input placeholder="Payment base URL" value={form.payment_base_url} onChange={(e) => setForm({ ...form, payment_base_url: e.target.value })} />
            <Input placeholder="Tax ID" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
            <Input className="md:col-span-2" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            {(logoFile || form.logo_url) ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3 md:col-span-2">
                <div className={cn("flex h-14 w-24 items-center justify-center rounded-md border border-border bg-card", form.logo_has_dark_bg && "bg-foreground")}>
                  {logoFile ? (
                    <img src={URL.createObjectURL(logoFile)} alt="Selected logo preview" className="max-h-12 max-w-20 object-contain" />
                  ) : form.logo_url ? (
                    <img src={form.logo_url} alt="Company logo preview" className="max-h-12 max-w-20 object-contain" />
                  ) : (
                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{logoFile?.name || "Current logo"}</p>
                  <p className="text-xs text-muted-foreground">{logoFile ? "Ready to upload on save" : "Stored in company branding"}</p>
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <Switch checked={form.logo_has_dark_bg} onCheckedChange={(checked) => setForm({ ...form, logo_has_dark_bg: checked })} />
              <Label>Logo needs dark background</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
              <Label>Active</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={isUploadingLogo}>{isUploadingLogo ? "Saving..." : editing ? "Update" : "Create"}</Button>
              {editing ? <Button variant="outline" onClick={reset}>Cancel</Button> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card className="card-elevated">
        <CardHeader><SearchInput value={search} onChange={setSearch} /></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Payment URL</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>
              {visible.map((company) => (
                <TableRow key={company.id}>
                  <TableCell><div className="font-medium">{company.name}</div><div className="text-xs text-muted-foreground">{company.email}</div></TableCell>
                  <TableCell>{company.payment_base_url || "Current app origin"}</TableCell>
                  <TableCell>{company.is_active ? <Badge className="badge-success">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(company); setLogoFile(null); setForm({ name: company.name, email: company.email, address: company.address || "", phone: company.phone || "", website: company.website || "", logo_url: company.logo_url || "", payment_base_url: company.payment_base_url || "", tax_id: company.tax_id || "", logo_has_dark_bg: company.logo_has_dark_bg, is_active: company.is_active }); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={async () => { if (window.confirm(`Delete ${company.name}?`)) { await deleteFlowPayCompany(company.id); await refresh(); } }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function FlowPayClientsPage() {
  const [clients, setClients] = useState<FlowPayClient[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FlowPayClient | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company_name: "", phone: "", address: "", notes: "", is_active: true });
  const { user } = useAuth();
  const { toast } = useToast();
  const refresh = () => listFlowPayClients().then(setClients);
  useEffect(() => { void refresh(); }, []);

  const reset = () => {
    setEditing(null);
    setForm({ name: "", email: "", company_name: "", phone: "", address: "", notes: "", is_active: true });
  };

  const save = async () => {
    if (!user?.id) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: "Client name and email are required", variant: "destructive" });
      return;
    }

    try {
      await saveFlowPayClient({ ...form, name: form.name.trim(), email: form.email.trim(), user_id: user.id }, editing?.id);
      reset();
      await refresh();
      toast({ title: editing ? "Client updated" : "Client created" });
    } catch (error) {
      toast({ title: "Client save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const visible = clients.filter((client) => [client.name, client.email, client.company_name, client.phone, client.address].some((value) => includesText(value, search)));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Clients" description="Saved recipients for invoices and payment links." />
      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">{editing ? "Edit client" : "Add client"}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="managepay-client-name">Name <span className="text-destructive">*</span></Label>
            <Input id="managepay-client-name" required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="managepay-client-email">Email <span className="text-destructive">*</span></Label>
            <Input id="managepay-client-email" required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <Input placeholder="Company name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input className="md:col-span-2" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Textarea className="md:col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
            <Label>Active</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
            {editing ? <Button variant="outline" onClick={reset}>Cancel</Button> : null}
          </div>
        </CardContent>
      </Card>
      <Card className="card-elevated">
        <CardHeader><SearchInput value={search} onChange={setSearch} /></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Contact</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>
              {visible.map((client) => (
                <TableRow key={client.id}>
                  <TableCell><div className="font-medium">{client.name}</div><div className="text-xs text-muted-foreground">{client.company_name || "Individual"}</div></TableCell>
                  <TableCell><div>{client.email}</div><div className="text-xs text-muted-foreground">{client.phone}</div></TableCell>
                  <TableCell>{client.is_active ? <Badge className="badge-success">Active</Badge> : <Badge variant="outline">Archived</Badge>}</TableCell>
                  <TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => { setEditing(client); setForm({ name: client.name, email: client.email, company_name: client.company_name || "", phone: client.phone || "", address: client.address || "", notes: client.notes || "", is_active: client.is_active }); }}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={async () => { if (window.confirm(`Delete ${client.name}?`)) { await deleteFlowPayClient(client.id); await refresh(); } }}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function FlowPayInvoicesPage() {
  const [companies, setCompanies] = useState<FlowPayCompany[]>([]);
  const [clients, setClients] = useState<FlowPayClient[]>([]);
  const [services, setServices] = useState<FlowPayInvoiceService[]>([]);
  const [invoices, setInvoices] = useState<FlowPayInvoice[]>([]);
  const [shareInvoice, setShareInvoice] = useState<FlowPayInvoice | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(newInvoiceNo());
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 14), "yyyy-MM-dd"));
  const [currency, setCurrency] = useState("GBP");
  const [taxRate, setTaxRate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<FlowPayLineItem[]>([]);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", email: "", company_name: "", phone: "", address: "", notes: "" });
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [customServiceOpen, setCustomServiceOpen] = useState(false);
  const [customServiceForm, setCustomServiceForm] = useState({ name: "", description: "", rate: "500" });
  const { user } = useAuth();
  const { toast } = useToast();

  const refresh = async () => {
    const [nextCompanies, nextClients, nextServices, nextInvoices] = await Promise.all([
      listFlowPayCompanies(true),
      listFlowPayClients(),
      listFlowPayServices(),
      listFlowPayInvoices(),
    ]);
    const activeClients = nextClients.filter((client) => client.is_active);
    setCompanies(nextCompanies);
    setClients(activeClients);
    setServices(nextServices);
    setInvoices(nextInvoices);
    if (!nextCompanies.some((company) => company.id === companyId)) setCompanyId(nextCompanies[0]?.id ?? "");
    if (!activeClients.some((client) => client.id === clientId)) setClientId(activeClients[0]?.id ?? "");
  };

  useEffect(() => { void refresh(); }, []);

  const selectedCompany = companies.find((company) => company.id === companyId);
  const selectedClient = clients.find((client) => client.id === clientId);
  const subtotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const tax = subtotal * (Number(taxRate || 0) / 100);
  const total = subtotal + tax;

  const updateItem = (id: string, updates: Partial<FlowPayLineItem>) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...updates };
      next.amount = 1 * Number(next.rate || 0);
      return next;
    }));
  };

  const addService = (service: FlowPayInvoiceService) => {
    const newItem: FlowPayLineItem = {
      id: crypto.randomUUID(),
      serviceId: service.id,
      serviceName: service.name,
      description: service.description || service.name,
      quantity: 1,
      rate: centsToAmount(service.default_rate),
      amount: centsToAmount(service.default_rate),
    };
    setItems((prev) => [...prev, newItem]);
  };

  const addCustomService = () => {
    const newItem: FlowPayLineItem = {
      id: crypto.randomUUID(),
      serviceName: customServiceForm.name,
      description: customServiceForm.description,
      quantity: 1,
      rate: Number(customServiceForm.rate),
      amount: Number(customServiceForm.rate),
    };
    setItems((prev) => [...prev, newItem]);
    setCustomServiceForm({ name: "", description: "", rate: "500" });
    setCustomServiceOpen(false);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const resetClientForm = () => {
    setClientForm({ name: "", email: "", company_name: "", phone: "", address: "", notes: "" });
  };

  const createClientFromInvoice = async () => {
    if (!user?.id) return;
    if (!clientForm.name.trim() || !clientForm.email.trim()) {
      toast({ title: "Client name and email are required", variant: "destructive" });
      return;
    }

    try {
      setIsSavingClient(true);
      const client = await saveFlowPayClient({
        ...clientForm,
        user_id: user.id,
        name: clientForm.name.trim(),
        email: clientForm.email.trim(),
        is_active: true,
      });
      setClients((current) => [client, ...current.filter((entry) => entry.id !== client.id)]);
      setClientId(client.id);
      resetClientForm();
      setClientDialogOpen(false);
      toast({ title: "Client added and selected" });
    } catch (error) {
      toast({ title: "Client save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSavingClient(false);
    }
  };

  const saveInvoice = async () => {
    if (!user?.id) return;
    if (!selectedCompany) {
      toast({ title: "No company access", description: "Ask an admin to assign at least one FlowPay company.", variant: "destructive" });
      return;
    }
    if (!selectedClient) {
      toast({ title: "Select or add a client", variant: "destructive" });
      return;
    }
    const meaningfulItems = items.filter((item) => item.description.trim() && item.amount > 0);
    if (meaningfulItems.length === 0) {
      toast({ title: "Add at least one service to the invoice", variant: "destructive" });
      return;
    }

    try {
      const metadata = {
        company: {
          id: selectedCompany.id,
          name: selectedCompany.name,
          email: selectedCompany.email,
          address: selectedCompany.address,
          phone: selectedCompany.phone,
          website: selectedCompany.website,
          logoUrl: selectedCompany.logo_url,
          logo_url: selectedCompany.logo_url,
          logoHasDarkBg: selectedCompany.logo_has_dark_bg,
          logo_has_dark_bg: selectedCompany.logo_has_dark_bg,
          paymentBaseUrl: selectedCompany.payment_base_url,
          payment_base_url: selectedCompany.payment_base_url,
          taxId: selectedCompany.tax_id,
          tax_id: selectedCompany.tax_id,
        },
        client: {
          name: selectedClient.name,
          email: selectedClient.email,
          companyName: selectedClient.company_name,
          address: selectedClient.address,
        },
        items: meaningfulItems,
        subtotal,
        tax,
        taxRate: Number(taxRate || 0),
        total,
        notes,
      };
      const invoice = await createFlowPayInvoice({
        invoice_number: invoiceNumber,
        seller_id: user.id,
        client_id: selectedClient.id,
        client_email: selectedClient.email,
        amount_in_cents: amountToCents(total),
        currency: currency.toLowerCase(),
        description: meaningfulItems[0]?.description || invoiceNumber,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        metadata,
      });
      const withUrl = await updateFlowPayInvoice(invoice.id, { metadata: { ...metadata, paymentUrl: getInvoicePaymentUrl({ ...invoice, metadata }) } as Partial<FlowPayInvoiceMetadata> });
      setShareInvoice(withUrl);
      setInvoiceNumber(newInvoiceNo());
      setItems([]);
      setNotes("");
      await refresh();
      toast({ title: "Invoice saved" });
    } catch (error) {
      toast({ title: "Invoice save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Invoice Generator" description="Create branded invoices with saved clients, services, taxes, and public payment links." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="card-elevated">
          <CardHeader><CardTitle className="text-base">Draft invoice</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Select value={companyId} onValueChange={setCompanyId}><SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger><SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent></Select>
              <div className="flex gap-2">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="Client" /></SelectTrigger>
                  <SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" title="Add client" onClick={() => setClientDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["GBP", "USD", "PKR", "EUR"].map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select>
              <Input type="number" min="0" placeholder="Tax %" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-3">Select services</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => addService(service)}
                    className="inline-flex items-center gap-2 rounded-full bg-secondary/50 px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-secondary hover:scale-105 active:scale-95"
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    {service.name}
                  </button>
                ))}
                <button
                  onClick={() => setCustomServiceOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground hover:scale-105 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  Custom Service
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium mb-3">Invoice items</h4>
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-secondary/10 p-8 text-center">
                  <p className="text-sm text-muted-foreground">Select services from above to add them to your invoice</p>
                </div>
              )}
              {items.map((item, index) => (
                <div key={item.id} className="group relative flex items-end gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:shadow-sm">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-2 pl-3">
                    <p className="font-semibold">{item.serviceName || item.description}</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, { description: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Rate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency.toUpperCase()}</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.rate}
                            onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) })}
                            className="h-8 pl-10 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Label className="text-xs text-muted-foreground">Amount</Label>
                    <p className="text-lg font-semibold">{formatFlowPayMoney(amountToCents(item.amount), currency)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            
            <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex justify-end"><Button onClick={saveInvoice} disabled={!selectedCompany || !selectedClient}>Save Invoice</Button></div>
          </CardContent>
        </Card>
        <InvoicePreview company={selectedCompany} client={selectedClient} invoiceNumber={invoiceNumber} dueDate={dueDate} currency={currency} items={items} subtotal={subtotal} tax={tax} total={total} notes={notes} />
      </div>
      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">Saved invoices</CardTitle></CardHeader>
        <CardContent className="p-0"><InvoicesTable invoices={invoices} onRefresh={refresh} onShare={setShareInvoice} /></CardContent>
      </Card>
      <ShareDialog invoice={shareInvoice} onOpenChange={(open) => { if (!open) setShareInvoice(null); }} />
      <Dialog open={clientDialogOpen} onOpenChange={(open) => { setClientDialogOpen(open); if (!open) resetClientForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add client</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-client-name">Name <span className="text-destructive">*</span></Label>
              <Input id="invoice-client-name" required value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-client-email">Email <span className="text-destructive">*</span></Label>
              <Input id="invoice-client-email" required type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-client-company">Company</Label>
              <Input id="invoice-client-company" value={clientForm.company_name} onChange={(e) => setClientForm({ ...clientForm, company_name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-client-phone">Phone</Label>
              <Input id="invoice-client-phone" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="invoice-client-address">Address</Label>
              <Input id="invoice-client-address" value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="invoice-client-notes">Notes</Label>
              <Textarea id="invoice-client-notes" value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setClientDialogOpen(false)}>Cancel</Button>
              <Button type="button" onClick={createClientFromInvoice} disabled={isSavingClient}>{isSavingClient ? "Saving..." : "Add and select"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={customServiceOpen} onOpenChange={setCustomServiceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Custom Service</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="custom-service-name">Service name</Label>
              <Input id="custom-service-name" value={customServiceForm.name} onChange={(e) => setCustomServiceForm({ ...customServiceForm, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="custom-service-description">Description</Label>
              <Input id="custom-service-description" value={customServiceForm.description} onChange={(e) => setCustomServiceForm({ ...customServiceForm, description: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="custom-service-rate">Rate</Label>
              <Input id="custom-service-rate" type="number" step="0.01" min="0" value={customServiceForm.rate} onChange={(e) => setCustomServiceForm({ ...customServiceForm, rate: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCustomServiceOpen(false)}>Cancel</Button>
              <Button type="button" onClick={addCustomService}>Add Service</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoicePreview({ company, client, invoiceNumber, dueDate, currency, items, subtotal, tax, total, notes }: { company?: FlowPayCompany; client?: FlowPayClient; invoiceNumber: string; dueDate: string; currency: string; items: FlowPayLineItem[]; subtotal: number; tax: number; total: number; notes: string }) {
  return (
    <Card className="card-elevated">
      <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            {company?.logo_url ? (
              <div className={cn(
                "flex h-14 min-w-0 max-w-[190px] shrink items-center justify-start rounded-lg p-2",
                company.logo_has_dark_bg ? "bg-slate-900" : "bg-white"
              )}>
                <img src={company.logo_url} alt={company.name || "Company logo"} className="max-h-12 max-w-full object-contain" />
              </div>
            ) : null}
            <div className="shrink-0 text-right">
              <p className="text-sm text-muted-foreground">Invoice</p>
              <p className="max-w-[190px] truncate font-semibold" title={invoiceNumber}>{invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">Due {dueDate}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <p className="text-lg font-semibold">{company?.name || "Company"}</p>
              <p className="text-sm text-muted-foreground">{company?.email}</p>
              <p className="text-sm text-muted-foreground">{company?.address}</p>
            </div>
          </div>
        </div>
        <div className="surface-tile">
          <p className="text-xs text-muted-foreground">Bill to</p>
          <p className="font-medium">{client?.name || "Client"}</p>
          <p className="text-sm text-muted-foreground">{client?.email}</p>
        </div>
        <div className="flex flex-col gap-2">
          {items.filter((item) => item.description).map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <span>{item.description}</span>
              <span>{formatFlowPayMoney(amountToCents(item.amount), currency)}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatFlowPayMoney(amountToCents(subtotal), currency)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{formatFlowPayMoney(amountToCents(tax), currency)}</span></div>
          <div className="mt-2 flex justify-between text-lg font-semibold"><span>Total</span><span>{formatFlowPayMoney(amountToCents(total), currency)}</span></div>
        </div>
        {notes ? <p className="text-sm text-muted-foreground">{notes}</p> : null}
      </CardContent>
    </Card>
  );
}

function InvoicesTable({
  invoices,
  onRefresh,
  onShare,
  creators = {},
  showCreator = false,
}: {
  invoices: FlowPayInvoice[];
  onRefresh: () => void | Promise<void>;
  onShare?: (invoice: FlowPayInvoice) => void;
  creators?: Record<string, FlowPayInvoiceCreator>;
  showCreator?: boolean;
}) {
  const { toast } = useToast();

  const removeInvoice = async (invoice: FlowPayInvoice) => {
    if (invoice.status === "paid") {
      toast({ title: "Paid invoices cannot be deleted", description: "This invoice has already been paid and must remain in the record." });
      return;
    }

    if (!window.confirm(`Delete invoice ${invoice.invoice_number}? This cannot be undone.`)) return;

    try {
      await deleteFlowPayInvoice(invoice.id);
      await onRefresh();
      toast({ title: "Invoice deleted" });
    } catch (error) {
      toast({ title: "Invoice delete failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No</TableHead>
            <TableHead>Client</TableHead>
            {showCreator ? <TableHead>Created by</TableHead> : null}
            <TableHead>Company</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-36" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const company = invoice.metadata?.company as { name?: string } | undefined;
            const client = invoice.metadata?.client as { name?: string } | undefined;
            const creator = creators[invoice.seller_id];
            const paymentUrl = getInvoicePaymentUrl(invoice);
            return (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.invoice_number}</TableCell>
                <TableCell>{client?.name || invoice.client_email}</TableCell>
                {showCreator ? (
                  <TableCell>
                    <div className="font-medium">{creator?.full_name || "Unknown user"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFlowPayDateTime(invoice.created_at)}
                      {creator?.employee_code ? ` - ${creator.employee_code}` : ""}
                    </div>
                  </TableCell>
                ) : null}
                <TableCell>{company?.name || "Company"}</TableCell>
                <TableCell>{formatFlowPayMoney(invoice.amount_in_cents, invoice.currency)}</TableCell>
                <TableCell><StatusBadge status={invoice.status} /></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" title="View as client" onClick={() => window.open(getInvoiceClientPreviewUrl(invoice), "_blank", "noopener,noreferrer")}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => copyText(paymentUrl, "Payment link copied", toast)}><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onShare?.(invoice)}><QrCode className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Delete invoice" onClick={() => removeInvoice(invoice)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ShareDialog({ invoice, onOpenChange }: { invoice: FlowPayInvoice | null; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  if (!invoice) return null;
  const link = getInvoicePaymentUrl(invoice);
  const subject = encodeURIComponent(`Invoice ${invoice.invoice_number}`);
  const body = encodeURIComponent(`Please use this link to view and pay invoice ${invoice.invoice_number}: ${link}`);
  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Share invoice {invoice.invoice_number}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <Input readOnly value={link} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="outline" onClick={() => copyText(link, "Payment link copied", toast)}><Copy className="h-4 w-4" />Copy</Button>
            <Button variant="outline" onClick={() => window.open(`mailto:${invoice.client_email}?subject=${subject}&body=${body}`)}><Mail className="h-4 w-4" />Email</Button>
            <Button variant="outline" onClick={() => window.open(`https://wa.me/?text=${body}`)}><MessageCircle className="h-4 w-4" />WhatsApp</Button>
            <Button variant="outline" onClick={() => window.open(`sms:?&body=${body}`)}><MessageCircle className="h-4 w-4" />SMS</Button>
          </div>
          <div className="surface-tile text-center text-sm text-muted-foreground">QR/PDF export is ready for provider wiring; this first version keeps the link authoritative.</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FlowPayTerminalPage() {
  const [transactions, setTransactions] = useState<FlowPayTerminalTransaction[]>([]);
  const [form, setForm] = useState({ amount: "", currency: "GBP", description: "", customer_email: "", customer_name: "", customer_phone: "", payment_method: "card" as FlowPayPaymentMethod });
  const { user } = useAuth();
  const { toast } = useToast();
  const refresh = () => listFlowPayTerminalTransactions().then(setTransactions);
  useEffect(() => { void refresh(); }, []);

  const amount = Number(form.amount || 0);
  const fee = amount * 0.029 + 0.2;
  const total = amount + fee;

  const processPayment = async () => {
    if (!user?.id || amount <= 0) return;
    try {
      await createFlowPayTerminalTransaction({
        user_id: user.id,
        amount_in_cents: amountToCents(amount),
        fee_in_cents: amountToCents(fee),
        total_in_cents: amountToCents(total),
        currency: form.currency.toLowerCase(),
        description: form.description,
        customer_email: form.customer_email,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        payment_method: form.payment_method,
        status: form.payment_method === "card" ? "pending" : "completed",
        provider_reference: null,
        metadata: { simulated: form.payment_method !== "card" },
      });
      await refresh();
      toast({ title: form.payment_method === "card" ? "Card intent placeholder saved" : "Transaction completed" });
    } catch (error) {
      toast({ title: "Terminal failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Payment Terminal" description="Capture one-off payment details and prepare card, mobile, QR, or payment-link flows." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="card-elevated">
          <CardHeader><CardTitle className="text-base">New terminal payment</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input type="number" min="0" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Select value={form.currency} onValueChange={(currency) => setForm({ ...form, currency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["GBP", "USD", "PKR", "EUR"].map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select>
            <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input placeholder="Customer email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            <Input placeholder="Customer name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            <Input placeholder="Customer phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            <Select value={form.payment_method} onValueChange={(payment_method: FlowPayPaymentMethod) => setForm({ ...form, payment_method })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="card">Card</SelectItem><SelectItem value="mobile">Mobile payment</SelectItem><SelectItem value="qr">QR payment</SelectItem><SelectItem value="payment_link">Payment link</SelectItem></SelectContent></Select>
            <div className="surface-tile text-sm">
              <div className="flex justify-between"><span>Processing fee</span><span>{formatFlowPayMoney(amountToCents(fee), form.currency)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatFlowPayMoney(amountToCents(total), form.currency)}</span></div>
            </div>
            <Button onClick={processPayment}>Process</Button>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader><CardTitle className="text-base">Terminal history</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Method</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{transactions.map((transaction) => <TableRow key={transaction.id}><TableCell>{format(new Date(transaction.created_at), "PP p")}</TableCell><TableCell>{transaction.customer_name || transaction.customer_email || "Walk-in"}</TableCell><TableCell>{transaction.payment_method}</TableCell><TableCell>{formatFlowPayMoney(transaction.total_in_cents, transaction.currency)}</TableCell><TableCell><StatusBadge status={transaction.status} /></TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function FlowPaySettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [services, setServices] = useState<FlowPayInvoiceService[]>([]);
  const [accessRows, setAccessRows] = useState<FlowPayAccessCandidate[]>([]);
  const [companies, setCompanies] = useState<FlowPayCompany[]>([]);
  const [companySelections, setCompanySelections] = useState<Record<string, string[]>>({});
  const [serviceForm, setServiceForm] = useState({ name: "", description: "", default_rate: "" });
  const [search, setSearch] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const { toast } = useToast();

  const refresh = async () => {
    const [nextServices, nextAccess, nextCompanies] = await Promise.all([
      listFlowPayServices(),
      isAdmin ? listFlowPayAccessCandidates() : Promise.resolve([]),
      isAdmin ? listFlowPayCompanies() : Promise.resolve([]),
    ]);
    setServices(nextServices);
    setAccessRows(nextAccess);
    setCompanies(nextCompanies);
    setCompanySelections(Object.fromEntries(nextAccess.map((row) => [row.employee_id, row.allowed_company_ids ?? []])));
  };
  useEffect(() => { void refresh(); }, [isAdmin]);

  const saveService = async () => {
    try {
      await saveFlowPayService({ name: serviceForm.name, description: serviceForm.description, default_rate: amountToCents(Number(serviceForm.default_rate || 0)) });
      setServiceForm({ name: "", description: "", default_rate: "" });
      await refresh();
      toast({ title: "Service saved" });
    } catch (error) {
      toast({ title: "Service save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const setOverride = async (employeeId: string, allowed: boolean | null) => {
    try {
      if (allowed === null) await clearFlowPayAccessOverride(employeeId);
      else await saveFlowPayAccessOverride(employeeId, allowed);
      await refresh();
      toast({ title: "Access updated" });
    } catch (error) {
      toast({ title: "Access update failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const toggleCompanyAccess = (employeeId: string, companyId: string, checked: boolean) => {
    setCompanySelections((current) => {
      const selected = new Set(current[employeeId] ?? []);
      if (checked) selected.add(companyId);
      else selected.delete(companyId);
      return { ...current, [employeeId]: Array.from(selected) };
    });
  };

  const saveCompanyAccess = async (row: FlowPayAccessCandidate) => {
    try {
      await setFlowPayEmployeeCompanyAccess(row.employee_id, companySelections[row.employee_id] ?? []);
      await refresh();
      toast({ title: "Company access saved" });
    } catch (error) {
      toast({ title: "Company access failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const filteredAccessRows = accessRows.filter((row) => {
    // Search filter
    const matchesSearch = [row.full_name, row.employee_code, row.department_name].some((value) =>
      includesText(value, search)
    );
    if (!matchesSearch) return false;

    // Department filter
    if (filterDepartment !== "all" && row.department_name !== filterDepartment) {
      return false;
    }

    // Status filter
    if (filterStatus === "allowed" && !row.effective_access) return false;
    if (filterStatus === "blocked" && row.effective_access) return false;

    // Company filter
    if (filterCompany !== "all" && !row.allowed_company_ids.includes(filterCompany)) {
      return false;
    }

    return true;
  });

  // Get unique departments for filter dropdown
  const departments = Array.from(new Set(accessRows.map((row) => row.department_name).filter(Boolean))).sort() as string[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="FlowPay Settings" description="Control reusable services, module access, and company permissions." />
      <Tabs defaultValue="services">
        <TabsList><TabsTrigger value="services">Services</TabsTrigger>{isAdmin ? <TabsTrigger value="access">Access</TabsTrigger> : null}</TabsList>
        <TabsContent value="services">
          <Card className="card-elevated">
            <CardHeader><CardTitle className="text-base">Invoice services</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              {isAdmin ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Input placeholder="Service name" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} />
                  <Input placeholder="Description" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} />
                  <Input type="number" min="0" placeholder="Default rate" value={serviceForm.default_rate} onChange={(e) => setServiceForm({ ...serviceForm, default_rate: e.target.value })} />
                  <Button onClick={saveService}>Add Service</Button>
                </div>
              ) : null}
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Default rate</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
                <TableBody>{services.map((service) => <TableRow key={service.id}><TableCell>{service.name}</TableCell><TableCell>{service.description}</TableCell><TableCell>{formatFlowPayMoney(service.default_rate)}</TableCell><TableCell>{isAdmin ? <Button size="icon" variant="ghost" onClick={async () => { await deleteFlowPayService(service.id); await refresh(); }}><Trash2 className="h-4 w-4" /></Button> : null}</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="access">
            <Card className="card-elevated">
              <CardHeader className="flex flex-col gap-4">
                <CardTitle className="text-base">Employee FlowPay access</CardTitle>
                <div className="flex flex-col gap-3">
                  <SearchInput value={search} onChange={setSearch} placeholder="Search by name, code, or department..." />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="allowed">Allowed</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterCompany} onValueChange={setFilterCompany}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="All companies" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All companies</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(filterDepartment !== "all" || filterStatus !== "all" || filterCompany !== "all") && (
                    <div className="text-xs text-muted-foreground">
                      Showing {filteredAccessRows.length} of {accessRows.length} employee{accessRows.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {filteredAccessRows.map((row) => {
                  const selectedCompanies = companySelections[row.employee_id] ?? [];
                  return (
                    <div key={row.employee_id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{row.full_name}</p>
                            {row.effective_access ? <Badge className="badge-success">Allowed</Badge> : <Badge variant="outline">Blocked</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{row.employee_code} · {row.department_name || "Unassigned"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.override_allowed === null ? "Default blocked" : row.override_allowed ? "Explicit allow" : "Explicit deny"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => setOverride(row.employee_id, true)}>Allow module</Button>
                          <Button size="sm" variant="outline" onClick={() => setOverride(row.employee_id, false)}>Deny</Button>
                          <Button size="sm" variant="ghost" onClick={() => setOverride(row.employee_id, null)}>Default</Button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium">Company access</p>
                            <p className="text-xs text-muted-foreground">Controls which companies this employee can see and invoice from.</p>
                          </div>
                          <Button size="sm" onClick={() => saveCompanyAccess(row)}>Save companies</Button>
                        </div>
                        {companies.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {companies.map((company) => (
                              <label key={company.id} className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                                <Checkbox
                                  checked={selectedCompanies.includes(company.id)}
                                  onCheckedChange={(checked) => toggleCompanyAccess(row.employee_id, company.id, checked === true)}
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{company.name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">{company.email}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">No companies have been created yet.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

export function FlowPayClientPreviewPage() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState<FlowPayInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invoiceId) return;
    void getPublicFlowPayInvoice(invoiceId)
      .then((next) => {
        setInvoice(next);
        setError(next ? "" : "Invoice not found");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Invoice not found"))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) {
    return (
      <Card className="card-elevated">
        <CardContent className="p-6 text-sm text-muted-foreground">Loading client preview...</CardContent>
      </Card>
    );
  }

  if (error || !invoice) {
    return (
      <Card className="card-elevated">
        <CardContent className="p-6">
          <h1 className="text-xl font-semibold">Invoice unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || "This invoice could not be loaded."}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Client View" description="Internal preview of the public invoice payment page." />
      <div className="overflow-hidden rounded-lg border border-border">
        <InvoicePaymentView invoice={invoice} />
      </div>
    </div>
  );
}
