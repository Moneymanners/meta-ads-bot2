import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('hourly_performance')
      .select('*');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        overallMetrics: { totalSpend: 0, totalPurchases: 0, totalRevenue: 0, overallRoas: 0, overallCpa: 0 },
        hourlyAnalysis: [],
        summary: { peakPerformanceHours: 'No data', underperformingHours: 'No data', topRecommendation: 'Click Sync Data' },
        recommendations: []
      });
    }

    let totalSpend = 0, totalPurchases = 0, totalRevenue = 0;
    const hourlyMap = {};
    
    for (let i = 0; i < 24; i++) {
      hourlyMap[i] = { hour: i, spend: 0, purchases: 0, revenue: 0 };
    }

    data.forEach(row => {
      totalSpend += parseFloat(row.spend) || 0;
      totalPurchases += parseInt(row.purchases) || 0;
      totalRevenue += parseFloat(row.revenue) || 0;
      const h = parseInt(row.hour);
      if (hourlyMap[h]) {
        hourlyMap[h].spend += parseFloat(row.spend) || 0;
        hourlyMap[h].purchases += parseInt(row.purchases) || 0;
        hourlyMap[h].revenue += parseFloat(row.revenue) || 0;
      }
    });

    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const overallCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

    const hourlyAnalysis = Object.values(hourlyMap).map(h => {
      const roas = h.spend > 0 ? h.revenue / h.spend : 0;
      const cpa = h.purchases > 0 ? h.spend / h.purchases : 0;
      const score = Math.min(100, Math.round(roas * 50));
      
      let recommendation = 'monitor';
      if (score >= 70) recommendation = 'increase';
      else if (score >= 50) recommendation = 'maintain';
      else if (score < 30 && h.spend > 0) recommendation = 'decrease';

      return {
        hour: h.hour,
        metrics: { spend: h.spend, purchases: h.purchases, revenue: h.revenue, roas, cpa },
        scores: { composite: score },
        recommendation
      };
    });

    const validHours = hourlyAnalysis.filter(h => h.metrics.spend > 0);
    const sorted = [...validHours].sort((a, b) => b.scores.composite - a.scores.composite);
    
    const peakHours = sorted.filter(h => h.scores.composite >= 70).map(h => h.hour + ':00');
    const weakHours = sorted.filter(h => h.scores.composite < 40).map(h => h.hour + ':00');

    const recommendations = [];
    if (overallRoas < 1) {
      recommendations.push({ type: 'roas_warning', priority: 'high', reason: `ROAS is ${overallRoas.toFixed(2)}x (below breakeven).` });
    }
    if (peakHours.length > 0) {
      recommendations.push({ type: 'budget_increase', priority: 'medium', reason: `${peakHours.length} hours show strong performance (avg score: ${Math.round(sorted[0]?.scores.composite || 0)}).` });
    }

    return res.status(200).json({
      overallMetrics: { totalSpend, totalPurchases, totalRevenue, overallRoas, overallCpa },
      hourlyAnalysis,
      summary: {
        peakPerformanceHours: peakHours.length > 0 ? peakHours.slice(0, 5).join(', ') : 'Analyzing...',
        underperformingHours: weakHours.length > 0 ? weakHours.slice(0, 3).join(', ') : 'None',
        topRecommendation: recommendations[0]?.reason || 'Performance is steady. Continue monitoring.'
      },
      recommendations
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
