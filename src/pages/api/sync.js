/**
 * API Route: /api/sync
 * Sync data from Meta Ads API to database
 */

import { createMetaAPI } from '../../lib/meta-api';
import { db } from '../../lib/supabase';
import MetaAdsAPI from '../../lib/meta-api';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const metaApi = createMetaAPI();

    // 1. Fetch and save campaigns
    console.log('Fetching campaigns...');
    const campaigns = await metaApi.getCampaigns();
    
    for (const campaign of campaigns) {
      await db.saveCampaign({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        daily_budget: campaign.daily_budget ? parseInt(campaign.daily_budget) / 100 : null,
      });
    }

    // 2. Fetch hourly insights for last 14 days
    console.log('Fetching insights...');
    const campaignIds = campaigns.map(c => c.id);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    const insights = await metaApi.getHourlyInsights(campaignIds, dateFrom, dateTo);

    // 3. Process and save insights
    console.log(`Processing ${insights.length} insight records...`);
    const processedRecords = [];

    for (const insight of insights) {
      // Parse the hour from the breakdown
      const hourMatch = insight.hourly_stats_aggregated_by_advertiser_time_zone?.match(/(\d{2})/);
      const hour = hourMatch ? parseInt(hourMatch[1]) : null;
      
      if (hour === null) continue;

      // Parse actions
      const actions = MetaAdsAPI.parseActions(insight.actions);
      const actionValues = MetaAdsAPI.parseActionValues(insight.action_values);

      const purchases = actions['purchase'] || actions['omni_purchase'] || 0;
      const revenue = actionValues['purchase'] || actionValues['omni_purchase'] || 0;

      processedRecords.push({
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        date: insight.date_start,
        hour: hour,
        spend: parseFloat(insight.spend) || 0,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0,
        purchases: purchases,
        revenue: revenue,
        cpc: parseFloat(insight.cpc) || 0,
        cpm: parseFloat(insight.cpm) || 0,
        ctr: parseFloat(insight.ctr) || 0,
      });
    }

    // Save to database
    if (processedRecords.length > 0) {
      await db.saveHourlyData(processedRecords);
    }

    res.status(200).json({
      success: true,
      message: 'Data synced successfully',
      stats: {
        campaigns: campaigns.length,
        insightRecords: processedRecords.length,
        dateRange: { from: dateFrom, to: dateTo },
      },
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
}
