import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicManagePayInvoice, ManagePayInvoice, ManagePayLineItem, formatManagePayMoney, amountToCents } from "@/lib/managepay";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";

export default function PublicInvoicePay() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState<ManagePayInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invoiceId) return;
    void getPublicManagePayInvoice(invoiceId)
      .then((next) => {
        setInvoice(next);
        setError(next ? "" : "Invoice not found");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Invoice not found"))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          Loading invoice...
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="card-elevated w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-semibold">Invoice unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error || "This invoice link could not be loaded."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <InvoicePaymentView invoice={invoice} />;
}

export function InvoicePaymentView({ invoice }: { invoice: ManagePayInvoice }) {
  const company = (invoice.metadata?.company || {}) as {
    name?: string;
    email?: string;
    address?: string;
    phone?: string;
    website?: string;
    logoUrl?: string | null;
    logoHasDarkBg?: boolean;
    taxId?: string;
  };
  const client = (invoice.metadata?.client || {}) as { name?: string; email?: string; companyName?: string; address?: string };
  const items = (invoice.metadata?.items || []) as ManagePayLineItem[];
  const subtotal = Number(invoice.metadata?.subtotal ?? 0);
  const tax = Number(invoice.metadata?.tax ?? 0);
  const total = Number(invoice.metadata?.total ?? invoice.amount_in_cents / 100);
  const paid = invoice.status === "paid" || new URLSearchParams(window.location.search).get("success") === "true";

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoice {invoice.invoice_number}</h1>
            <p className="text-sm text-muted-foreground">Secure payment page</p>
          </div>
          <Badge variant="outline" className={paid ? "badge-success" : "badge-warning"}>{paid ? "paid" : invoice.status}</Badge>
        </div>

        <Card className="card-elevated">
          <CardContent className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                {company.logoUrl ? (
                  <div className={company.logoHasDarkBg ? "rounded-lg bg-foreground p-2" : ""}>
                    <img src={company.logoUrl} alt={company.name || "Company logo"} className="h-12 max-w-[160px] object-contain" />
                  </div>
                ) : null}
                <div>
                  <p className="text-lg font-semibold">{company.name || "Company"}</p>
                  <p className="text-sm text-muted-foreground">{company.email}</p>
                  <p className="text-sm text-muted-foreground">{company.phone}</p>
                  <p className="text-sm text-muted-foreground">{company.address}</p>
                </div>
              </div>
              <div className="text-sm sm:text-right">
                <p className="text-muted-foreground">Due date</p>
                <p className="font-medium">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "No due date"}</p>
                {company.taxId ? <p className="mt-2 text-muted-foreground">Tax ID {company.taxId}</p> : null}
              </div>
            </div>

            <div className="surface-tile">
              <p className="text-xs text-muted-foreground">Bill to</p>
              <p className="font-medium">{client.name || invoice.client_email}</p>
              <p className="text-sm text-muted-foreground">{client.companyName}</p>
              <p className="text-sm text-muted-foreground">{client.email || invoice.client_email}</p>
              <p className="text-sm text-muted-foreground">{client.address}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 text-right font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Rate</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3">{item.description}</td>
                      <td className="py-3 text-right">{item.quantity}</td>
                      <td className="py-3 text-right">{formatManagePayMoney(amountToCents(item.rate), invoice.currency)}</td>
                      <td className="py-3 text-right">{formatManagePayMoney(amountToCents(item.amount), invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-sm text-sm">
              <div className="flex justify-between py-1"><span>Subtotal</span><span>{formatManagePayMoney(amountToCents(subtotal), invoice.currency)}</span></div>
              <div className="flex justify-between py-1"><span>Tax</span><span>{formatManagePayMoney(amountToCents(tax), invoice.currency)}</span></div>
              <div className="mt-2 flex justify-between border-t pt-3 text-lg font-semibold"><span>Total</span><span>{formatManagePayMoney(amountToCents(total), invoice.currency)}</span></div>
            </div>

            {invoice.metadata?.notes ? <p className="text-sm text-muted-foreground">{invoice.metadata.notes}</p> : null}

            {paid ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 p-4 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                Payment received. Thank you.
              </div>
            ) : (
              <Button size="lg" className="self-end">
                <CreditCard className="h-4 w-4" />
                Pay {formatManagePayMoney(invoice.amount_in_cents, invoice.currency)}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
