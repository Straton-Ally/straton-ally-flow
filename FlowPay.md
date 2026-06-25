# FlowPay Project Blueprint

This document captures the structure, database model, access rules, and functional behavior of the project so a similar product can be recreated inside another existing project. It intentionally avoids a tech-stack overview and focuses on product architecture and implementation details.

## 1. Product Summary

FlowPay is a payment and invoice management system for authenticated business users. It supports:

- User sign up, sign in, password recovery, profile editing, and role-based access.
- Admin-managed companies with branding, contact details, payment URLs, and active/inactive states.
- Client directory management for saved invoice recipients.
- Invoice generation with company branding, client selection, line items, tax, due dates, notes, and saved payment links.
- Invoice dashboard with revenue totals, invoice counts, client counts, company filtering, charts, and recent invoice actions.
- Public invoice payment pages that clients can open without signing in.
- Payment processing for invoices and a separate payment terminal flow.
- Invoice sharing through direct links, short links, email templates, WhatsApp, SMS, QR codes, and downloadable PDFs.
- Admin-only user role management.
- Admin-only invoice service management for reusable invoice line-item categories.

## 2. Application Hierarchy

### 2.1 Main Page Structure

```text
/
  Authentication landing page
  Login form
  Sign-up form
  Forgot-password form
  Redirects verified signed-in users to dashboard

/dashboard
  Main payment and invoice dashboard
  Revenue stats
  Invoice stats
  Client stats
  Company filter
  Recent invoice table
  Invoice sharing and payment-link actions

/clients
  Client directory
  Add client
  Edit client
  Archive/reactivate client
  Delete client
  Search clients

/companies
  Company management
  Add company
  Edit company
  Upload logo
  Toggle logo background style
  Activate/deactivate company
  Delete company
  View payment-provider connection status
  Admin-gated write actions

/invoice-generator
  Create invoice
  Select company
  Select saved client
  Enter invoice number and due date
  Add/edit/remove line items
  Select service category per item
  Calculate subtotal, tax, and total
  Save invoice
  Email/share/open payment link after saving
  View recent saved invoices

/terminal
  Standalone payment terminal
  Enter payment amount, currency, description, and customer details
  Choose payment method
  Process or simulate payment depending on method
  Store terminal transaction history locally

/settings
  Profile settings
  Profile photo upload to local browser storage
  Name/email update
  Dark-mode toggle
  Email-alert preference toggle
  Admin invoice-service management
  Sign out

/users
  Admin-only user management
  Search users
  Grant admin role
  Revoke admin role
  Prevent current admin from changing their own role

/pay/[invoiceId]
  Public invoice payment page
  Loads invoice by ID or invoice number fallback
  Shows invoice details, line items, totals, notes, status
  Accepts payment when invoice is pending
  Shows success state when paid
```

### 2.2 Server/API Hierarchy

```text
/api/companies
  GET     list companies for authenticated users
  POST    create company, admin only
  PUT     update company details or active status, admin only
  DELETE  delete company, admin only

/api/clients
  GET     list clients; admins see all, normal users see own
  POST    create client for current user
  PUT     update client; admins can update any, users only own
  DELETE  delete client; admins can delete any, users only own

/api/dashboard-data
  GET     aggregate invoices, clients, and companies for dashboard
          admins receive all invoices/clients; users receive own invoices/clients

/api/invoices
  GET     list invoices for current user or requested seller
  POST    create basic invoice for current user

/api/invoices/[invoiceId]
  GET     public invoice lookup by invoice UUID
          fallback lookup by invoice_number

/api/payments/create-intent
  POST    create payment intent for a saved invoice
          requires pending invoice
          stores payment intent ID on invoice

/api/create-payment-intent
  POST    create payment intent for the standalone terminal flow
          validates amount and currency

/api/webhooks/stripe
  POST    verifies webhook signature
          on payment success, marks matching invoice as paid

/api/stripe/status
  GET     checks whether payment-provider credentials are valid

/api/send-invoice-email
  POST    sends invoice email with optional payment link
          can send a copy to the company email

/api/users
  GET     list user profiles, admin only
  PUT     update user role, admin only
```

## 3. Database Structure

### 3.1 Core Tables

#### profiles

Stores application profile data for each authenticated account.

