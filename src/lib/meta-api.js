/**
 * Meta Marketing API Wrapper
 * Handles all communication with Facebook/Meta Ads API
 */

const META_API_VERSION = 'v18.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

class MetaAdsAPI {
  constructor(accessToken, adAccountId) {
    this.accessToken = accessToken;
    this.adAccountId = adAccountId;
  }

  async request(endpoint, method = 'GET', body = null) {
    const url = new URL(`${META_BASE_URL}${endpoint}`);
    url.searchParams.append('access_token', this.accessToken);

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta API Error: ${data.error.message}`);
    }

    return data;
  }

  /**
   * Get all active campaigns
   */
 async getCampaigns() {
    const endpoint = `/${this.adAccountId}/campaigns`;
    const params = new URLSearchParams({
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,budget_remaining',
      effective_status: '["ACTIVE"]',
    });

    const data = await this.request(`${endpoint}?${params}`);
    return data.data || [];
  }

  /**
   * Get all ad sets for a campaign
   */
  async getAdSets(campaignId = null) {
    const endpoint = campaignId 
      ? `/${campaignId}/adsets`
      : `/${this.adAccountId}/adsets`;
    
    const params = new URLSearchParams({
      fields: 'id,name,campaign_id,status,daily_budget,lifetime_budget,optimization_goal,targeting',
      filtering: JSON.stringify([{ field: 'status', operator: 'IN', value: ['ACTIVE'] }]),
    });

    const data = await this.request(`${endpoint}?${params}`);
    return data.data || [];
  }

  /**
   * Get hourly insights for campaigns
   */
  async getHourlyInsights(campaignIds, dateFrom, dateTo) {
    const insights = [];

    for (const campaignId of campaignIds) {
      const endpoint = `/${campaignId}/insights`;
      const params = new URLSearchParams({
        fields: [
          'campaign_id',
          'campaign_name',
          'spend',
          'impressions',
          'clicks',
          'actions',
          'action_values',
          'cpc',
          'cpm',
          'ctr',
          'cost_per_action_type',
        ].join(','),
        time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
        breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone',
        level: 'campaign',
      });

      try {
        const data = await this.request(`${endpoint}?${params}`);
        if (data.data) {
          insights.push(...data.data);
        }
      } catch (error) {
        console.error(`Error fetching insights for campaign ${campaignId}:`, error);
      }
    }

    return insights;
  }

  /**
   * Get daily insights (for trend analysis)
   */
  async getDailyInsights(campaignIds, dateFrom, dateTo) {
    const insights = [];

    for (const campaignId of campaignIds) {
      const endpoint = `/${campaignId}/insights`;
      const params = new URLSearchParams({
        fields: [
          'campaign_id',
          'campaign_name',
          'date_start',
          'date_stop',
          'spend',
          'impressions',
          'clicks',
          'actions',
          'action_values',
          'cpc',
          'cpm',
          'ctr',
          'cost_per_action_type',
        ].join(','),
        time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
        time_increment: 1, // Daily breakdown
        level: 'campaign',
      });

      try {
        const data = await this.request(`${endpoint}?${params}`);
        if (data.data) {
          insights.push(...data.data);
        }
      } catch (error) {
        console.error(`Error fetching insights for campaign ${campaignId}:`, error);
      }
    }

    return insights;
  }

  /**
   * Update campaign budget
   */
  async updateCampaignBudget(campaignId, dailyBudget) {
    const endpoint = `/${campaignId}`;
    const body = {
      daily_budget: Math.round(dailyBudget * 100), // Convert to cents
    };

    return this.request(endpoint, 'POST', body);
  }

  /**
   * Update ad set budget
   */
  async updateAdSetBudget(adSetId, dailyBudget) {
    const endpoint = `/${adSetId}`;
    const body = {
      daily_budget: Math.round(dailyBudget * 100), // Convert to cents
    };

    return this.request(endpoint, 'POST', body);
  }

  /**
   * Pause/activate ad set for specific hours (dayparting simulation)
   */
  async updateAdSetStatus(adSetId, status) {
    const endpoint = `/${adSetId}`;
    const body = { status }; // 'ACTIVE' or 'PAUSED'

    return this.request(endpoint, 'POST', body);
  }

  /**
   * Create automated rule (Meta native rules)
   */
  async createAutomatedRule(rule) {
    const endpoint = `/${this.adAccountId}/adrules_library`;
    
    const body = {
      name: rule.name,
      evaluation_spec: {
        evaluation_type: rule.evaluationType || 'TRIGGER',
        trigger: {
          type: 'METADATA_REFRESH', // Triggers on data refresh
        },
        filters: rule.filters || [],
      },
      execution_spec: {
        execution_type: rule.actionType,
        execution_options: rule.executionOptions || [],
      },
      schedule_spec: {
        schedule_type: 'CUSTOM',
        schedule: rule.schedule || [
          { start_hour: 0, end_hour: 24, days: [0, 1, 2, 3, 4, 5, 6] },
        ],
      },
    };

    return this.request(endpoint, 'POST', body);
  }

  /**
   * Parse actions from insights to get purchases, leads, etc.
   */
  static parseActions(actions) {
    if (!actions) return {};

    const parsed = {};
    for (const action of actions) {
      parsed[action.action_type] = parseFloat(action.value);
    }
    return parsed;
  }

  /**
   * Parse action values (revenue)
   */
  static parseActionValues(actionValues) {
    if (!actionValues) return {};

    const parsed = {};
    for (const av of actionValues) {
      parsed[av.action_type] = parseFloat(av.value);
    }
    return parsed;
  }
}

// Helper function to create API instance from environment
export function createMetaAPI() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error('Missing Meta API credentials in environment variables');
  }

  return new MetaAdsAPI(accessToken, adAccountId);
}

export default MetaAdsAPI;
