# 🚀 AtlasConcours 100% FREE Deployment Guide

This guide explains how to deploy AtlasConcours to **Render** or **Railway** completely **100% for free**, utilizing **MongoDB Atlas Free Tier** for persistent, cloud-based data storage.

---

## 💾 Step 1: Create a Free MongoDB Atlas Database

Since free hosting tiers (Render & Railway) have ephemeral file systems (meaning `db.json` is wiped every time the server restarts), AtlasConcours is pre-configured to automatically sync your database JSON to a free MongoDB Atlas instance if `MONGODB_URI` is provided.

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and register for a **Free Account**.
2. Click **Create** to deploy a new cluster, and select the **M0 Free** shared cluster tier.
3. Choose a region (AWS or Google Cloud) closest to your target audience (e.g. Frankfurt or Ireland for Moroccan latency).
4. Under **Security Quickstart**:
   - Create a database user (e.g. `atlas_admin`) and copy the password.
   - Under IP Access List, add `0.0.0.0/0` (allow access from anywhere) so that Render or Railway can securely connect to it.
5. Go to your **Database Cluster Dashboard**, click **Connect** -> **Drivers**.
6. Copy your **Connection String**. It should look like this:
   ```
   mongodb+srv://atlas_admin:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
7. Replace `<db_password>` with the password you created.

---

## 🛠️ Step 2: Prep your Git Repository

Ensure your local repository is initialized and committed before pushing online:

1. Open your terminal in the root folder (`atlasconcours/`).
2. Run the following commands to commit everything:
   ```bash
   git init
   git add .
   git commit -m "chore: configure 100% free database and deployment"
   ```

---

## 🌐 Step 3: Push to GitHub

1. Create a new repository on your GitHub account (name it `atlasconcours`).
2. Run the commands provided by GitHub to link and push your repository:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/atlasconcours.git
   git branch -M main
   git push -u origin main
   ```

---

## ☁️ Option A: Deploying on Render (100% Free)

Render will read your repository's `render.yaml` blueprint and spin up a completely free web server.

### Steps to Deploy:
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New** -> **Blueprint**.
2. Connect your GitHub account and select your `atlasconcours` repository.
3. Render will read the `render.yaml` file in your repository automatically!
4. You will be prompted to approve the blueprint. Enter the missing secret variables:
   - **`MONGODB_URI`**: The connection string you copied from Step 1.
   - **`JWT_SECRET`**: A long, secure random string (e.g. `your-random-token-here`).
   - **`GEMINI_API_KEY`**: Your active Gemini API key (or leave empty to run ANAPEC scrapers in fallback mode).
5. Click **Apply**. Render will automatically build the React frontend, compile it into the backend's static directory, and spin up the Express server on their free tier.

---

## ☁️ Option B: Deploying on Railway (100% Free)

Railway will read your repository config and build via Nixpacks using the `railway.toml` file.

### Steps to Deploy:
1. Go to [Railway Dashboard](https://railway.app/) and click **New Project** -> **Deploy from GitHub**.
2. Select your `atlasconcours` repository.
3. Add the following environment variables in the Railway dashboard (`Variables` tab):
   - **`MONGODB_URI`**: The connection string you copied from Step 1.
   - `JWT_SECRET`: A long, secure random string.
   - `GEMINI_API_KEY`: Your active Gemini API key.
   - `NODE_ENV`: `production`
   - `RUN_SCRAPER_ON_START`: `false`
4. Click **Deploy**. Railway will handle the build and expose your backend server.

---

## ⏰ Cron Jobs in Production
The hourly ANAPEC scraper (`0 * * * *`) and daily scrapers are powered by `node-cron` inside the active Express server:
- **Zero Configuration Needed:** As long as your server container is active, the cron scheduler runs automatically in the background.
- **Render Free Tier Warning:** If using Render's free tier, the container spins down (sleeps) after 15 minutes of zero traffic. When it sleeps, the cron job stops. To keep it awake:
  - Add a free Uptime monitor like [UptimeRobot](https://uptimerobot.com/) to ping your web service URL once every 10 minutes.
  - This keeps your 100% free app alive 24/7 so scrapers run successfully every hour!