```text
profiles
  id uuid primary key
    references auth.users(id)
    deletes with auth user

  email text not null
  full_name text nullable
  avatar_url text nullable

  role text default 'user'
    allowed values: 'admin', 'user'

  stripe_account_id text nullable
  stripe_account_enabled boolean default false

  updated_at timestamptz default now()
```

Important behavior:

- A profile is created automatically when a new auth user is created.
- `admin@stratonally.com` is automatically assigned the `admin` role.
- Admin role can also be granted or revoked through the users screen.
- Profile role is used throughout the app for admin gating.

Relationships:

- `profiles.id` is referenced by invoices as `seller_id`.
- `profiles.id` is referenced by clients as `user_id`.
- Older order/product tables also reference profiles.

#### companies

Stores business entities that can appear on invoices.

```text
companies
  id uuid primary key default generated uuid
  name text not null
  email text not null
  address text nullable
  phone text nullable
  website text nullable
  logo_url text nullable
  logo_has_dark_bg boolean default false
  payment_base_url text nullable
  tax_id text nullable
  stripe_account_id text nullable
  is_active boolean default true
  created_at timestamptz default now()
  updated_at timestamptz default now()
```

Important behavior:

- Only admins can create, update, delete, activate, or deactivate companies.
- Any authenticated user can view companies.
- Active companies are used in invoice generation.
- Company information is copied into invoice metadata at the time the invoice is saved.
- `payment_base_url` controls generated invoice payment links. If it is set, the payment URL becomes:

```text
{payment_base_url}/pay/{invoice_id}
```

If not set, payment links use the current app origin.

#### clients

Stores reusable invoice recipients.

```text
clients
  id uuid primary key default generated uuid
  user_id uuid not null
    references profiles(id)
    deletes with profile

  name text not null
  email text not null
  company_name text nullable
  phone text nullable
  address text nullable
  notes text nullable
  is_active boolean default true
  created_at timestamptz default now()
  updated_at timestamptz default now()
```

Important behavior:

- Normal users can manage their own clients only.
- Admins can view and manage all clients.
- Active clients are shown in invoice recipient pickers.
- Archived clients remain in the directory but are hidden from active workflows.
- Client details are copied into invoice metadata when an invoice is saved.

#### invoices

Stores saved invoices and payment state.

```text
invoices
  id uuid primary key default generated uuid
  invoice_number text not null

  seller_id uuid not null
    references profiles(id)
    deletes with seller profile

  client_id uuid nullable
    references clients(id)
    sets null if client deleted

  client_email text not null
  amount_in_cents integer not null
    must be >= 0

  currency text default 'gbp'
  description text nullable
  due_date timestamptz nullable

  status text default 'pending'
    allowed values: 'pending', 'paid', 'failed', 'canceled'

  stripe_payment_intent_id text nullable
  metadata jsonb default '{}'
  created_at timestamptz default now()
  updated_at timestamptz default now()
```

Important behavior:

- Saved invoice amount is the total, stored in cents.
- Currency is stored lower-case in saved records.
- Invoice status starts as `pending`.
- Payment success changes status to `paid`.
- Public invoice pages can load invoices without requiring client login.
- Invoice lookup supports both UUID and invoice number.
- Invoice metadata carries the renderable invoice snapshot.

Expected `metadata` shape for generated invoices:

```json
{
  "company": {
    "id": "company id",
    "name": "company name",
    "email": "company email",
    "address": "company address",
    "phone": "company phone",
    "website": "company website",
    "logoUrl": "public logo url",
    "logoHasDarkBg": false,
    "paymentBaseUrl": "optional custom base url",
    "taxId": "optional tax id"
  },
  "client": {
    "name": "client name",
    "email": "client email",
    "address": "client address"
  },
  "items": [
    {
      "id": "line item id",
      "serviceId": "optional service id",
      "serviceName": "optional service name",
      "description": "work description",
      "quantity": 1,
      "rate": 100,
      "amount": 100
    }
  ],
  "subtotal": 100,
  "tax": 20,
  "taxRate": 20,
  "total": 120,
  "notes": "optional invoice notes"
}
```

#### invoice_services

Stores reusable service/category names for invoice line items.

```text
invoice_services
  id uuid primary key default generated uuid
  name text not null
  description text nullable
  default_rate integer default 0
  created_at timestamptz default now()
  updated_at timestamptz default now()
```

Important behavior:

- Any authenticated user can view services.
- Only admins can create, update, or delete services.
- Seeded defaults:
  - Consulting
  - Development
  - Design
  - Support
