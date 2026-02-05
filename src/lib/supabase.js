/**
 * Supabase Client
 * Database operations for storing campaign performance data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Database operations for the optimizer
 */
export const db = {
  /**
   * Store hourly performance data
   */
  async saveHourlyData(records) {
    const { data, error } = await supabase
      .from('hourly_performance')
      .upsert(records, { 
        onConflict: 'campaign_id,date,hour',
        ignoreDuplicates: false 
      });

    if (error) throw error;
    return data;
  },

  /**
   * Get hourly performance for a campaign
   */
  async getHourlyPerformance(campaignId, daysBack = 14) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from('hourly_performance')
      .select('*')
      .eq('campaign_id', campaignId)
      .gte('date', fromDate.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .order('hour', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get aggregated hourly stats for a campaign
   */
  async getHourlyAggregates(campaignId, daysBack = 14) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const { data, error } = await supabase
      .rpc('get_hourly_aggregates', {
        p_campaign_id: campaignId,
        p_from_date: fromDate.toISOString().split('T')[0],
      });

    if (error) {
      // Fallback to manual aggregation if RPC doesn't exist
      console.warn('RPC not found, using manual aggregation');
      return this.manualHourlyAggregates(campaignId, daysBack);
    }
    return data;
  },

  /**
   * Manual hourly aggregation fallback
   */
  async manualHourlyAggregates(campaignId, daysBack = 14) {
    const hourlyData = await this.getHourlyPerformance(campaignId, daysBack);
    
    const aggregates = {};
    for (let h = 0; h < 24; h++) {
      aggregates[h] = {
        hour: h,
        total_spend: 0,
        total_purchases: 0,
        total_revenue: 0,
        total_clicks: 0,
        total_impressions: 0,
        data_points: 0,
      };
    }

    for (const record of hourlyData) {
      const h = record.hour;
      aggregates[h].total_spend += record.spend || 0;
      aggregates[h].total_purchases += record.purchases || 0;
      aggregates[h].total_revenue += record.revenue || 0;
      aggregates[h].total_clicks += record.clicks || 0;
      aggregates[h].total_impressions += record.impressions || 0;
      aggregates[h].data_points += 1;
    }

    return Object.values(aggregates).map(a => ({
      ...a,
      avg_roas: a.total_spend > 0 ? a.total_revenue / a.total_spend : 0,
      avg_cpa: a.total_purchases > 0 ? a.total_spend / a.total_purchases : 0,
      avg_cvr: a.total_clicks > 0 ? (a.total_purchases / a.total_clicks) * 100 : 0,
    }));
  },

  /**
   * Save campaign metadata
   */
  async saveCampaign(campaign) {
    const { data, error } = await supabase
      .from('campaigns')
      .upsert({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        daily_budget: campaign.daily_budget,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) throw error;
    return data;
  },

  /**
   * Get all campaigns
   */
  async getCampaigns() {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Save optimization recommendation
   */
  async saveRecommendation(rec) {
    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        campaign_id: rec.campaignId,
        type: rec.type,
        hour: rec.hour,
        current_value: rec.currentValue,
        recommended_value: rec.recommendedValue,
        reason: rec.reason,
        confidence: rec.confidence,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return data;
  },

  /**
   * Get pending recommendations
   */
  async getPendingRecommendations() {
    const { data, error } = await supabase
      .from('recommendations')
      .select('*, campaigns(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(id, status, appliedAt = null) {
    const update = { status };
    if (appliedAt) update.applied_at = appliedAt;

    const { data, error } = await supabase
      .from('recommendations')
      .update(update)
      .eq('id', id);

    if (error) throw error;
    return data;
  },

  /**
   * Log optimization action
   */
  async logAction(action) {
    const { data, error } = await supabase
      .from('action_log')
      .insert({
        campaign_id: action.campaignId,
        action_type: action.type,
        details: action.details,
        before_value: action.beforeValue,
        after_value: action.afterValue,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return data;
  },

  /**
   * Get optimization settings
   */
  async getSettings() {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || {
      auto_optimize: false,
      max_budget_increase: 30,
      max_budget_decrease: 30,
      min_data_hours: 24,
      roas_threshold: 1.0,
    };
  },

  /**
   * Update settings
   */
  async updateSettings(settings) {
    const { data, error } = await supabase
      .from('settings')
      .upsert({ id: 1, ...settings, updated_at: new Date().toISOString() });

    if (error) throw error;
    return data;
  },
};

export default db;
