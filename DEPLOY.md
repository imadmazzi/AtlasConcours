# 🚀 AtlasConcours Vercel Deployment Guide

This guide explains how to deploy AtlasConcours to **Vercel** completely **100% for free**, using **MongoDB Atlas Free Tier** for persistent, cloud-based data storage, and **Vercel Cron Jobs** to automate the scraping task!

---

## 💾 Step 1: Create a Free MongoDB Atlas Database

Since free serverless hosting tiers have ephemeral filesystems, your data is synced directly to a free MongoDB Atlas instance.

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and register for a **Free Account**.
2. Click **Create** to deploy a new cluster, and select the **M0 Free** shared cluster tier.
3. Choose a region (AWS or Google Cloud) closest to your target audience.
4. Under **Security Quickstart**:
   - Create a database user (e.g. `atlas_admin`) and copy the password.
   - Under IP Access List, add `0.0.0.0/0` (allow access from anywhere) so that Vercel serverless functions can connect to it.
5. Go to your **Database Cluster Dashboard**, click **Connect** -> **Drivers**.
6. Copy your **Connection String**. It should look like this:
   ```
   mongodb+srv://atlas_admin:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
7. Replace `<db_password>` with the password you created.

---

## 🛠️ Step 2: Prep your Git Repository

Ensure your local repository is committed before pushing:

1. Open your terminal in the root folder (`atlasconcours/`).
2. Run the following commands to commit everything:
   ```bash
   git add .
   git commit -m "Chore: Migrated deployment configuration from Render to Vercel"
   ```

---

## 🌐 Step 3: Push to GitHub

Ensure your latest changes are pushed to your main branch:
```bash
git push origin main
```

---

## ☁️ Step 4: Import to Vercel

1. Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New** -> **Project**.
2. Import your `atlasconcours` repository from GitHub.
3. In the project setup, expand **Environment Variables** and add:
   - **`MONGODB_URI`**: The connection string from Step 1.
   - **`JWT_SECRET`**: A long, secure random string (e.g. `your-random-token-here`).
   - **`GEMINI_API_KEY`**: Your active Gemini API key.
4. Click **Deploy**. Vercel will build your static frontend assets and provision serverless functions for the Express backend.

---

## ⏰ Step 5: Automated Cron Scraping on Vercel

The scraping process is automated using **Vercel Cron Jobs** configured in `vercel.json`:
- Vercel automatically reads the `crons` schedule and pings your `/api/cron-scraper` route every hour (`0 * * * *`).
- The Express route receives this request and triggers the scrapers (`runAnapecScraper`, `runJobScraper`, and `runScraper`) asynchronously in the background.
- It returns an immediate `200 OK` response to Vercel so that the serverless function does not hit any execution timeouts.