- Services appear in the invoice generator line-item service picker.

### 3.2 Older/Legacy Tables Still Present

These tables exist in the database layer and helper functions, but the current visible product centers on companies, clients, invoices, invoice services, users, and payments.

#### products

```text
products
  id uuid primary key default generated uuid
  user_id uuid not null references profiles(id)
  title text not null
  description text nullable
  price integer not null
  currency text default 'usd'
  is_active boolean default true
  created_at timestamptz default now()
  updated_at timestamptz default now()
```

#### orders

```text
orders
  id uuid primary key default generated uuid
  buyer_id uuid nullable references profiles(id)
  seller_id uuid not null references profiles(id)
  product_id uuid nullable references products(id)
  amount integer not null
  currency text default 'usd'
  stripe_payment_intent_id text nullable
  stripe_transfer_id text nullable
  status order_status default 'pending'
  metadata jsonb default '{}'
  created_at timestamptz default now()
  updated_at timestamptz default now()
```

`order_status` enum:

```text
pending
succeeded
failed
refunded
canceled
```

### 3.3 Storage

#### company-logos bucket

Stores uploaded company logos.

Behavior:

- Public read access.
- Authenticated users can upload logos.
- Users can update/delete their own uploaded logo objects.
- Uploaded logo URLs are saved on company records as `logo_url`.
- Company form supports an option for logos that need a dark background.

### 3.4 Functions and Triggers

#### set_updated_at()

Trigger function that updates `updated_at` before row updates.

Used by:

- profiles
- products
- orders
- invoices
- clients
- companies
- invoice_services

#### handle_new_user()

Trigger function that creates a `profiles` row whenever a new auth user is created.

Behavior:

- Copies auth user ID.
- Copies email.
- Copies full name and avatar URL from user metadata.
- Assigns `admin` role when email is `admin@stratonally.com`; otherwise assigns `user`.

#### is_admin(user_id uuid default auth.uid())

Helper function used by access policies.

Behavior:

- Checks whether a profile has role `admin`.
- Used to avoid recursive profile policy lookups.
- Callable by authenticated users only.

### 3.5 Indexes

```text
profiles
  idx_profiles_stripe_account(stripe_account_id)

products
  idx_products_user_id(user_id)

orders
  idx_orders_seller_id(seller_id)
  idx_orders_buyer_id(buyer_id)
  idx_orders_stripe_pi(stripe_payment_intent_id)
  idx_orders_status(status)

invoices
  idx_invoices_seller_id(seller_id)
  idx_invoices_client_id(client_id)
  idx_invoices_status(status)
  idx_invoices_stripe_pi(stripe_payment_intent_id)
  idx_invoices_number(invoice_number)

clients
  idx_clients_user_id(user_id)
  idx_clients_email(email)
  idx_clients_is_active(is_active)
```

## 4. Access Control Model

### 4.1 Roles

```text
admin
  Can manage companies
  Can manage invoice services
  Can view/manage all clients
  Can view dashboard data across users
  Can view all profiles
  Can change other users' roles

user
  Can manage own clients
  Can create own invoices
  Can view own dashboard data
  Can edit own profile
  Can use terminal and invoice generator
```

### 4.2 Important Access Rules

Profiles:

- Users can select their own profile.
- Admins can select all profiles.
- Users can insert their own profile.
- Users and admins can update profiles, subject to policy checks.

Companies:

- Authenticated users can view companies.
- Admins can create, update, and delete companies.

Clients:

- Users can manage rows where `user_id` equals their own ID.
- Admins can manage all rows.
- Insert/update checks prevent ownership reassignment by non-admin users.

Invoices:

- Sellers can manage their own invoices.
- Admins can manage all invoices.
- Public invoice payment page can read invoice data through the public API route.

Invoice services:

- Authenticated users can read services.
- Admins can manage services.

## 5. Functional Modules

### 5.1 Authentication

Core behavior:

- Users can sign up with email, password, and name.
- Email verification is expected before dashboard access.
- Users can sign in with email/password.
- Users can request a password recovery email.
- Users can sign out.
- Auth state is watched globally.
- Profile data is fetched after auth state changes to merge role data into the in-app user object.

Special behavior:

- The app does not manually create a profile during sign-up because the session may still be anonymous before email verification.
- Profile creation is delegated to the database trigger.
- On sign-in, if a legacy user has no profile row, the app attempts to create one.
- Auth error messages are normalized into user-friendly messages.

