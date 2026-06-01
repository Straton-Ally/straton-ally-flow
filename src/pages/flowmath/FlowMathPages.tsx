import { useEffect, useMemo, useState } from "react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, Pencil, Search, Trash2, X } from "lucide-react";
import {
  createAccount,
  createDocument,
  createJournalEntry,
  createPayrollRun,
  clearFlowMathAccessOverride,
  deleteAccount,
  deleteCounterparty,
  deleteDocument,
  deleteJournalEntry,
  FlowMathAccount,
  FlowMathAccessCandidate,
  FlowMathCounterparty,
  FlowMathDocument,
  FlowMathDocumentLine,
  FlowMathDocumentType,
  FlowMathJournalEntry,
  FlowMathJournalLine,
  FlowMathPayrollItem,
  FlowMathPayrollRun,
  getFlowMathDashboard,
  getFlowMathSettings,
  listAccounts,
  listCounterparties,
  listDocumentLines,
  listDocuments,
  listFlowMathAccessCandidates,
  listJournalEntries,
  listJournalLines,
  listPayrollItems,
  listPayrollRuns,
  markPayrollPaid,
  postDocument,
  postJournalEntry,
  postPayrollRun,
  saveCounterparty,
  saveFlowMathAccessOverride,
  updateAccount,
  updateDocument,
  updateFlowMathSettings,
  updateJournalEntry,
  updatePayrollItem,
  unpostManualJournalEntry,
} from "@/lib/flowmath";
import { formatFlowMathCurrency, getJournalTotals, isBalancedJournal } from "@/lib/flowmath-calculations";

type JournalDraftLine = { account_id: string; description: string; debit: number; credit: number };

const blankJournalLines: JournalDraftLine[] = [
  { account_id: "", description: "", debit: 0, credit: 0 },
  { account_id: "", description: "", debit: 0, credit: 0 },
];

