import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  try {
    const { campaignId, dateRange } = req.query;

    // Fetch ALL hourly data (simple query)
    const { data, error } = await supabase
      .from('hourly_performance')
      .select('*')
      .order('hour', { ascending: true });

    if (error) {
      console.error('Database error:', error);
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

    // Calculate totals
    let totalSpend = 0;
    let totalPurchases = 0;
    let totalRevenue = 0;

    data.forEach(row => {
      totalSpend += parseFloat(row.spend) || 0;
      totalPurchases += parseInt(row.purchases) || 0;
      totalRevenue += parseFloat(row.revenue) || 0;
    });

    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const overallCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

    // Aggregate by hour
    const hourlyMap = {};
    for (let i = 0; i < 24; i++) {
      hourlyMap[i] = { hour: i, spend: 0, purchases: 0, revenue: 0 };
    }

    data.forEach(row => {
      const h = parseInt(row.hour);
      if (hourlyMap[h]) {
        hourlyMap[h].spend += parseFloat(row.spend) || 0;
        hourlyMap[h].purchases += parseInt(row.purchases) || 0;
        hourlyMap[h].revenue += parseFloat(row.revenue) || 0;
      }
    });

    const hourlyAnalysis = Object.values(hourlyMap).map(h => {
      const roas = h.spend > 0 ? h.revenue / h.spend : 0;
      const cpa = h.purchases > 0 ? h.spend / h.purchases : 0;
      const score = Math.min(100, Math.round(roas * 50));
      
      let recommendation = 'monitor';
      if (score >= 70) recommendation = 'increase';
      else if (score >= 50) recommendation = 'maintain';
      else if (score < 30) recommendation = 'decrease';

      return {
        hour: h.hour,
        metrics: { spend: h.spend, purchases: h.purchases, revenue: h.revenue, roas, cpa },
        scores: { composite: score },
        recommendation
      };
    });

    // Find best/worst hours
    const validHours = hourlyAnalysis.filter(h => h.metrics.spend > 0);
    const sorted = [...validHours].sort((a, b) => b.scores.composite - a.scores.composite);
    
    const bestHours = sorted.slice(0, 5).map(h => h.hour + ':00').join(', ') || 'Analyzing...';
    const worstHours = sorted.slice(-3).map(h => h.hour + ':00').join(', ') || 'None';

    return res.status(200).json({
      overallMetrics: { totalSpend, totalPurchases, totalRevenue, overallRoas, overallCpa },
      hourlyAnalysis,
      summary: {
        peakPerformanceHours: bestHours,
        underperformingHours: worstHours,
        topRecommendation: validHours.length > 0 ? `${sorted.filter(h => h.scores.composite >= 70).length} hours show strong performance.` : 'Sync more data.'
      },
      recommendations: [
        { type: 'dayparting', priority: 'high', reason: 'Optimize budget based on hourly performance.' }
      ]
    });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}