### 5.2 Layout and Navigation

Authenticated pages use a sidebar layout.

Navigation areas:

- Dashboard
- Clients
- Companies
- Invoice Generator
- Terminal
- Settings
- Users, visible/admin-accessible for admins

The users page redirects non-admin users back to the dashboard.

### 5.3 Dashboard

Dashboard data source:

- Calls `/api/dashboard-data`.
- Receives invoices, clients, and companies.
- Admin receives global data.
- Normal user receives own invoices and clients.

Displayed stats:

- Total revenue from paid invoices.
- Total invoiced across all visible invoices.
- Total invoice count.
- Paid invoice count.
- Pending invoice count.
- Overdue invoice count, currently hard-coded as zero.
- Active client count.
- Revenue growth, currently mocked as 12.5% when there are paid invoices.

Company filtering:

- Invoices are linked to companies through invoice metadata:

```text
invoice.metadata.company.id
```

- The dashboard can filter visible stats and invoice rows by selected company.

Charts:

- Revenue chart uses six fixed months: Jan to Jun.
- Revenue values are derived from total paid revenue with simple multipliers.
- Company revenue chart sums paid invoice totals by company.

Recent invoice table:

- Displays up to eight invoices.
- Shows invoice number, client name, company name, amount, status, and due date.
- Provides share dialog.
- Provides a direct payment page link.

### 5.4 Company Management

Company directory behavior:

- Authenticated users can load companies.
- Admin users can create, edit, delete, activate, and deactivate companies.
- Company stats exist in local UI shape but are currently set to zero when mapping from database.

Company form fields:

- Name
- Email
- Address
- Phone
- Website
- Logo URL
- Logo background preference
- Payment base URL
- Tax ID

Logo upload behavior:

- Accepts image files only.
- Uploads to the public company logo bucket.
- Stores the resulting public URL on the company form.
- User can remove logo URL from the form.
- User can toggle dark background display for the logo.

Payment-provider connection behavior:

- Company management checks `/api/stripe/status`.
- UI shows connected/disconnected/checking.
- This is a credential-level status check, not per-company account onboarding.

Company usage in invoices:

- Invoice generator requires an active company.
- Saved invoice metadata embeds the selected company snapshot.
- Company-specific payment base URL influences generated payment links.

### 5.5 Client Management

Client directory behavior:

- Loads clients from `/api/clients`.
- Normal users see only their own clients.
- Admins see all clients.
- Displays total, active, and archived counts.
- Search checks name, email, company name, phone, and address.

Client fields:

- Name
- Email
- Company name
- Phone
- Address
- Notes
- Active status

Validation:

- Name is required.
- Email is required.
- Email must match a basic email pattern.

Actions:

- Add client.
- Edit client.
- Archive/reactivate client.
- Delete client after confirmation.

Invoice relationship:

- Invoice generator requires selecting a saved active client.
- Saved invoice references the client by `client_id`.
- Saved invoice stores `client_email`.
- Saved invoice metadata stores a client snapshot for rendering.

### 5.6 Invoice Generator

Initial behavior:

- Loads active companies.
- Loads active clients.
- Loads invoice services.
- Loads recent invoices.
- Generates an invoice number when none exists.
- Creates an initial line item when none exists.

Invoice inputs:

- Company selection.
- Client selection.
- Invoice number.
- Due date.
- Currency.
- Line items.
- Tax percentage.
- Notes.

Line item fields:

- Service/category.
- Description.
- Quantity.
- Rate.
- Amount.

Line item behavior:

- User can add a line.
- User can remove a line as long as at least one remains.
- Selecting a service can populate service-related display data.
- Changing quantity or rate recalculates amount.

Totals:

```text
subtotal = sum(line item amounts)
tax = subtotal * taxRate / 100
total = subtotal + tax
amount_in_cents = round(total * 100)
```

Validation before save:

- Company is required.
- Client is required.
- At least one meaningful billable line item is required.

Save behavior:

- Inserts invoice with:
  - `invoice_number`
  - current user as `seller_id`
  - selected saved client ID
  - selected client email
  - total amount in cents
  - selected currency
  - description from first meaningful line item, or invoice number fallback
  - due date
  - status `pending`
  - metadata snapshot with company, client, items, subtotal, tax, tax rate, total, notes

After save:

- Shows saved success state.
- Enables send-email dialog.
- Enables share dialog.
- Enables direct payment link.
- Recent invoices list updates through reload logic.

