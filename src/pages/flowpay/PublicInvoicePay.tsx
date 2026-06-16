import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicFlowPayInvoice, FlowPayInvoice, FlowPayLineItem, formatFlowPayMoney, amountToCents } from "@/lib/flowpay";
import { CheckCircle2, CreditCard, Loader2, XCircle } from "lucide-react";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

function PaymentForm({ invoice }: { invoice: FlowPayInvoice }) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}?success=true`,
      },
    });

    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred.");
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || !elements || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {formatFlowPayMoney(invoice.amount_in_cents, invoice.currency)}
          </>
        )}
      </Button>
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive text-sm">
          <XCircle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}
    </form>
  );
}

export default function PublicInvoicePay() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState<FlowPayInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;

    const fetchData = async () => {
      try {
        const inv = await getPublicFlowPayInvoice(invoiceId);
        setInvoice(inv);

        if (inv && inv.status !== "paid") {
          const response = await fetch("/api/create-payment-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId }),
          });
          const data = await response.json();
          setClientSecret(data.clientSecret);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invoice not found");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get("success") === "true";
  const isPaid = invoice.status === "paid" || success;

  const company = (invoice.metadata?.company || {}) as {
    name?: string;
    email?: string;
    address?: string;
    phone?: string;
    website?: string;
    logoUrl?: string | null;
    logo_url?: string | null;
    logoHasDarkBg?: boolean;
    logo_has_dark_bg?: boolean;
    taxId?: string;
    tax_id?: string;
  };
  const logoUrl = company.logoUrl || company.logo_url || null;
  const logoNeedsDarkBg = Boolean(company.logoHasDarkBg ?? company.logo_has_dark_bg);
  const taxId = company.taxId || company.tax_id;
  const client = (invoice.metadata?.client || {}) as { name?: string; email?: string; companyName?: string; address?: string };
  const items = (invoice.metadata?.items || []) as FlowPayLineItem[];
  const subtotal = Number(invoice.metadata?.subtotal ?? 0);
  const tax = Number(invoice.metadata?.tax ?? 0);
  const total = Number(invoice.metadata?.total ?? invoice.amount_in_cents / 100);

  const stripeOptions: StripeElementsOptions = clientSecret
    ? {
        clientSecret,
        appearance: { theme: "stripe" },
      }
    : {};

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoice {invoice.invoice_number}</h1>
            <p className="text-sm text-muted-foreground">Secure payment</p>
          </div>
          <Badge variant="outline" className={isPaid ? "badge-success" : "badge-warning"}>{isPaid ? "paid" : invoice.status}</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Invoice Section (Takes 2 columns) */}
          <div className="lg:col-span-2">
            <Card className="card-elevated">
              <CardContent className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    {logoUrl ? (
                      <div className={logoNeedsDarkBg ? "rounded-lg bg-foreground p-3" : ""}>
                        <img src={logoUrl} alt={company.name || "Company logo"} className="h-14 max-w-[180px] object-contain" />
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
                    {taxId ? <p className="mt-2 text-muted-foreground">Tax ID {taxId}</p> : null}
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
                          <td className="py-3 text-right">{formatFlowPayMoney(amountToCents(item.rate), invoice.currency)}</td>
                          <td className="py-3 text-right">{formatFlowPayMoney(amountToCents(item.amount), invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ml-auto w-full max-w-sm text-sm">
                  <div className="flex justify-between py-1"><span>Subtotal</span><span>{formatFlowPayMoney(amountToCents(subtotal), invoice.currency)}</span></div>
                  <div className="flex justify-between py-1"><span>Tax</span><span>{formatFlowPayMoney(amountToCents(tax), invoice.currency)}</span></div>
                  <div className="mt-2 flex justify-between border-t pt-3 text-lg font-semibold"><span>Total</span><span>{formatFlowPayMoney(amountToCents(total), invoice.currency)}</span></div>
                </div>

                {invoice.metadata?.notes ? <p className="text-sm text-muted-foreground">{invoice.metadata.notes}</p> : null}
              </CardContent>
            </Card>
          </div>

          {/* Payment Section (Takes 1 column) */}
          <div className="lg:col-span-1">
            <Card className="card-elevated sticky top-4">
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent>
                {isPaid ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 p-6 text-primary text-center">
                    <CheckCircle2 className="h-8 w-8" />
                    <div>
                      <p className="font-medium">Payment received</p>
                      <p className="text-sm text-muted-foreground">Thank you for your payment!</p>
                    </div>
                  </div>
                ) : clientSecret ? (
                  <Elements stripe={stripePromise} options={stripeOptions}>
                    <PaymentForm invoice={invoice} />
                  </Elements>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 p-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading payment...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InvoicePaymentView({ invoice }: { invoice: FlowPayInvoice }) {
  const company = (invoice.metadata?.company || {}) as {
    name?: string;
    email?: string;
    address?: string;
    phone?: string;
    website?: string;
    logoUrl?: string | null;
    logo_url?: string | null;
    logoHasDarkBg?: boolean;
    logo_has_dark_bg?: boolean;
    taxId?: string;
    tax_id?: string;
  };
  const logoUrl = company.logoUrl || company.logo_url || null;
  const logoNeedsDarkBg = Boolean(company.logoHasDarkBg ?? company.logo_has_dark_bg);
  const taxId = company.taxId || company.tax_id;
  const client = (invoice.metadata?.client || {}) as { name?: string; email?: string; companyName?: string; address?: string };
  const items = (invoice.metadata?.items || []) as FlowPayLineItem[];
  const subtotal = Number(invoice.metadata?.subtotal ?? 0);
  const tax = Number(invoice.metadata?.tax ?? 0);
  const total = Number(invoice.metadata?.total ?? invoice.amount_in_cents / 100);
  const isPaid = invoice.status === "paid";

  return (
    <div className="bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoice {invoice.invoice_number}</h1>
            <p className="text-sm text-muted-foreground">Secure payment</p>
          </div>
          <Badge variant="outline" className={isPaid ? "badge-success" : "badge-warning"}>{isPaid ? "paid" : invoice.status}</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Invoice Section (Takes 2 columns) */}
          <div className="lg:col-span-2">
            <Card className="card-elevated">
              <CardContent className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    {logoUrl ? (
                      <div className={logoNeedsDarkBg ? "rounded-lg bg-foreground p-3" : ""}>
                        <img src={logoUrl} alt={company.name || "Company logo"} className="h-14 max-w-[180px] object-contain" />
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
                    {taxId ? <p className="mt-2 text-muted-foreground">Tax ID {taxId}</p> : null}
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
                          <td className="py-3 text-right">{formatFlowPayMoney(amountToCents(item.rate), invoice.currency)}</td>
                          <td className="py-3 text-right">{formatFlowPayMoney(amountToCents(item.amount), invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ml-auto w-full max-w-sm text-sm">
                  <div className="flex justify-between py-1"><span>Subtotal</span><span>{formatFlowPayMoney(amountToCents(subtotal), invoice.currency)}</span></div>
                  <div className="flex justify-between py-1"><span>Tax</span><span>{formatFlowPayMoney(amountToCents(tax), invoice.currency)}</span></div>
                  <div className="mt-2 flex justify-between border-t pt-3 text-lg font-semibold"><span>Total</span><span>{formatFlowPayMoney(amountToCents(total), invoice.currency)}</span></div>
                </div>

                {invoice.metadata?.notes ? <p className="text-sm text-muted-foreground">{invoice.metadata.notes}</p> : null}
              </CardContent>
            </Card>
          </div>

          {/* Payment Section (Takes 1 column) */}
          <div className="lg:col-span-1">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent>
                {isPaid ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 p-6 text-primary text-center">
                    <CheckCircle2 className="h-8 w-8" />
                    <div>
                      <p className="font-medium">Payment received</p>
                      <p className="text-sm text-muted-foreground">Thank you for your payment!</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 p-6 text-muted-foreground text-center">
                    <CreditCard className="h-8 w-8" />
                    <div>
                      <p className="font-medium">Payment form</p>
                      <p className="text-sm text-muted-foreground">This is a preview. Share the payment link to let clients pay.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


