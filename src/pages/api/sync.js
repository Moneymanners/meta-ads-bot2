import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting sync...');
    
    // Fetch campaigns from Meta
    const campaignsUrl = `https://graph.facebook.com/v18.0/act_${META_AD_ACCOUNT_ID}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&access_token=${META_ACCESS_TOKEN}`;
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (campaignsData.error) {
      console.error('Meta API error:', campaignsData.error);
      return res.status(400).json({ error: campaignsData.error.message });
    }

    const campaigns = campaignsData.data || [];
    console.log(`Found ${campaigns.length} campaigns`);

    // Save campaigns to database
    for (const campaign of campaigns) {
      await supabase
        .from('campaigns')
        .upsert({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          daily_budget: campaign.daily_budget,
          lifetime_budget: campaign.lifetime_budget,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
    }

    // Fetch hourly insights for each campaign
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const since = thirtyDaysAgo.toISOString().split('T')[0];
    const until = today.toISOString().split('T')[0];

    let totalInsightsStored = 0;

    for (const campaign of campaigns) {
      console.log(`Fetching insights for campaign: ${campaign.name} (${campaign.id})`);
      
      try {
        // Fetch hourly insights for this campaign
        const insightsUrl = `https://graph.facebook.com/v18.0/${campaign.id}/insights?fields=spend,impressions,clicks,actions,action_values&time_range={"since":"${since}","until":"${until}"}&time_increment=1&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&access_token=${META_ACCESS_TOKEN}&limit=500`;
        
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();

        if (insightsData.error) {
          console.error(`Error fetching insights for ${campaign.id}:`, insightsData.error);
          continue;
        }

        const insights = insightsData.data || [];
        console.log(`Found ${insights.length} insight records for campaign ${campaign.id}`);

        // Process and store each insight
        for (const insight of insights) {
          // Extract purchases and revenue from actions
          let purchases = 0;
          let revenue = 0;

          if (insight.actions) {
            const purchaseAction = insight.actions.find(a => 
              a.action_type === 'purchase' || 
              a.action_type === 'omni_purchase'
            );
            if (purchaseAction) {
              purchases = parseInt(purchaseAction.value) || 0;
            }
          }

          if (insight.action_values) {
            const revenueAction = insight.action_values.find(a => 
              a.action_type === 'purchase' || 
              a.action_type === 'omni_purchase'
            );
            if (revenueAction) {
              revenue = parseFloat(revenueAction.value) || 0;
            }
          }

          // Parse the hourly stats
          // Meta returns hour in format like "00:00:00 - 00:59:59"
          const hourMatch = insight.hourly_stats_aggregated_by_advertiser_time_zone?.match(/^(\d{2}):/);
          const hour = hourMatch ? parseInt(hourMatch[1]) : 0;

          // Use date_start as the date
          const date = insight.date_start || today.toISOString().split('T')[0];

          const hourlyRecord = {
            campaign_id: campaign.id,  // Store the campaign ID!
            date: date,
            hour: hour,
            spend: parseFloat(insight.spend) || 0,
            impressions: parseInt(insight.impressions) || 0,
            clicks: parseInt(insight.clicks) || 0,
            purchases: purchases,
            revenue: revenue,
            updated_at: new Date().toISOString(),
          };

          // Upsert to database (update if exists, insert if not)
          const { error: upsertError } = await supabase
            .from('hourly_performance')
            .upsert(hourlyRecord, { 
              onConflict: 'campaign_id,date,hour',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error('Upsert error:', upsertError);
          } else {
            totalInsightsStored++;
          }
        }
      } catch (campaignError) {
        console.error(`Error processing campaign ${campaign.id}:`, campaignError);
      }
    }

    console.log(`Sync complete. Stored ${totalInsightsStored} hourly records.`);

    res.status(200).json({
      success: true,
      campaigns: campaigns.length,
      insightsStored: totalInsightsStored,
      message: `Synced ${campaigns.length} campaigns with ${totalInsightsStored} hourly records`,
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync data', details: error.message });
  }
}
