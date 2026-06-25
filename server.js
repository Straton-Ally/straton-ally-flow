import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, 'dist');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Initialize Supabase (use service role key if available for server-side access)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();

// Middleware: JSON parsing (except webhook endpoint)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Content types for static files
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Static file serving function
function sendFile(res, filePath) {
  const extension = extname(filePath);
  res.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html'
      ? 'public, max-age=0, must-revalidate'
      : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(res);
}

function resolveStaticPath(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(distDir, normalizedPath);

  if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
    return null;
  }

  const stats = statSync(filePath);
  if (stats.isDirectory()) {
    const indexPath = join(filePath, 'index.html');
    return existsSync(indexPath) ? indexPath : null;
  }

  return stats.isFile() ? filePath : null;
}

// ------------------------------
// API ROUTES FIRST (important!)
// ------------------------------

// API: Create Stripe Payment Intent
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { invoiceId } = req.body;

    // Get invoice from Supabase
    const { data: invoice, error } = await supabase
      .from('managepay_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice already paid' });
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: invoice.amount_in_cents,
      currency: invoice.currency || 'gbp',
      description: `Invoice ${invoice.invoice_number}`,
      metadata: {
        invoiceId: invoice.id,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// API: Stripe Webhook
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      const invoiceId = paymentIntent.metadata.invoiceId;

      if (invoiceId) {
        // Update invoice status in Supabase
        const { error } = await supabase
          .from('managepay_invoices')
          .update({
            status: 'paid',
            stripe_payment_intent_id: paymentIntent.id,
            paid_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        if (error) {
          console.error('Error updating invoice:', error);
        } else {
          console.log(`Invoice ${invoiceId} marked as paid`);
        }
      }
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

// ------------------------------
// THEN STATIC FILES & ROUTING
// ------------------------------
app.use((req, res, next) => {
  const staticPath = resolveStaticPath(req.path);

  if (staticPath) {
    sendFile(res, staticPath);
    return;
  }

  const acceptsHtml = req.headers.accept?.includes('text/html');
  const looksLikeAsset = extname(req.path) !== '';

  if (req.method === 'GET' && acceptsHtml && !looksLikeAsset) {
    sendFile(res, join(distDir, 'index.html'));
    return;
  }

  // If it's an API route that we didn't handle, return 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  res.status(404).send('Not found');
});

app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});
