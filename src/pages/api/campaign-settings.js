/**
 * API Route: /api/campaign-settings
 * Get and update per-campaign settings
 */

import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const { campaignId } = req.query;

  if (req.method === 'GET') {
    try {
      if (campaignId) {
        // Get single campaign settings
        const { data, error } = await supabase
          .from('campaign_settings')
          .select('*')
          .eq('campaign_id', campaignId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        
        res.status(200).json({ 
          settings: data || { 
            campaign_id: campaignId,
            auto_optimize: false, 
            max_budget_increase: 30, 
            max_budget_decrease: 30 
          } 
        });
      } else {
        // Get all campaign settings
        const { data, error } = await supabase
          .from('campaign_settings')
          .select('*');

        if (error) throw error;
        res.status(200).json({ settings: data || [] });
      }
    } catch (error) {
      console.error('Error fetching campaign settings:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { campaign_id, auto_optimize, max_budget_increase, max_budget_decrease, target_roas, target_cpa } = req.body;

      const { data, error } = await supabase
        .from('campaign_settings')
        .upsert({
          campaign_id,
          auto_optimize,
          max_budget_increase,
          max_budget_decrease,
          target_roas,
          target_cpa,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'campaign_id' });

      if (error) throw error;
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating campaign settings:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
