/**
 * Cron Job Script
 * Run this every hour to sync data and auto-optimize
 * 
 * Usage: 
 * - Local: node scripts/cron-job.js
 * - Vercel: Set up via vercel.json cron
 * - External: Use cron-job.org or similar
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

const CRON_SECRET = process.env.CRON_SECRET;

async function runCron() {
  console.log(`[${new Date().toISOString()}] Starting hourly optimization job...`);

  try {
    // 1. Sync data from Meta
    console.log('Syncing data from Meta...');
    const syncRes = await fetch(`${BASE_URL}/api/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });
    const syncData = await syncRes.json();
    console.log('Sync result:', syncData);

    // 2. Get all campaigns
    const campaignsRes = await fetch(`${BASE_URL}/api/campaigns`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });
    const { campaigns } = await campaignsRes.json();

    // 3. Analyze each campaign
    for (const campaign of campaigns) {
      console.log(`Analyzing campaign: ${campaign.name}...`);
      
      const analysisRes = await fetch(
        `${BASE_URL}/api/analyze?campaignId=${campaign.id}`,
        { headers: { 'Authorization': `Bearer ${CRON_SECRET}` } }
      );
      const analysis = await analysisRes.json();

      if (analysis.recommendations?.length > 0) {
        console.log(`Found ${analysis.recommendations.length} recommendations for ${campaign.name}`);
        
        // Auto-apply if enabled (check settings)
        const settingsRes = await fetch(`${BASE_URL}/api/settings`, {
          headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
        });
        const { settings } = await settingsRes.json();

        if (settings?.auto_optimize) {
          for (const rec of analysis.recommendations) {
            if (rec.confidence === 'high' && (rec.priority === 'high' || rec.priority === 'urgent')) {
              console.log(`Auto-applying recommendation: ${rec.type}`);
              await fetch(`${BASE_URL}/api/apply-recommendation`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${CRON_SECRET}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ recommendationId: rec.id, action: 'apply' }),
              });
            }
          }
        }
      }
    }

    console.log(`[${new Date().toISOString()}] Cron job completed successfully`);
  } catch (error) {
    console.error('Cron job failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runCron();
}

module.exports = { runCron };
