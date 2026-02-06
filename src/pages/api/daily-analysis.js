import { supabase } from '../../lib/supabase';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function handler(req, res) {
  const { campaignId } = req.query;

  if (req.method === 'GET') {
    try {
      if (!campaignId) {
        return res.status(400).json({ error: 'Campaign ID required' });
      }

      // For now, generate from hourly data grouped by day
      const { data: hourlyData, error } = await supabase
        .from('hourly_performance')
        .select('*')
        .eq('campaign_id', campaignId);

      if (error) throw error;

      // Aggregate by day of week
      const dayStats = {};
      DAY_NAMES.forEach((name, i) => {
        dayStats[i] = { day_name: name, spend: 0, revenue: 0, purchases: 0, count: 0 };
      });

      (hourlyData || []).forEach(row => {
        const date = new Date(row.created_at);
        const dow = date.getDay();
        dayStats[dow].spend += parseFloat(row.spend) || 0;
        dayStats[dow].revenue += parseFloat(row.revenue) || 0;
        dayStats[dow].purchases += row.purchases || 0;
        dayStats[dow].count += 1;
      });

      const results = Object.values(dayStats).map(day => {
        const roas = day.spend > 0 ? (day.revenue / day.spend) : 0;
        const cpa = day.purchases > 0 ? (day.spend / day.purchases) : 0;
        let score = roas >= 1.5 ? 85 : roas >= 1.2 ? 70 : roas >= 1 ? 55 : roas >= 0.8 ? 40 : 25;
        
        return {
          day_name: day.day_name,
          avg_spend: (day.spend / Math.max(day.count, 1)).toFixed(2),
          roas: roas.toFixed(2),
          cpa: cpa.toFixed(2),
          score,
          recommendation: score >= 70 ? 'INCREASE' : score <= 40 ? 'DECREASE' : 'MAINTAIN',
        };
      });

      const bestDays = results.filter(d => d.score >= 70).map(d => d.day_name);
      const worstDays = results.filter(d => d.score <= 40).map(d => d.day_name);

      res.status(200).json({
        daily_breakdown: results,
        best_days: bestDays,
        worst_days: worstDays,
        recommendation: worstDays.length > 0 
          ? `Consider reducing budget on ${worstDays.join(', ')}`
          : 'Performance is consistent across all days',
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