Recent invoice list:

- Shows invoice number.
- Shows company name from metadata.
- Shows amount.
- Shows creation date/time.
- Shows status.
- Provides share and payment-link actions.

### 5.7 Invoice Preview

Preview uses the invoice draft data before save.

Displays:

- Company branding and details.
- Invoice number.
- Client details.
- Due date.
- Line items.
- Subtotal.
- Tax if applicable.
- Total.
- Notes.

### 5.8 Invoice Sharing

Payment link generation:

```text
if invoice metadata/company has paymentBaseUrl or payment_base_url:
  link = normalized payment base URL + /pay/{invoiceId}
else:
  link = current browser origin + /pay/{invoiceId}
```

Share dialog supports:

- Full payment link copy.
- Short link copy.
- Email template opened in Gmail.
- WhatsApp message.
- SMS message.
- QR code display.
- QR code download as PNG.
- PDF invoice generation and download.

PDF behavior:

- Builds an off-screen printable invoice.
- Converts it to a high-resolution image.
- Places image into an A4 PDF.
- Adds a clickable payment-link annotation around the pay button area.
- Saves as `Invoice-{invoiceNumber}.pdf`.

Email dialog supports:

- Recipient email.
- Subject.
- Message body.
- Include/exclude payment link.
- Send copy to company email.
- Copy payment link.
- Sends through `/api/send-invoice-email`.

Email API behavior:

- Requires recipient, subject, and message.
- Appends payment URL instructions when payment URL is supplied.
- Sends plain text and HTML versions.
- Optionally sends copy to company email.

### 5.9 Public Invoice Payment

Public route:

```text
/pay/{invoiceId}
```

Invoice loading:

- Calls `/api/invoices/{invoiceId}`.
- API first tries to find by invoice `id`.
- If not found, it tries `invoice_number`.
- Service-level database access is used so clients do not need an account.

Invoice display:

- Company details from metadata, with fallback values.
- Client details from metadata, with fallback values.
- Invoice number from `invoice_number`, metadata, or truncated ID.
- Due date from invoice row or metadata.
- Line items from metadata.
- Subtotal/tax/total from metadata and invoice amount.
- Notes from metadata.
- Status badge.

Payment behavior:

- If status is `pending`, show payment form.
- If status is `paid`, show payment success state.
- If query param `success=true` is present, show success state.

Payment intent creation:

- Payment form calls `/api/payments/create-intent`.
- API requires `invoiceId`.
- API rejects missing or non-pending invoices.
- Payment intent metadata includes:
  - invoiceId
  - sellerId
  - clientId
- Payment intent ID is stored on the invoice row.

Webhook payment completion:

- Payment-success webhook reads `invoiceId` from payment metadata.
- Updates matching invoice:
  - `status = paid`
  - `stripe_payment_intent_id = payment intent id`

### 5.10 Payment Terminal

The terminal is separate from saved invoice payments.

Inputs:

- Amount.
- Currency.
- Description.
- Customer email.
- Customer name.
- Customer phone.
- Payment method.

Payment methods:

- Card.
- Mobile payment.
- QR payment.
- Payment link.

Processing fee calculation:

```text
processingFee = amount * processingFeeRate + processingFeeFixed
totalWithFees = amount + processingFee
```

Default local settings:

```text
defaultCurrency = GBP
defaultTaxRate = 20%
processingFeeRate = 2.9%
processingFeeFixed = 0.20
```

Card behavior:

- Creates a payment intent using `/api/create-payment-intent`.
- Uses total-with-fees amount.
- Shows embedded card confirmation form after intent creation.
- On success, adds a completed transaction to local state.

Non-card behavior:

- Mobile, QR, and link flows are simulated/local UI flows.
- Successful non-card processing adds a completed transaction to local state.

Payment link behavior:

- Can generate/copy a terminal payment link.
- Supports email/SMS/both messaging intent in UI.

Local transaction shape:

```text
transaction
  id
  amount
  currency
  description
  customerEmail
  customerName
  customerPhone
  paymentMethod
  status
  date
  processingFee
  totalWithFees
  methodDetails
```

Persistence:

- Terminal settings, invoice service display cache, and transactions are persisted in browser local storage under `payment-terminal-storage`.
- Companies are not persisted locally in this store; they come from the database.

### 5.11 Settings

Profile settings:

