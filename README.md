# CC Hair & Beauty — Consultation App
## Setup Guide for cchairandbeauty.com

---

## What this does
- Secure backend on Vercel that safely connects to your Shopify store
- Your Shopify Admin API token stays hidden on the server — never exposed to customers
- Full AI hair consultation with your real products recommended

---

## Step 1 — Create a free GitHub account
1. Go to **github.com**
2. Click **Sign up** — use your cchairnbeauty@gmail.com
3. Verify your email

---

## Step 2 — Create a new GitHub repository
1. Once logged in, click the **+** button (top right) → **New repository**
2. Name it: `cc-hair-beauty-consultation`
3. Set to **Private**
4. Click **Create repository**

---

## Step 3 — Upload these files to GitHub
Upload ALL these files in the same folder structure:
```
cc-hair-beauty-consultation/
├── api/
│   └── products.js
├── public/
│   └── index.html
├── .gitignore
├── .env.example
├── package.json
└── vercel.json
```

To upload:
1. On your new repo page click **uploading an existing file**
2. Drag and drop all the files
3. Click **Commit changes**

---

## Step 4 — Create a free Vercel account
1. Go to **vercel.com**
2. Click **Sign Up** → choose **Continue with GitHub**
3. This connects Vercel to your GitHub automatically

---

## Step 5 — Deploy to Vercel
1. On Vercel dashboard click **Add New → Project**
2. Find your `cc-hair-beauty-consultation` repo and click **Import**
3. Leave all settings as default
4. Click **Deploy**
5. Wait about 60 seconds — it will give you a live URL like `cc-hair-beauty.vercel.app`

---

## Step 6 — Add your secret credentials to Vercel
This is where your Shopify token goes — safely stored on the server:

1. In Vercel, go to your project → **Settings → Environment Variables**
2. Add these two variables:

| Name | Value |
|------|-------|
| `SHOPIFY_DOMAIN` | `cchairandbeauty.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | *(your token from the Abandoned Carts app — the one ending in ca0e — reveal it from Shopify admin)* |

3. Click **Save**
4. Go to **Deployments** → click **Redeploy** so it picks up the new variables

---

## Step 7 — Add to your Shopify store
1. Log into Shopify Admin
2. Go to **Online Store → Pages → Add page**
3. Name it **Hair Consultation**
4. Click the `<>` HTML button in the editor
5. Paste this single line:
```html
<iframe src="https://YOUR-APP.vercel.app" width="100%" height="900px" frameborder="0" style="border:none;border-radius:16px;"></iframe>
```
*(Replace YOUR-APP with your actual Vercel URL)*
6. Click **Save**
7. Go to **Navigation** and add this page to your menu

---

## Step 8 — Test with your staff
Share the Vercel URL directly with your team for testing before adding to the store.

Checklist:
- [ ] Hair type selection works for all backgrounds
- [ ] AI diagnosis feels accurate
- [ ] Real CC products appear in recommendations  
- [ ] Sign up flow is smooth
- [ ] Works well on mobile
- [ ] Newsletter subscription works

---

## Your credentials to find in Shopify
- Go to **Apps → Develop Apps → Abandoned Carts app → API Credentials**
- Reveal the **Admin API access token** (ends in ca0e)
- Copy it and paste into Vercel environment variables

---

## Need help?
Contact a developer and share this README — everything is explained here.
The code is production-ready and secure.
