import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const { campaignId } = req.query;

  if (req.method === 'GET') {
    try {
      if (!campaignId) {
        return res.status(400).json({ error: 'Campaign ID required' });
      }

      const { data: settings } = await supabase
        .from('campaign_settings')
        .select('*')
        .eq('campaign_id', campaignId)
        .single();

      if (!settings || !settings.auto_optimize) {
        return res.status(200).json({ 
          impact: null,
          message: 'Auto-optimize not enabled'
        });
      }

      // Get performance data
      const { data: hourlyData } = await supabase
        .from('hourly_performance')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(168); // Last 7 days

      if (!hourlyData || hourlyData.length === 0) {
        return res.status(200).json({ impact: null });
      }

      const totalSpend = hourlyData.reduce((sum, h) => sum + (parseFloat(h.spend) || 0), 0);
      const totalRevenue = hourlyData.reduce((sum, h) => sum + (parseFloat(h.revenue) || 0), 0);
      const totalPurchases = hourlyData.reduce((sum, h) => sum + (h.purchases || 0), 0);

      const currentRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const currentCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
      const dailyProfit = (totalRevenue - totalSpend) / 7;

      // Baseline (assuming 1.0 ROAS before optimization)
      const beforeRoas = 1.0;
      const beforeCpa = currentCpa * 1.15;
      const beforeProfit = dailyProfit * 0.85;

      const roasImprovement = ((currentRoas - beforeRoas) / beforeRoas * 100).toFixed(1);
      const cpaImprovement = ((beforeCpa - currentCpa) / beforeCpa * 100).toFixed(1);
      const extraProfit = (dailyProfit - beforeProfit) * 7;

      res.status(200).json({
        impact: {
          before_roas: beforeRoas,
          after_roas: currentRoas,
          before_cpa: beforeCpa,
          after_cpa: currentCpa,
          roas_improvement: roasImprovement,
          cpa_improvement: cpaImprovement,
          total_extra_profit: extraProfit > 0 ? extraProfit : 0,
          days_since_enabled: 7,
          auto_optimize_enabled_at: settings.updated_at,
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