- Displays current user name and email.
- Edit mode allows name/email changes.
- Profile photo upload accepts image files under 500 KB.
- Profile photo is converted to base64 and stored locally under:

```text
profilePhoto_{user.id}
```

Preferences:

- Dark mode toggle.
- Email alerts toggle. This is local UI state in the current implementation.

Admin invoice services:

- Admins can view invoice services section.
- Admins can add a service by name.
- Admins can delete a service.
- Service list is synchronized with app store after database changes.

Security actions:

- Sign out of all sessions button signs out the current user and routes back to login.
- Reset API keys button is present as UI only in current behavior.

### 5.12 User Management

Admin-only screen.

Behavior:

- Fetches users from `/api/users`.
- Shows profile list.
- Search by email or full name.
- Toggle user role between `admin` and `user`.
- Current admin cannot change their own role.
- Role updates are persisted to profile rows.

## 6. Data Lifecycles

### 6.1 New User Lifecycle

```text
User signs up
  -> auth user is created
  -> database trigger creates profile row
  -> profile role is assigned
  -> user verifies email
  -> user signs in
  -> app fetches profile
  -> app merges role into current user object
  -> dashboard becomes available
```

### 6.2 Company Lifecycle

```text
Admin creates company
  -> company row saved
  -> optional logo uploaded to public bucket
  -> company can be active/inactive
  -> active company appears in invoice generator
  -> selected company snapshot is copied into invoice metadata
  -> payment links may use company payment_base_url
```

### 6.3 Client Lifecycle

```text
User creates client
  -> client row saved with user_id
  -> active client appears in invoice generator
  -> client can be archived
  -> selected client snapshot is copied into invoice metadata
  -> invoice keeps client email even if client row later changes
```

### 6.4 Invoice Lifecycle

```text
User selects company and client
  -> user enters invoice details and line items
  -> app calculates subtotal, tax, and total
  -> user saves invoice
  -> invoice row is created as pending
  -> share/email/payment actions become available
  -> client opens public payment page
  -> payment intent is created
  -> payment intent ID is saved on invoice
  -> payment succeeds
  -> webhook marks invoice paid
  -> dashboard revenue and invoice stats reflect paid invoice
```

### 6.5 Terminal Payment Lifecycle

```text
User enters payment details
  -> app calculates processing fee and total with fees
  -> card method creates payment intent and confirms card payment
  -> non-card methods simulate processing
  -> completed terminal transaction is stored locally
```

## 7. Rebuild Checklist

To recreate this product in another project, implement these capabilities in order:

1. User profiles with `admin` and `user` roles.
2. Automatic profile creation when a new auth user is created.
3. Admin-only company management with logo upload and active/inactive status.
4. User-owned client directory with archive/reactivate support.
5. Admin-managed invoice service list.
6. Invoice generator with company/client selection, invoice number, due date, line items, tax, notes, and total calculation.
7. Invoice persistence with metadata snapshots for company, client, line items, totals, and notes.
8. Public invoice payment route that can load invoices without requiring client login.
9. Payment-intent creation for pending invoices.
10. Webhook that marks invoices paid.
11. Dashboard aggregation for revenue, invoice counts, client counts, company filtering, and recent invoices.
12. Share workflows: copy link, email, WhatsApp, SMS, QR, and PDF.
13. Admin user management for granting/revoking roles.
14. Settings page for profile, preferences, invoice services, and sign-out.
15. Optional standalone payment terminal with local transaction history.

## 8. Important Implementation Notes

- Invoice rendering should rely on the metadata snapshot, not live company/client rows, so old invoices keep their original branding and recipient data.
- `amount_in_cents` is the authoritative amount for payment creation.
- `invoice.status` controls whether the payment form should be shown.
- Company payment base URL must be normalized with a protocol and without trailing slash before appending `/pay/{invoiceId}`.
- Admin checks exist both in UI and server/API logic.
- Public invoice payment lookup should be careful: it enables client payment without login.
- The payment webhook depends on payment metadata containing `invoiceId`.
- Dashboard company filtering depends on `invoice.metadata.company.id`.
- Terminal transactions are local-only in the current implementation and are separate from saved invoices.
- Some dashboard values are currently derived or mocked rather than independently persisted:
  - revenue growth
  - six-month revenue chart distribution
  - overdue invoice count
  - company card revenue/invoice/client stats
- Older product/order tables exist but are not central to the current user-facing flow.

