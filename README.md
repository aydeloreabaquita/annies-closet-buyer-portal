# Annie's Closet Buyer Portal

A Cloudflare Workers + D1 + R2 buyer portal for Annie's Closet with Facebook Messenger OTP verification.

## Buyer flow

1. Buyer messages the Annie's Closet Facebook Page.
2. Meta sends the message event to `POST /meta/webhook`.
3. The Worker creates a short-lived login link and replies in Messenger with the portal URL.
4. The buyer opens the portal and clicks **Send code to Messenger**.
5. A 6-digit OTP is delivered to that same Page-scoped Messenger account.
6. After OTP verification, linked buyers can see items, approved payments, and remaining balance.
7. Buyer uploads a receipt image; the image is stored privately in R2 and the payment is saved as `pending` in D1.
8. Admin reviews `/admin.html`, approves/rejects the receipt, and the Worker sends a Messenger notification.
9. After an approved payment, the buyer can enter/update the delivery address.

### First-time account linking

A Messenger OTP proves control of a Messenger account, but by itself does **not** prove which spreadsheet buyer name belongs to that Facebook account. For that reason, first-time links are put into an admin approval queue. After the first link is approved, future logins are immediate with Messenger OTP.

This prevents someone from selecting another customer's name and seeing that customer's balance.

## Architecture

- **GitHub** — source repository and version history
- **Cloudflare Workers** — API, static site, Meta webhook, Messenger OTP logic
- **Cloudflare D1** — buyers, items, payment records, sessions, OTP challenges, account links, addresses
- **Cloudflare R2** — private payment receipt images
- **Cloudflare Access** — recommended protection for `/admin.html` and `/api/admin/*`
- **Meta Messenger Platform** — incoming webhook, portal links, OTP codes, payment approval notifications

## 1. Create Cloudflare resources

```bash
npm install
npx wrangler login
npx wrangler d1 create annies-closet
npx wrangler r2 bucket create annies-closet-receipts
```

Copy the D1 database ID into `wrangler.jsonc`.

Apply the schema:

```bash
npm run db:migrate:prod
```

## 2. Configure secrets

Never commit Meta credentials to GitHub.

```bash
npx wrangler secret put META_PAGE_ACCESS_TOKEN
npx wrangler secret put META_VERIFY_TOKEN
npx wrangler secret put META_APP_SECRET
```

Update these non-secret values in `wrangler.jsonc`:

- `APP_URL` — your production URL, e.g. `https://buyers.example.com`
- `META_GRAPH_VERSION` — the Graph API version you use in your Meta app

## 3. Import buyer records

The D1 tables intentionally separate buyers from items. Import your spreadsheet into:

- `buyers`: one row per buyer
- `buyer_items`: one row per sold item

For your current workbook mapping, the earlier source structure was:

- buyer name: column B
- item: column E
- price: column H
- total: column I
- down payment/payment: column J
- full/payment status: column M

Store money as **centavos** (PHP 100.00 = `10000`) to avoid floating-point errors.

Do not put the buyer spreadsheet itself in a public GitHub repository.

## 4. Meta Messenger setup

In Meta for Developers:

1. Create/select your Meta app and connect the Annie's Closet Facebook Page.
2. Enable Messenger and obtain a Page access token with the needed Page messaging permission.
3. Set the webhook callback URL to:
   `https://YOUR_DOMAIN/meta/webhook`
4. Use the same secret text for the webhook verification token and Cloudflare `META_VERIFY_TOKEN`.
5. Subscribe the Page to message events required by your flow.
6. Put the app secret into `META_APP_SECRET` so webhook signatures can be verified.

The Worker replies with the Send API. Standard Messenger policy requires the user to have messaged the Page within the normal messaging window unless another permitted messaging mechanism applies. This design sends the login link and OTP as a direct continuation of the buyer's initiated conversation.

## 5. Admin protection

Before production, create a Cloudflare Access application that protects:

- `/admin.html`
- `/api/admin/*`

Allow only your admin email/account. The starter deliberately does not rely on a shared admin password inside browser JavaScript.

## 6. Deploy from GitHub to Cloudflare

Cloudflare Workers supports Git integration. After pushing this repository to GitHub:

1. Cloudflare Dashboard → Workers & Pages → **Create application**.
2. Choose **Import a repository**.
3. Authorize/select your GitHub repository.
4. Ensure the Worker name matches `name` in `wrangler.jsonc`.
5. Use `npm install` / Cloudflare's detected install step and deploy command `npx wrangler deploy`.
6. Add the D1/R2 bindings and secrets to production/preview settings as appropriate.

Every push to the connected production branch can then build and deploy automatically.

## Local development

Create `.dev.vars` from `.dev.vars.example`, then:

```bash
npm install
npm run db:migrate:local
npm run dev
```

Meta cannot reach localhost directly; use a temporary public tunnel only for development, or deploy a preview Worker and point the test webhook there.

## Security notes

- OTP expires quickly and allows at most 5 failed attempts.
- OTP codes are stored as HMAC hashes, not plaintext.
- Session tokens are stored hashed and sent in `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
- Meta webhook signatures are verified with the app secret.
- Receipt objects are private in R2 and are served only through the admin endpoint.
- First-time Messenger-to-buyer mapping requires admin approval.
- Add Cloudflare Turnstile and rate limiting before a high-volume launch.
- Add data-retention rules for receipt images and old OTP/session rows.

## Production TODOs

- Replace the `AC` circle with Annie's Closet's actual logo asset.
- Import the buyer/item data from the existing workbook.
- Add Cloudflare Access policy for admin routes.
- Add Turnstile/rate limiting.
- Confirm the Meta app's production permissions and messaging policy compliance.
- Add a scheduled cleanup for expired `login_links`, `otp_challenges`, and `sessions`.
