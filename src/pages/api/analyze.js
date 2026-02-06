import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { campaignId, dateRange = 'last_14_days', startDate, endDate } = req.query;

  if (!campaignId) {
    return res.status(400).json({ error: 'Campaign ID required' });
  }

  try {
    // Calculate date range
    const { fromDate, toDate } = getDateRange(dateRange, startDate, endDate);
    
    console.log('Fetching data for:', { campaignId, dateRange, fromDate, toDate });
    
    // Try to fetch campaign-specific data first
    let { data: hourlyData, error } = await supabase
      .from('hourly_performance')
      .select('*')
      .eq('campaign_id', String(campaignId))
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('hour', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // If no campaign-specific data found, try fetching all data (backwards compatibility)
    if (!hourlyData || hourlyData.length === 0) {
      console.log('No campaign-specific data found, trying without campaign filter...');
      
      const { data: allData, error: allError } = await supabase
        .from('hourly_performance')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('hour', { ascending: true });
      
      if (!allError && allData && allData.length > 0) {
        hourlyData = allData;
        console.log(`Found ${hourlyData.length} records without campaign filter`);
      }
    } else {
      console.log(`Found ${hourlyData.length} records for campaign ${campaignId}`);
    }

    // If still no data, return empty response
    if (!hourlyData || hourlyData.length === 0) {
      return res.status(200).json({
        campaignId,
        dateRange,
        fromDate,
        toDate,
        overallMetrics: {
          totalSpend: 0,
          totalPurchases: 0,
          totalRevenue: 0,
          overallRoas: 0,
          overallCpa: 0,
        },
        hourlyAnalysis: [],
        summary: {
          peakPerformanceHours: 'No data available',
          underperformingHours: 'No data available',
          topRecommendation: 'Click "Sync Data" to fetch data from Meta.',
        },
        recommendations: [],
      });
    }

    // Aggregate hourly data across all dates
    const hourlyAggregated = aggregateHourlyData(hourlyData);
    
    // Calculate overall metrics
    const overallMetrics = calculateOverallMetrics(hourlyData);
    
    // Generate hourly analysis with scores
    const hourlyAnalysis = hourlyAggregated.map(hour => {
      const scores = calculateScores(hour, overallMetrics);
      return {
        hour: hour.hour,
        metrics: {
          spend: hour.spend,
          purchases: hour.purchases,
          revenue: hour.revenue,
          roas: hour.roas,
          cpa: hour.cpa,
        },
        scores,
        recommendation: getRecommendation(scores.composite),
      };
    });

    // Generate summary
    const summary = generateSummary(hourlyAnalysis);
    
    // Generate recommendations
    const recommendations = generateRecommendations(hourlyAnalysis, overallMetrics);

    res.status(200).json({
      campaignId,
      dateRange,
      fromDate,
      toDate,
      overallMetrics,
      hourlyAnalysis,
      summary,
      recommendations,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze data', details: error.message });
  }
}

function getDateRange(dateRange, customStart, customEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let fromDate, toDate;
  
  switch (dateRange) {
    case 'today':
      fromDate = formatDate(today);
      toDate = formatDate(today);
      break;
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      fromDate = formatDate(yesterday);
      toDate = formatDate(yesterday);
      break;
    case 'last_7_days':
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      fromDate = formatDate(sevenDaysAgo);
      toDate = formatDate(today);
      break;
    case 'last_14_days':
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      fromDate = formatDate(fourteenDaysAgo);
      toDate = formatDate(today);
      break;
    case 'last_30_days':
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      fromDate = formatDate(thirtyDaysAgo);
      toDate = formatDate(today);
      break;
    case 'this_month':
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDate = formatDate(firstOfMonth);
      toDate = formatDate(today);
      break;
    case 'last_month':
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      fromDate = formatDate(firstOfLastMonth);
      toDate = formatDate(lastOfLastMonth);
      break;
    case 'custom':
      fromDate = customStart || formatDate(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000));
      toDate = customEnd || formatDate(today);
      break;
    default:
      const defaultDaysAgo = new Date(today);
      defaultDaysAgo.setDate(defaultDaysAgo.getDate() - 14);
      fromDate = formatDate(defaultDaysAgo);
      toDate = formatDate(today);
  }
  
  return { fromDate, toDate };
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function aggregateHourlyData(data) {
  const hourlyMap = {};
  
  for (let i = 0; i < 24; i++) {
    hourlyMap[i] = {
      hour: i,
      spend: 0,
      purchases: 0,
      revenue: 0,
      impressions: 0,
      clicks: 0,
      count: 0,
    };
  }
  
  data.forEach(row => {
    const hour = parseInt(row.hour);
    if (hourlyMap[hour] !== undefined) {
      hourlyMap[hour].spend += parseFloat(row.spend) || 0;
      hourlyMap[hour].purchases += parseInt(row.purchases) || 0;
      hourlyMap[hour].revenue += parseFloat(row.revenue) || 0;
      hourlyMap[hour].impressions += parseInt(row.impressions) || 0;
      hourlyMap[hour].clicks += parseInt(row.clicks) || 0;
      hourlyMap[hour].count += 1;
    }
  });
  
  return Object.values(hourlyMap).map(hour => ({
    ...hour,
    roas: hour.spend > 0 ? hour.revenue / hour.spend : 0,
    cpa: hour.purchases > 0 ? hour.spend / hour.purchases : 0,
  }));
}

function calculateOverallMetrics(data) {
  const totalSpend = data.reduce((sum, row) => sum + (parseFloat(row.spend) || 0), 0);
  const totalPurchases = data.reduce((sum, row) => sum + (parseInt(row.purchases) || 0), 0);
  const totalRevenue = data.reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0);
  
  return {
    totalSpend,
    totalPurchases,
    totalRevenue,
    overallRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    overallCpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
  };
}

function calculateScores(hourData, overallMetrics) {
  // ROAS score (0-100)
  let roasScore = Math.min(100, hourData.roas * 50);
  
  // CPA score (inverse - lower is better)
  const avgCpa = overallMetrics.overallCpa || 20;
  let cpaScore = hourData.cpa > 0 ? Math.max(0, 100 - ((hourData.cpa / avgCpa) * 50)) : 50;
  
  // Volume score (based on purchases relative to average)
  const avgPurchases = overallMetrics.totalPurchases / 24 || 1;
  let volumeScore = Math.min(100, (hourData.purchases / avgPurchases) * 50);
  
  // Composite score
  const composite = Math.round((roasScore * 0.4) + (cpaScore * 0.3) + (volumeScore * 0.3));
  
  return {
    roas: Math.round(roasScore),
    cpa: Math.round(cpaScore),
    volume: Math.round(volumeScore),
    composite: Math.max(0, Math.min(100, composite)),
  };
}

function getRecommendation(score) {
  if (score >= 70) return 'increase';
  if (score >= 50) return 'maintain';
  if (score >= 30) return 'monitor';
  return 'decrease';
}

function generateSummary(hourlyAnalysis) {
  const validHours = hourlyAnalysis.filter(h => h.metrics.spend > 0);
  
  if (validHours.length === 0) {
    return {
      peakPerformanceHours: 'No data available',
      underperformingHours: 'No data available',
      topRecommendation: 'Sync more data to analyze performance patterns.',
    };
  }
  
  const sortedByScore = [...validHours].sort((a, b) => b.scores.composite - a.scores.composite);
  
  const peakHours = sortedByScore
    .filter(h => h.scores.composite >= 70)
    .map(h => `${h.hour}:00`);
  
  const underperformingHours = sortedByScore
    .filter(h => h.scores.composite < 40)
    .map(h => `${h.hour}:00`);
  
  const peakPerformanceHours = formatHourRanges(peakHours);
  const underperformingHoursFormatted = formatHourRanges(underperformingHours);
  
  let topRecommendation = '';
  if (underperformingHours.length > 0 && peakHours.length > 0) {
    topRecommendation = `Consider ad scheduling to reduce spend during ${underperformingHoursFormatted} and increase during ${peakPerformanceHours}.`;
  } else if (peakHours.length > 0) {
    const avgScore = Math.round(sortedByScore.slice(0, peakHours.length).reduce((sum, h) => sum + h.scores.composite, 0) / peakHours.length);
    topRecommendation = `${peakHours.length} hours show strong performance (avg score: ${avgScore}).`;
  } else {
    topRecommendation = 'Performance is consistent across hours. Monitor for patterns.';
  }
  
  return {
    peakPerformanceHours: peakPerformanceHours || 'Analyzing...',
    underperformingHours: underperformingHoursFormatted || 'None',
    topRecommendation,
  };
}

function formatHourRanges(hours) {
  if (!hours || hours.length === 0) return '';
  
  const hourNums = hours.map(h => parseInt(h.split(':')[0])).sort((a, b) => a - b);
  
  if (hourNums.length === 0) return '';
  if (hourNums.length === 1) return `${hourNums[0]}:00`;
  
  const ranges = [];
  let start = hourNums[0];
  let end = hourNums[0];
  
  for (let i = 1; i < hourNums.length; i++) {
    if (hourNums[i] === end + 1) {
      end = hourNums[i];
    } else {
      ranges.push(start === end ? `${start}:00` : `${start}:00-${end}:59`);
      start = hourNums[i];
      end = hourNums[i];
    }
  }
  ranges.push(start === end ? `${start}:00` : `${start}:00-${end}:59`);
  
  return ranges.join(', ');
}

function generateRecommendations(hourlyAnalysis, overallMetrics) {
  const recommendations = [];
  const validHours = hourlyAnalysis.filter(h => h.metrics.spend > 0);
  
  if (validHours.length === 0) {
    return [{
      type: 'data_needed',
      priority: 'medium',
      reason: 'Not enough data to generate recommendations. Sync more data.',
    }];
  }
  
  const scores = validHours.map(h => h.scores.composite);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  
  if (maxScore - minScore > 30) {
    const peakHoursText = formatHourRanges(validHours.filter(h => h.scores.composite >= 70).map(h => `${h.hour}:00`));
    const weakHoursText = formatHourRanges(validHours.filter(h => h.scores.composite < 40).map(h => `${h.hour}:00`));
    
    recommendations.push({
      type: 'dayparting',
      priority: 'high',
      reason: `Performance varies significantly by hour. Peak hours (${peakHoursText || 'N/A'}) show ${Math.round(maxScore - minScore)}% better performance than weak hours (${weakHoursText || 'N/A'}).`,
    });
  }
  
  if (overallMetrics.overallRoas < 1) {
    recommendations.push({
      type: 'roas_optimization',
      priority: 'high',
      reason: `ROAS is ${overallMetrics.overallRoas.toFixed(2)}x (below breakeven). Consider pausing underperforming hours or adjusting targeting.`,
    });
  } else if (overallMetrics.overallRoas > 2) {
    recommendations.push({
      type: 'scaling',
      priority: 'medium',
      reason: `Strong ROAS of ${overallMetrics.overallRoas.toFixed(2)}x. Consider increasing budget during peak hours.`,
      percentChange: 20,
    });
  }
  
  const increaseable = validHours.filter(h => h.recommendation === 'increase').length;
  const decreaseable = validHours.filter(h => h.recommendation === 'decrease').length;
  
  if (increaseable > 0 && decreaseable > 0) {
    recommendations.push({
      type: 'budget_reallocation',
      priority: 'medium',
      reason: `Reallocate budget from ${decreaseable} underperforming hours to ${increaseable} high-performing hours.`,
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'monitoring',
      priority: 'low',
      reason: 'Campaign is performing steadily. Continue monitoring for optimization opportunities.',
    });
  }
  
  return recommendations;
}
