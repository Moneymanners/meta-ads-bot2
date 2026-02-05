# 🚀 Meta Ads Optimizer Bot

An AI-powered budget optimization system for Meta (Facebook) Ads that learns from your campaign performance and automatically optimizes budgets based on hourly patterns.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Meta+Ads+Optimizer+Dashboard)

## ✨ Features

- **📊 Hourly Performance Analysis** - Learns which hours perform best for each campaign
- **🤖 AI Recommendations** - Intelligent suggestions for budget adjustments and dayparting
- **⚡ Auto-Optimization** - Optional automatic budget adjustments based on performance
- **📈 Visual Dashboard** - Beautiful charts and real-time metrics
- **🔄 Continuous Learning** - Gets smarter with more data
- **📱 Campaign-Specific Insights** - Each campaign learns independently

---

## 📋 Prerequisites

Before you begin, you'll need:

1. **Meta (Facebook) Developer Account** - [Create one here](https://developers.facebook.com/)
2. **Meta Business Account** with active ad campaigns
3. **Supabase Account** (free tier works) - [Sign up here](https://supabase.com/)
4. **Vercel Account** (free tier works) - [Sign up here](https://vercel.com/)
5. **Node.js 18+** installed locally

---

## 🛠️ Setup Guide

### Step 1: Create Meta App & Get API Access

1. Go to [Meta Developers](https://developers.facebook.com/apps/)
2. Click **Create App** → Choose **Business** → Fill details
3. Add the **Marketing API** product to your app
4. Go to **App Settings > Basic** and copy:
   - `App ID`
   - `App Secret`

5. **Generate Access Token:**
   - Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   - Select your app
   - Click **Generate Access Token**
   - Add permissions: `ads_management`, `ads_read`, `business_management`
   - Click **Generate Access Token** and copy it

6. **Convert to Long-Lived Token:**
   ```bash
   curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_SHORT_TOKEN"
   ```
   Copy the `access_token` from the response.

7. **Get Your Ad Account ID:**
   - Go to [Meta Business Suite](https://business.facebook.com/)
   - Click **Settings** → **Ad Accounts**
   - Copy the Account ID (format: `act_XXXXXXXXX`)

### Step 2: Set Up Supabase Database

1. Go to [Supabase](https://app.supabase.com/) and create a new project
2. Wait for the project to be ready (~2 minutes)
3. Go to **SQL Editor** in the sidebar
4. Copy the contents of `supabase-schema.sql` and paste it
5. Click **Run** to create all tables
6. Go to **Project Settings > API** and copy:
   - `Project URL` (this is your `SUPABASE_URL`)
   - `anon/public` key (this is your `SUPABASE_ANON_KEY`)

### Step 3: Deploy to Vercel

#### Option A: One-Click Deploy (Easiest)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/meta-ads-optimizer)

#### Option B: Manual Deploy

1. **Clone/Download the project:**
   ```bash
   cd meta-ads-bot
   ```

2. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

3. **Login to Vercel:**
   ```bash
   vercel login
   ```

4. **Deploy:**
   ```bash
   vercel
   ```

5. **Set Environment Variables:**
   ```bash
   vercel env add META_APP_ID
   vercel env add META_APP_SECRET
   vercel env add META_ACCESS_TOKEN
   vercel env add META_AD_ACCOUNT_ID
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   vercel env add CRON_SECRET
   ```

6. **Redeploy with environment variables:**
   ```bash
   vercel --prod
   ```

### Step 4: Set Up Automated Sync (Cron Job)

The bot needs to sync data hourly to learn and optimize. Choose one option:

#### Option A: Vercel Cron (Recommended)

Create `vercel.json` in your project root:
```json
{
  "crons": [
    {
      "path": "/api/sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

#### Option B: External Cron Service

Use [cron-job.org](https://cron-job.org/) (free):
1. Create account
2. Add new cron job
3. URL: `https://your-app.vercel.app/api/sync`
4. Method: `POST`
5. Schedule: Every hour
6. Add header: `Authorization: Bearer YOUR_CRON_SECRET`

#### Option C: Local Cron (for testing)

```bash
# Install dependencies
npm install

# Run cron manually
node scripts/cron-job.js
```

---

## 🎮 Usage

### Dashboard

1. Visit your deployed URL (e.g., `https://your-app.vercel.app`)
2. Click **Sync Data** to pull data from Meta
3. Select a campaign to view its analysis
4. Review recommendations and apply them

### Understanding the Scores

| Score | Meaning | Action |
|-------|---------|--------|
| 70-100 | 🟢 High performer | Increase budget |
| 50-69 | 🟡 Good | Maintain |
| 30-49 | 🟠 Below average | Monitor closely |
| 0-29 | 🔴 Poor performer | Decrease budget |

### Recommendations

The bot generates these types of recommendations:

- **Budget Increase** - Hours with ROAS > 1.1x and low CPA
- **Budget Decrease** - Hours losing money (ROAS < 0.9x)
- **Dayparting** - Suggests ad scheduling based on patterns
- **Immediate Action** - Current hour is historically terrible

---

## ⚙️ Configuration

### Settings (in Dashboard)

| Setting | Description | Default |
|---------|-------------|---------|
| Auto-Optimize | Automatically apply high-confidence recommendations | Off |
| Max Budget Increase | Maximum % budget can increase | 30% |
| Max Budget Decrease | Maximum % budget can decrease | 30% |

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `META_APP_ID` | Your Meta App ID | ✅ |
| `META_APP_SECRET` | Your Meta App Secret | ✅ |
| `META_ACCESS_TOKEN` | Long-lived access token | ✅ |
| `META_AD_ACCOUNT_ID` | Ad Account ID (act_XXX) | ✅ |
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `CRON_SECRET` | Secret for cron authentication | ✅ |

---

## 🔒 Security Notes

1. **Never commit `.env` files** - Use Vercel's environment variables
2. **Rotate tokens regularly** - Meta tokens expire after 60 days
3. **Use CRON_SECRET** - Protects your sync endpoint
4. **Enable Supabase RLS** - For production, enable Row Level Security

---

## 📊 How the AI Works

### Learning Process

1. **Data Collection**: Hourly metrics synced from Meta API
2. **Pattern Detection**: Identifies high/low performing hours per campaign
3. **Scoring**: Weights ROAS (35%), CPA (30%), CVR (20%), Volume (15%)
4. **Recommendations**: Generates actionable insights with confidence levels

### Scoring Formula

```
Score = (ROAS_normalized × 0.35) + 
        (CPA_normalized × 0.30) + 
        (CVR_normalized × 0.20) + 
        (Volume_normalized × 0.15)
```

---

## 🚨 Troubleshooting

### "Meta API Error: Invalid OAuth access token"

Your token expired. Generate a new long-lived token (Step 1.6).

### "No campaigns found"

1. Check your `META_AD_ACCOUNT_ID` is correct (format: `act_XXXXXXXXX`)
2. Ensure you have active campaigns
3. Verify your access token has `ads_read` permission

### "Supabase error"

1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
2. Ensure you ran the SQL schema
3. Check table permissions

### Data not syncing

1. Verify cron job is running
2. Check Vercel function logs
3. Test manually: `curl -X POST https://your-app.vercel.app/api/sync`

---

## 🗺️ Roadmap

- [ ] Slack/Email notifications for recommendations
- [ ] Multi-account support
- [ ] A/B test budget strategies
- [ ] Creative performance analysis
- [ ] Audience insights integration
- [ ] Prediction models (ML)

---

## 📄 License

MIT License - Feel free to use and modify for your needs.

---

## 🆘 Support

- **Issues**: Open a GitHub issue
- **Questions**: Contact your developer

---

Built with ❤️ for smarter ad spend