const includesText = (value: unknown, query: string) => String(value ?? "").toLowerCase().includes(query.toLowerCase().trim());

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const exportCsv = (filename: string, headers: string[], rows: unknown[][]) => {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

function TableToolbar({
  search,
  onSearch,
  onExport,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  onExport: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search" value={search} onChange={(event) => onSearch(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}

function IconAction({ label, onClick, children, variant = "ghost" }: { label: string; onClick: () => void; children: React.ReactNode; variant?: "ghost" | "outline" | "destructive" }) {
  return (
    <Button type="button" size="icon" variant={variant} className="h-8 w-8" title={label} aria-label={label} onClick={onClick}>
      {children}
    </Button>
  );
}

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
    status === "posted" || status === "paid"
      ? "badge-success"
      : status === "draft"
        ? "badge-warning"
        : "badge-destructive";
  return <Badge variant="outline" className={className}>{status}</Badge>;
}

function useMoney() {
  const [settings, setSettings] = useState<any>(null);
  useEffect(() => {
    getFlowMathSettings().then(setSettings).catch(() => setSettings(null));
  }, []);
  return (amount: number) => formatFlowMathCurrency(amount, settings);
}

export function FlowMathDashboardPage() {
  const money = useMoney();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getFlowMathDashboard().then(setData).catch(() => setData(null));
  }, []);

  const metrics = useMemo(() => {
    const lines = (data?.lines ?? []) as FlowMathJournalLine[];
    const accountById = new Map((data?.accounts ?? []).map((a: FlowMathAccount) => [a.id, a]));
    const totalByType = (type: string, side: "debit" | "credit") =>
      lines.reduce((sum, line) => {
        const account = accountById.get(line.account_id);
        if (!account || account.account_type !== type) return sum;
        return sum + Number(line[side] || 0);
      }, 0);
    const bank = lines.reduce((sum, line) => {
      const account = accountById.get(line.account_id);
      if (!account?.is_cash) return sum;
      return sum + Number(line.debit || 0) - Number(line.credit || 0);
    }, 0);
    return {
      bank,
      receivables: lines.reduce((sum, line) => accountById.get(line.account_id)?.code === "1100" ? sum + Number(line.debit || 0) - Number(line.credit || 0) : sum, 0),
      payables: lines.reduce((sum, line) => accountById.get(line.account_id)?.code === "2000" ? sum + Number(line.credit || 0) - Number(line.debit || 0) : sum, 0),
      revenue: totalByType("income", "credit") - totalByType("income", "debit"),
      expenses: totalByType("expense", "debit") - totalByType("expense", "credit"),
      payrollPayable: lines.reduce((sum, line) => accountById.get(line.account_id)?.code === "2100" ? sum + Number(line.credit || 0) - Number(line.debit || 0) : sum, 0),
    };
  }, [data]);

  const cards = [
    ["Cash / Bank", metrics.bank],
    ["Receivables", metrics.receivables],
    ["Payables", metrics.payables],
    ["Revenue", metrics.revenue],
    ["Expenses", metrics.expenses],
    ["Payroll Payable", metrics.payrollPayable],
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeader title="FlowMath Dashboard" description="Accounting command center for ledgers, payables, receivables, and payroll." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(([label, value]) => (
          <Card key={label} className="card-elevated">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 truncate text-xl font-semibold">{money(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader><CardTitle className="text-base">Recent Postings</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>No</TableHead><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.journals ?? []).slice(0, 8).map((entry: FlowMathJournalEntry) => (
                  <TableRow key={entry.id}><TableCell>{entry.entry_no}</TableCell><TableCell>{entry.entry_date}</TableCell><TableCell>{entry.source_type}</TableCell><TableCell><StatusBadge status={entry.status} /></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader><CardTitle className="text-base">Open Documents</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>No</TableHead><TableHead>Type</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.docs ?? []).slice(0, 8).map((doc: FlowMathDocument) => (
                  <TableRow key={doc.id}><TableCell>{doc.document_no}</TableCell><TableCell>{doc.document_type}</TableCell><TableCell>{money(doc.total_amount)}</TableCell><TableCell><StatusBadge status={doc.status} /></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function FlowMathAccountsPage() {
  const [accounts, setAccounts] = useState<FlowMathAccount[]>([]);
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", account_type: "expense", normal_balance: "debit", description: "" });
  const { toast } = useToast();

  const refresh = () => listAccounts().then(setAccounts);
  useEffect(() => { void refresh(); }, []);

  const filtered = accounts.filter((account) => {
    const matchesType = type === "all" || account.account_type === type;
    const matchesSearch = [account.code, account.name, account.description].some((value) => includesText(value, search));
    return matchesType && matchesSearch;
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ code: "", name: "", account_type: "expense", normal_balance: "debit", description: "" });
  };

  const handleSave = async () => {
    try {
      if (editingId) await updateAccount(editingId, form as any);
      else await createAccount({ ...form, is_active: true, is_cash: false, is_system: false } as any);
      resetForm();
      await refresh();
      toast({ title: editingId ? "Account updated" : "Account created" });
    } catch (error) {
      toast({ title: "Could not save account", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const edit = (account: FlowMathAccount) => {
    setEditingId(account.id);
    setForm({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      normal_balance: account.normal_balance,
      description: account.description || "",
    });
  };

  const remove = async (account: FlowMathAccount) => {
    if (account.is_system || !window.confirm(`Delete account ${account.code} - ${account.name}?`)) return;
    try {
      await deleteAccount(account.id);
      await refresh();
      toast({ title: "Account deleted" });
    } catch (error) {
      toast({ title: "Could not delete account", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Chart of Accounts" description="Manage system and custom accounts used by journals and documents." />
      <Card className="card-elevated">
        <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-6">
          <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input placeholder="Account name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v, normal_balance: ["asset", "expense"].includes(v) ? "debit" : "credit" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["asset", "liability", "equity", "income", "expense"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.normal_balance} onValueChange={(v) => setForm({ ...form, normal_balance: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="debit">debit</SelectItem><SelectItem value="credit">credit</SelectItem></SelectContent>
          </Select>
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave}>{editingId ? "Update" : "Add"}</Button>
            {editingId ? <IconAction label="Cancel edit" onClick={resetForm}><X className="h-4 w-4" /></IconAction> : null}
          </div>
        </CardContent>
      </Card>
      <Card className="card-elevated">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Accounts</CardTitle>
          <TableToolbar
            search={search}
            onSearch={setSearch}
            onExport={() => exportCsv("flowmath-accounts.csv", ["Code", "Name", "Type", "Normal", "System", "Cash"], filtered.map((account) => [account.code, account.name, account.account_type, account.normal_balance, account.is_system, account.is_cash]))}
          >
            <Select value={type} onValueChange={setType}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{["asset", "liability", "equity", "income", "expense"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
          </TableToolbar>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Normal</TableHead><TableHead>Flags</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>{filtered.map((account) => <TableRow key={account.id}><TableCell>{account.code}</TableCell><TableCell>{account.name}</TableCell><TableCell>{account.account_type}</TableCell><TableCell>{account.normal_balance}</TableCell><TableCell>{account.is_system ? <Badge variant="secondary">system</Badge> : null} {account.is_cash ? <Badge>cash</Badge> : null}</TableCell><TableCell><div className="flex justify-end gap-1"><IconAction label="Edit account" onClick={() => edit(account)}><Pencil className="h-4 w-4" /></IconAction>{!account.is_system ? <IconAction label="Delete account" onClick={() => remove(account)}><Trash2 className="h-4 w-4" /></IconAction> : null}</div></TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function FlowMathJournalPage() {
  const [accounts, setAccounts] = useState<FlowMathAccount[]>([]);
  const [entries, setEntries] = useState<FlowMathJournalEntry[]>([]);
  const [lines, setLines] = useState<JournalDraftLine[]>(blankJournalLines);
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [memo, setMemo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { toast } = useToast();
  const money = useMoney();
  const totals = getJournalTotals(lines);

  const refresh = async () => {
    const [nextAccounts, nextEntries] = await Promise.all([listAccounts(), listJournalEntries()]);
    setAccounts(nextAccounts);
    setEntries(nextEntries);
  };
  useEffect(() => { void refresh(); }, []);

  const filteredEntries = entries.filter((entry) => {
    const matchesStatus = status === "all" || entry.status === status;
    const matchesSearch = [entry.entry_no, entry.entry_date, entry.memo, entry.source_type].some((value) => includesText(value, search));
    return matchesStatus && matchesSearch;
  });

  const resetForm = () => {
    setEditingId(null);
    setEntryDate(format(new Date(), "yyyy-MM-dd"));
    setMemo("");
    setLines(blankJournalLines);
  };

  const save = async () => {
    try {
      const cleaned = lines.filter((line) => line.account_id && (Number(line.debit) > 0 || Number(line.credit) > 0));
      if (!isBalancedJournal(cleaned)) throw new Error("Debits and credits must balance before saving.");
      if (editingId) await updateJournalEntry(editingId, { entry_date: entryDate, memo, lines: cleaned });
      else await createJournalEntry({ entry_date: entryDate, memo, lines: cleaned });
      resetForm();
      await refresh();
      toast({ title: editingId ? "Draft journal updated" : "Draft journal saved" });
    } catch (error) {
      toast({ title: "Journal failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const post = async (id: string) => {
    try {
      await postJournalEntry(id);
      await refresh();
      toast({ title: "Journal posted" });
    } catch (error) {
      toast({ title: "Post failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const edit = async (entry: FlowMathJournalEntry) => {
    if (entry.source_type !== "manual" || !["draft", "posted"].includes(entry.status)) return;
    try {
      if (entry.status === "posted") {
        if (!window.confirm(`Unpost and edit voucher ${entry.entry_no}?`)) return;
        await unpostManualJournalEntry(entry.id);
      }
      const entryLines = await listJournalLines(entry.id);
      setEditingId(entry.id);
      setEntryDate(entry.entry_date);
      setMemo(entry.memo || "");
      setLines(entryLines.map((line) => ({ account_id: line.account_id, description: line.description || "", debit: Number(line.debit || 0), credit: Number(line.credit || 0) })));
      await refresh();
    } catch (error) {
      toast({ title: "Could not load journal", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const remove = async (entry: FlowMathJournalEntry) => {
    if (entry.source_type !== "manual" || !["draft", "posted"].includes(entry.status)) return;
    const prompt = entry.status === "posted"
      ? `Unpost and delete voucher ${entry.entry_no}?`
      : `Delete voucher ${entry.entry_no}?`;
    if (!window.confirm(prompt)) return;
    try {
      if (entry.status === "posted") await unpostManualJournalEntry(entry.id);
      await deleteJournalEntry(entry.id);
      await refresh();
      toast({ title: "Voucher deleted" });
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Journal Entries" description="Create balanced manual journals and post them into the ledger." />
      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">{editingId ? "Edit Draft Journal" : "New Journal"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /><Input className="md:col-span-2" placeholder="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-5">
                <Select value={line.account_id} onValueChange={(v) => setLines(lines.map((row, i) => i === index ? { ...row, account_id: v } : row))}>
                  <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="md:col-span-2" placeholder="Description" value={line.description} onChange={(e) => setLines(lines.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} />
                <Input type="number" placeholder="Debit" value={line.debit || ""} onChange={(e) => setLines(lines.map((row, i) => i === index ? { ...row, debit: Number(e.target.value), credit: 0 } : row))} />
                <Input type="number" placeholder="Credit" value={line.credit || ""} onChange={(e) => setLines(lines.map((row, i) => i === index ? { ...row, credit: Number(e.target.value), debit: 0 } : row))} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setLines([...lines, { account_id: "", description: "", debit: 0, credit: 0 }])}>Add Line</Button>
            <div className="text-sm text-muted-foreground">Debit {money(totals.debit)} / Credit {money(totals.credit)}</div>
            <div className="flex gap-2">
              {editingId ? <Button variant="outline" onClick={resetForm}>Cancel</Button> : null}
              <Button onClick={save}>{editingId ? "Update Draft" : "Save Draft"}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="card-elevated">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Journal History</CardTitle>
          <TableToolbar
            search={search}
            onSearch={setSearch}
            onExport={() => exportCsv("flowmath-journals.csv", ["No", "Date", "Memo", "Source", "Status"], filteredEntries.map((entry) => [entry.entry_no, entry.entry_date, entry.memo, entry.source_type, entry.status]))}
          >
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="posted">Posted</SelectItem><SelectItem value="void">Void</SelectItem></SelectContent></Select>
          </TableToolbar>
        </CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>No</TableHead><TableHead>Date</TableHead><TableHead>Memo</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead className="w-32" /></TableRow></TableHeader><TableBody>{filteredEntries.map((entry) => { const canManageVoucher = entry.source_type === "manual" && ["draft", "posted"].includes(entry.status); return <TableRow key={entry.id}><TableCell>{entry.entry_no}</TableCell><TableCell>{entry.entry_date}</TableCell><TableCell>{entry.memo}</TableCell><TableCell>{entry.source_type}</TableCell><TableCell><StatusBadge status={entry.status} /></TableCell><TableCell><div className="flex justify-end gap-1">{entry.status === "draft" ? <Button size="sm" onClick={() => post(entry.id)}>Post</Button> : null}{canManageVoucher ? <><IconAction label="Edit voucher" onClick={() => edit(entry)}><Pencil className="h-4 w-4" /></IconAction><IconAction label="Delete voucher" onClick={() => remove(entry)}><Trash2 className="h-4 w-4" /></IconAction></> : null}</div></TableCell></TableRow>; })}</TableBody></Table></CardContent>
      </Card>
    </div>
  );
}

export function FlowMathLedgerPage() {
  const [accounts, setAccounts] = useState<FlowMathAccount[]>([]);
  const [lines, setLines] = useState<FlowMathJournalLine[]>([]);
  const [accountId, setAccountId] = useState("all");
  const [search, setSearch] = useState("");
  const money = useMoney();

  useEffect(() => {
    Promise.all([listAccounts(), listJournalLines()]).then(([a, l]) => { setAccounts(a); setLines(l); });
  }, []);

  const filtered = lines.filter((line) => {
    const matchesAccount = accountId === "all" || line.account_id === accountId;
    const matchesSearch = [line.account?.code, line.account?.name, line.description].some((value) => includesText(value, search));
    return matchesAccount && matchesSearch;
  });
  let running = 0;

  return (
    <div className="space-y-5">
      <PageHeader title="General Ledger" description="Posted debit and credit activity by account." />
      <Card className="card-elevated">
        <CardContent className="p-4">
          <TableToolbar
            search={search}
            onSearch={setSearch}
            onExport={() => exportCsv("flowmath-ledger.csv", ["Account", "Description", "Debit", "Credit"], filtered.map((line) => [`${line.account?.code || ""} - ${line.account?.name || ""}`, line.description, line.debit, line.credit]))}
          >
            <Select value={accountId} onValueChange={setAccountId}><SelectTrigger className="w-72"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All accounts</SelectItem>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>)}</SelectContent></Select>
          </TableToolbar>
        </CardContent>
      </Card>
      <Card className="card-elevated"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead>Running</TableHead></TableRow></TableHeader><TableBody>{filtered.map((line) => { running += Number(line.debit || 0) - Number(line.credit || 0); return <TableRow key={line.id}><TableCell>{line.account?.code} - {line.account?.name}</TableCell><TableCell>{line.description}</TableCell><TableCell>{money(line.debit)}</TableCell><TableCell>{money(line.credit)}</TableCell><TableCell>{money(running)}</TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>
    </div>
  );
}

function CounterpartyPage({ type }: { type: "vendor" | "customer" }) {
  const [rows, setRows] = useState<FlowMathCounterparty[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", tax_number: "" });
  const { toast } = useToast();
  const refresh = () => listCounterparties(type).then(setRows);
  useEffect(() => { void listCounterparties(type).then(setRows); }, [type]);
  const filteredRows = rows.filter((row) => [row.name, row.email, row.phone, row.tax_number, row.address].some((value) => includesText(value, search)));
  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", email: "", phone: "", address: "", tax_number: "" });
  };
  const save = async () => {
    try {
      await saveCounterparty({ ...form, type }, editingId || undefined);
      resetForm();
      await refresh();
      toast({ title: `${type} ${editingId ? "updated" : "saved"}` });
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };
  const edit = (row: FlowMathCounterparty) => {
    setEditingId(row.id);
    setForm({ name: row.name, email: row.email || "", phone: row.phone || "", address: row.address || "", tax_number: row.tax_number || "" });
  };
  const remove = async (row: FlowMathCounterparty) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try {
      await deleteCounterparty(row.id);
      await refresh();
      toast({ title: `${type} deleted` });
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader title={type === "vendor" ? "Vendors" : "Customers"} description={`Manage ${type} master records for FlowMath documents.`} />
      <Card className="card-elevated"><CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-6"><Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><Input placeholder="Tax no" value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} /><Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /><div className="flex gap-2"><Button className="flex-1" onClick={save}>{editingId ? "Update" : "Save"}</Button>{editingId ? <IconAction label="Cancel edit" onClick={resetForm}><X className="h-4 w-4" /></IconAction> : null}</div></CardContent></Card>
      <Card className="card-elevated">
        <CardHeader>
          <TableToolbar
            search={search}
            onSearch={setSearch}
            onExport={() => exportCsv(`flowmath-${type}s.csv`, ["Name", "Email", "Phone", "Tax", "Address", "Active"], filteredRows.map((row) => [row.name, row.email, row.phone, row.tax_number, row.address, row.is_active]))}
          />
        </CardHeader>
        <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Tax</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader><TableBody>{filteredRows.map((row) => <TableRow key={row.id}><TableCell>{row.name}</TableCell><TableCell>{row.email}</TableCell><TableCell>{row.phone}</TableCell><TableCell>{row.tax_number}</TableCell><TableCell>{row.is_active ? "Active" : "Inactive"}</TableCell><TableCell><div className="flex justify-end gap-1"><IconAction label={`Edit ${type}`} onClick={() => edit(row)}><Pencil className="h-4 w-4" /></IconAction><IconAction label={`Delete ${type}`} onClick={() => remove(row)}><Trash2 className="h-4 w-4" /></IconAction></div></TableCell></TableRow>)}</TableBody></Table></CardContent>
      </Card>
    </div>
  );
}

export function FlowMathVendorsPage() { return <CounterpartyPage type="vendor" />; }
export function FlowMathCustomersPage() { return <CounterpartyPage type="customer" />; }

function DocumentPage({ documentType }: { documentType: FlowMathDocumentType }) {
  const [accounts, setAccounts] = useState<FlowMathAccount[]>([]);
  const [counterparties, setCounterparties] = useState<FlowMathCounterparty[]>([]);
  const [docs, setDocs] = useState<FlowMathDocument[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState({ document_date: format(new Date(), "yyyy-MM-dd"), due_date: "", memo: "", counterparty_id: "", description: "", debit_account_id: "", credit_account_id: "", amount: "" });
  const { toast } = useToast();
  const money = useMoney();
  const cpType = documentType === "invoice" ? "customer" : "vendor";

  const refresh = async () => {
    const [a, c, d] = await Promise.all([listAccounts(), listCounterparties(cpType), listDocuments(documentType)]);
    setAccounts(a);
    setCounterparties(c);
    setDocs(d);
  };
  useEffect(() => {
    void Promise.all([listAccounts(), listCounterparties(cpType), listDocuments(documentType)]).then(([a, c, d]) => {
      setAccounts(a);
      setCounterparties(c);
      setDocs(d);
    });
  }, [cpType, documentType]);

  const filteredDocs = docs.filter((doc) => {
    const matchesStatus = status === "all" || doc.status === status;
    const matchesSearch = [doc.document_no, doc.document_date, doc.memo, doc.counterparty?.name, doc.total_amount].some((value) => includesText(value, search));
    return matchesStatus && matchesSearch;
  });

  useEffect(() => {
    const byCode = (code: string) => accounts.find((account) => account.code === code)?.id || "";
    if (!accounts.length || editingId) return;
    const defaults = documentType === "invoice"
      ? { debit_account_id: byCode("1100"), credit_account_id: byCode("4000") }
      : documentType === "bill"
        ? { debit_account_id: byCode("5000"), credit_account_id: byCode("2000") }
        : { debit_account_id: byCode("5000"), credit_account_id: byCode("1000") };
    setForm((current) => ({ ...current, ...defaults }));
  }, [accounts, documentType, editingId]);

  const resetForm = () => {
    setEditingId(null);
    setForm((current) => ({ ...current, document_date: format(new Date(), "yyyy-MM-dd"), due_date: "", memo: "", counterparty_id: "", description: "", amount: "" }));
  };

  const save = async () => {
    try {
      const payload = {
        document_date: form.document_date,
        due_date: form.due_date || null,
        memo: form.memo,
        counterparty_id: form.counterparty_id || null,
        lines: [{ description: form.description || form.memo || documentType, debit_account_id: form.debit_account_id, credit_account_id: form.credit_account_id, quantity: 1, unit_amount: Number(form.amount) }],
      };
      if (editingId) await updateDocument(editingId, payload);
      else await createDocument({ document_type: documentType, ...payload });
      resetForm();
      await refresh();
      toast({ title: editingId ? "Draft updated" : "Draft saved" });
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };
  const post = async (id: string) => {
    try { await postDocument(id); await refresh(); toast({ title: "Document posted" }); } catch (error) { toast({ title: "Post failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }); }
  };
  const edit = async (doc: FlowMathDocument) => {
    if (doc.status !== "draft") return;
    try {
      const docLines: FlowMathDocumentLine[] = await listDocumentLines(doc.id);
      const firstLine = docLines[0];
      setEditingId(doc.id);
      setForm({
        document_date: doc.document_date,
        due_date: doc.due_date || "",
        memo: doc.memo || "",
        counterparty_id: doc.counterparty_id || "",
        description: firstLine?.description || "",
        debit_account_id: firstLine?.debit_account_id || "",
        credit_account_id: firstLine?.credit_account_id || "",
        amount: String(firstLine ? Number(firstLine.quantity || 0) * Number(firstLine.unit_amount || 0) : doc.total_amount || ""),
      });
    } catch (error) {
      toast({ title: "Could not load draft", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };
  const remove = async (doc: FlowMathDocument) => {
    if (doc.status !== "draft" || !window.confirm(`Delete ${doc.document_no}?`)) return;
    try {
      await deleteDocument(doc.id);
      await refresh();
      toast({ title: "Draft deleted" });
    } catch (error) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title={documentType[0].toUpperCase() + documentType.slice(1) + "s"} description={`Create draft ${documentType}s and post them as balanced journals.`} />
      <Card className="card-elevated">
        <CardContent className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-4">
          <Input type="date" value={form.document_date} onChange={(e) => setForm({ ...form, document_date: e.target.value })} />
          <Select value={form.counterparty_id} onValueChange={(v) => setForm({ ...form, counterparty_id: v })}><SelectTrigger><SelectValue placeholder={cpType} /></SelectTrigger><SelectContent>{counterparties.map((cp) => <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="Memo" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <Input placeholder="Line description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select value={form.debit_account_id} onValueChange={(v) => setForm({ ...form, debit_account_id: v })}><SelectTrigger><SelectValue placeholder="Debit account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>)}</SelectContent></Select>
          <Select value={form.credit_account_id} onValueChange={(v) => setForm({ ...form, credit_account_id: v })}><SelectTrigger><SelectValue placeholder="Credit account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>)}</SelectContent></Select>
          <div className="flex gap-2"><Input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /><Button onClick={save}>{editingId ? "Update" : "Save"}</Button>{editingId ? <IconAction label="Cancel edit" onClick={resetForm}><X className="h-4 w-4" /></IconAction> : null}</div>
        </CardContent>
      </Card>
      <Card className="card-elevated">
        <CardHeader>
          <TableToolbar
            search={search}
            onSearch={setSearch}
            onExport={() => exportCsv(`flowmath-${documentType}s.csv`, ["No", "Date", "Counterparty", "Memo", "Total", "Status"], filteredDocs.map((doc) => [doc.document_no, doc.document_date, doc.counterparty?.name, doc.memo, doc.total_amount, doc.status]))}
          >
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="posted">Posted</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="void">Void</SelectItem></SelectContent></Select>
          </TableToolbar>
        </CardHeader>
        <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>No</TableHead><TableHead>Date</TableHead><TableHead>Counterparty</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="w-36" /></TableRow></TableHeader><TableBody>{filteredDocs.map((doc) => <TableRow key={doc.id}><TableCell>{doc.document_no}</TableCell><TableCell>{doc.document_date}</TableCell><TableCell>{doc.counterparty?.name}</TableCell><TableCell>{money(doc.total_amount)}</TableCell><TableCell><StatusBadge status={doc.status} /></TableCell><TableCell><div className="flex justify-end gap-1">{doc.status === "draft" ? <><Button size="sm" onClick={() => post(doc.id)}>Post</Button><IconAction label="Edit draft" onClick={() => edit(doc)}><Pencil className="h-4 w-4" /></IconAction><IconAction label="Delete draft" onClick={() => remove(doc)}><Trash2 className="h-4 w-4" /></IconAction></> : null}</div></TableCell></TableRow>)}</TableBody></Table></CardContent>
      </Card>
    </div>
  );
}

export function FlowMathExpensesPage() { return <DocumentPage documentType="expense" />; }
export function FlowMathInvoicesPage() { return <DocumentPage documentType="invoice" />; }
export function FlowMathBillsPage() { return <DocumentPage documentType="bill" />; }

export function FlowMathPayrollPage() {
  const [runs, setRuns] = useState<FlowMathPayrollRun[]>([]);
  const [items, setItems] = useState<FlowMathPayrollItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [search, setSearch] = useState("");
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const { toast } = useToast();
  const money = useMoney();
  const selectedRun = runs.find((run) => run.id === selectedRunId);
  const filteredItems = items.filter((item) => {
    const employeeLabel = item.employee?.profile?.full_name || item.employee?.employee_id || item.employee_id;
    return [employeeLabel, item.employee?.designation, item.notes].some((value) => includesText(value, search));
  });

  const refresh = async () => {
    const next = await listPayrollRuns();
    setRuns(next);
    const nextSelected = selectedRunId || next[0]?.id || "";
    setSelectedRunId(nextSelected);
    if (nextSelected) setItems(await listPayrollItems(nextSelected));
  };
  useEffect(() => {
    void listPayrollRuns().then(async (next) => {
      setRuns(next);
      const nextSelected = next[0]?.id || "";
      setSelectedRunId(nextSelected);
      if (nextSelected) setItems(await listPayrollItems(nextSelected));
    });
  }, []);
  useEffect(() => { if (selectedRunId) listPayrollItems(selectedRunId).then(setItems); }, [selectedRunId]);

  const createRun = async () => { try { await createPayrollRun(periodStart, periodEnd); await refresh(); toast({ title: "Payroll run created" }); } catch (error) { toast({ title: "Payroll failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }); } };
  const postRun = async () => { if (!selectedRunId) return; try { await postPayrollRun(selectedRunId); await refresh(); toast({ title: "Payroll posted" }); } catch (error) { toast({ title: "Post failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }); } };
  const payRun = async () => { if (!selectedRunId) return; try { await markPayrollPaid(selectedRunId); await refresh(); toast({ title: "Payroll marked paid" }); } catch (error) { toast({ title: "Payment failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }); } };

  return (
    <div className="space-y-5">
      <PageHeader title="Payroll Management" description="Create salary runs from FlowHR salaries, adjust manually, post payable, and mark paid." />
      <Card className="card-elevated"><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center"><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /><Button onClick={createRun}>Create Run</Button><Select value={selectedRunId} onValueChange={setSelectedRunId}><SelectTrigger className="md:w-72"><SelectValue placeholder="Select run" /></SelectTrigger><SelectContent>{runs.map((run) => <SelectItem key={run.id} value={run.id}>{run.run_no} ({run.status})</SelectItem>)}</SelectContent></Select>{selectedRun?.status === "draft" ? <Button onClick={postRun}>Post Payroll</Button> : null}{selectedRun?.status === "posted" ? <Button onClick={payRun}>Mark Paid</Button> : null}</CardContent></Card>
      {selectedRun ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Gross", selectedRun.gross_amount], ["Allowances", selectedRun.allowance_amount], ["Deductions", selectedRun.deduction_amount], ["Net", selectedRun.net_amount]].map(([label, value]) => <Card key={label as string} className="card-elevated"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{money(Number(value))}</p></CardContent></Card>)}</div> : null}
      <Card className="card-elevated">
        <CardHeader>
          <TableToolbar
            search={search}
            onSearch={setSearch}
            onExport={() => exportCsv("flowmath-payroll-items.csv", ["Employee", "Base", "Present", "Absent", "Allowances", "Deductions", "Net", "Notes"], filteredItems.map((item) => [item.employee?.profile?.full_name || item.employee?.employee_id || item.employee_id, item.base_salary, item.present_days, item.absent_days, item.allowances, item.deductions, item.net_salary, item.notes]))}
          />
        </CardHeader>
        <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Base</TableHead><TableHead>Attendance</TableHead><TableHead>Allowances</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead><TableHead>Notes</TableHead><TableHead /></TableRow></TableHeader><TableBody>{filteredItems.map((item) => <PayrollItemRow key={item.id} item={item} money={money} editable={selectedRun?.status === "draft"} onSaved={refresh} />)}</TableBody></Table></CardContent>
      </Card>
    </div>
  );
}

function PayrollItemRow({ item, money, editable, onSaved }: { item: FlowMathPayrollItem; money: (amount: number) => string; editable?: boolean; onSaved: () => void }) {
  const [allowances, setAllowances] = useState(String(item.allowances || 0));
  const [deductions, setDeductions] = useState(String(item.deductions || 0));
  const [notes, setNotes] = useState(item.notes || "");
  const { toast } = useToast();
  const save = async () => {
    try { await updatePayrollItem(item.id, { allowances: Number(allowances), deductions: Number(deductions), notes }); await onSaved(); toast({ title: "Payroll item updated" }); } catch (error) { toast({ title: "Update failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }); }
  };
  const employeeLabel = item.employee?.profile?.full_name || item.employee?.employee_id || item.employee_id;
  return <TableRow><TableCell>{employeeLabel}</TableCell><TableCell>{money(item.base_salary)}</TableCell><TableCell>{item.present_days} present / {item.absent_days} absent / {Math.round(item.total_work_minutes / 60)} hrs</TableCell><TableCell>{editable ? <Input className="w-28" type="number" value={allowances} onChange={(e) => setAllowances(e.target.value)} /> : money(item.allowances)}</TableCell><TableCell>{editable ? <Input className="w-28" type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} /> : money(item.deductions)}</TableCell><TableCell>{money(item.net_salary)}</TableCell><TableCell>{editable ? <Input value={notes} onChange={(e) => setNotes(e.target.value)} /> : item.notes}</TableCell><TableCell>{editable ? <Button size="sm" variant="outline" onClick={save}>Save</Button> : null}</TableCell></TableRow>;
}

export function FlowMathReportsPage() {
  const [accounts, setAccounts] = useState<FlowMathAccount[]>([]);
  const [lines, setLines] = useState<FlowMathJournalLine[]>([]);
  const [search, setSearch] = useState("");
  const money = useMoney();
  useEffect(() => { Promise.all([listAccounts(), listJournalLines()]).then(([a, l]) => { setAccounts(a); setLines(l); }); }, []);

  const rows = accounts.map((account) => {
    const accountLines = lines.filter((line) => line.account_id === account.id);
    const debit = accountLines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = accountLines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return { account, debit, credit, balance: account.normal_balance === "debit" ? debit - credit : credit - debit };
  });
  const visibleRows = rows.filter((row) => [row.account.code, row.account.name, row.account.account_type].some((value) => includesText(value, search)));
  const debitTotal = rows.reduce((sum, row) => sum + row.debit, 0);
  const creditTotal = rows.reduce((sum, row) => sum + row.credit, 0);
  const income = rows.filter((row) => row.account.account_type === "income").reduce((sum, row) => sum + row.balance, 0);
  const expenses = rows.filter((row) => row.account.account_type === "expense").reduce((sum, row) => sum + row.balance, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Trial balance, profit and loss, balance sheet, aging placeholders, and payroll summary." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><Card className="card-elevated"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Trial Balance Delta</p><p className="text-xl font-semibold">{money(debitTotal - creditTotal)}</p></CardContent></Card><Card className="card-elevated"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Profit and Loss</p><p className="text-xl font-semibold">{money(income - expenses)}</p></CardContent></Card><Card className="card-elevated"><CardContent className="p-4"><p className="text-xs text-muted-foreground">AP / AR Aging</p><p className="text-xl font-semibold">Ready</p></CardContent></Card></div>
      <Card className="card-elevated"><CardContent className="p-4"><TableToolbar search={search} onSearch={setSearch} onExport={() => exportCsv("flowmath-trial-balance.csv", ["Account", "Type", "Debit", "Credit", "Balance"], visibleRows.map((row) => [`${row.account.code} - ${row.account.name}`, row.account.account_type, row.debit, row.credit, row.balance]))} /></CardContent></Card>
      <Tabs defaultValue="trial"><TabsList><TabsTrigger value="trial">Trial Balance</TabsTrigger><TabsTrigger value="pl">Profit & Loss</TabsTrigger><TabsTrigger value="balance">Balance Sheet</TabsTrigger></TabsList><TabsContent value="trial"><Card className="card-elevated"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead>Balance</TableHead></TableRow></TableHeader><TableBody>{visibleRows.map((row) => <TableRow key={row.account.id}><TableCell>{row.account.code} - {row.account.name}</TableCell><TableCell>{money(row.debit)}</TableCell><TableCell>{money(row.credit)}</TableCell><TableCell>{money(row.balance)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent><TabsContent value="pl"><Card className="card-elevated"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Income</TableCell><TableCell>{money(income)}</TableCell></TableRow><TableRow><TableCell>Expenses</TableCell><TableCell>{money(expenses)}</TableCell></TableRow><TableRow><TableCell>Net profit</TableCell><TableCell>{money(income - expenses)}</TableCell></TableRow></TableBody></Table></CardContent></Card></TabsContent><TabsContent value="balance"><Card className="card-elevated"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody>{["asset", "liability", "equity"].map((type) => <TableRow key={type}><TableCell>{type}</TableCell><TableCell>{money(rows.filter((row) => row.account.account_type === type).reduce((sum, row) => sum + row.balance, 0))}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent></Tabs>
    </div>
  );
}

export function FlowMathSettingsPage() {
  const [form, setForm] = useState({ base_currency: "PKR", currency_symbol: "Rs", timezone: "Asia/Karachi", fiscal_year_start_month: 1, tax_label: "Tax" });
  const [accessRows, setAccessRows] = useState<FlowMathAccessCandidate[]>([]);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const refreshAccess = () => listFlowMathAccessCandidates().then(setAccessRows);
  useEffect(() => { getFlowMathSettings().then((settings) => setForm(settings as any)); void refreshAccess(); }, []);
  const filteredAccessRows = accessRows.filter((row) => [row.full_name, row.employee_code, row.department_name].some((value) => includesText(value, search)));
  const save = async () => {
    try { await updateFlowMathSettings(form as any); toast({ title: "Settings saved" }); } catch (error) { toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }); }
  };
  const setOverride = async (employeeId: string, allowed: boolean | null) => {
    try {
      if (allowed === null) await clearFlowMathAccessOverride(employeeId);
      else await saveFlowMathAccessOverride(employeeId, allowed);
      await refreshAccess();
      toast({ title: "Access updated" });
    } catch (error) {
      toast({ title: "Access update failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader title="FlowMath Settings" description="Company accounting defaults for currency, timezone, fiscal year, and tax labels." />
      <Card className="card-elevated"><CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2"><div className="space-y-2"><Label>Base currency</Label><Input value={form.base_currency} onChange={(e) => setForm({ ...form, base_currency: e.target.value.toUpperCase() })} /></div><div className="space-y-2"><Label>Currency symbol</Label><Input value={form.currency_symbol} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} /></div><div className="space-y-2"><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></div><div className="space-y-2"><Label>Fiscal year start month</Label><Input type="number" min={1} max={12} value={form.fiscal_year_start_month} onChange={(e) => setForm({ ...form, fiscal_year_start_month: Number(e.target.value) })} /></div><div className="space-y-2 md:col-span-2"><Label>Tax label</Label><Input value={form.tax_label} onChange={(e) => setForm({ ...form, tax_label: e.target.value })} /></div><div className="md:col-span-2"><Button onClick={save}>Save Settings</Button></div></CardContent></Card>
      <Card className="card-elevated">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Employee FlowMath Access</CardTitle>
          <TableToolbar
            search={search}
            onSearch={setSearch}
            onExport={() => exportCsv("flowmath-access.csv", ["Employee", "Code", "Department", "Effective Access", "Override"], filteredAccessRows.map((row) => [row.full_name, row.employee_code, row.department_name, row.effective_access ? "Allowed" : "Blocked", row.override_allowed === null ? "Department default" : row.override_allowed ? "Explicit allow" : "Explicit deny"]))}
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Effective</TableHead><TableHead>Override</TableHead><TableHead className="w-[260px]">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredAccessRows.map((row) => (
                <TableRow key={row.employee_id}>
                  <TableCell><div className="font-medium">{row.full_name}</div><div className="text-xs text-muted-foreground">{row.employee_code}</div></TableCell>
                  <TableCell>{row.department_name || "Unassigned"}</TableCell>
                  <TableCell>{row.effective_access ? <Badge className="badge-success">Allowed</Badge> : <Badge variant="outline">Blocked</Badge>}</TableCell>
                  <TableCell>{row.override_allowed === null ? "Department default" : row.override_allowed ? "Explicit allow" : "Explicit deny"}</TableCell>
                  <TableCell className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setOverride(row.employee_id, true)}>Allow</Button>
                    <Button size="sm" variant="outline" onClick={() => setOverride(row.employee_id, false)}>Deny</Button>
                    <Button size="sm" variant="ghost" onClick={() => setOverride(row.employee_id, null)}>Default</Button>
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
