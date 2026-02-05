/**
 * API Route: /api/campaigns
 * Fetch campaigns from database or Meta API
 */

import { createMetaAPI } from '../../lib/meta-api';
import { db } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Try to get from database first
    let campaigns = await db.getCampaigns();

    // If no campaigns in DB, fetch from Meta
    if (!campaigns || campaigns.length === 0) {
      const metaApi = createMetaAPI();
      const metaCampaigns = await metaApi.getCampaigns();

      // Save to database
      for (const campaign of metaCampaigns) {
        await db.saveCampaign({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          daily_budget: campaign.daily_budget ? parseInt(campaign.daily_budget) / 100 : null,
        });
      }

      campaigns = await db.getCampaigns();
    }

    res.status(200).json({ campaigns });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
}
