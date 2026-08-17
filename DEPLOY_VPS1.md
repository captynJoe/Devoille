# Dévoilé Essentials VPS1 Deploy

This site is a standalone storefront and admin app. It does not depend on `captyn_ecommerce`.

## Deploy with Docker Compose

```bash
cd /home/captyn/dveil-essentials
docker compose up -d --build
```

The container serves the app on:

```text
http://<vps1-ip>:8090
```

## Data

The app runs on Python stdlib plus SQLite. Docker persists the database in the `devoile-data` volume at `/data/devoile.sqlite3` inside the container. Products, uploads, sessions, orders, tasks, subscribers, and admin actions are read from real API routes backed by that database.

## Google Login

Set these before rebuilding if you want Google sign-in enabled:

```bash
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
export GOOGLE_REDIRECT_URI="http://84.247.174.52:8090/api/auth/google/callback"
docker compose up -d --build
```

Without those values, email login still works and the Google button shows a configuration error.

## M-PESA STK Push

M-PESA is wired through Safaricom Daraja STK Push. Add the credentials to `.env`, then rebuild the container. Keep `.env` private.

```bash
MPESA_ENVIRONMENT=live
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_BUSINESS_SHORT_CODE=...
MPESA_PASSKEY=...
MPESA_CALLBACK_URL=https://your-domain.example/api/payments/mpesa/callback
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline
MPESA_ACCOUNT_REFERENCE=Devoille
MPESA_PARTY_B=... # optional; defaults to the shortcode
```

The checkout page sends an STK prompt to the customer's Safaricom number, stores the order as pending, and polls `/api/payments/mpesa/status?orderId=...` until the callback marks it paid or failed. PesaPal remains available as a fallback method.

## Optional Nginx Reverse Proxy

```nginx
server {
  listen 80;
  server_name devoile.example.com;

  location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then enable TLS with your normal certbot flow.
