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
    
    // Fetch hourly data from database with date filter
    const { data: hourlyData, error } = await supabase
      .from('hourly_performance')
      .select('*')
      .eq('campaign_id', campaignId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('hour', { ascending: true });

    if (error) throw error;

    // Aggregate hourly data across all dates
    const hourlyAggregated = aggregateHourlyData(hourlyData || []);
    
    // Calculate overall metrics
    const overallMetrics = calculateOverallMetrics(hourlyData || []);
    
    // Generate hourly analysis with scores
    const hourlyAnalysis = hourlyAggregated.map(hour => {
      const scores = calculateScores(hour);
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
    res.status(500).json({ error: 'Failed to analyze data' });
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
    const hour = row.hour;
    if (hourlyMap[hour]) {
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

function calculateScores(hourData) {
  // ROAS score (0-100)
  let roasScore = Math.min(100, hourData.roas * 50);
  
  // CPA score (inverse - lower is better)
  let cpaScore = hourData.cpa > 0 ? Math.max(0, 100 - (hourData.cpa / 2)) : 50;
  
  // Volume score (based on purchases)
  let volumeScore = Math.min(100, hourData.purchases * 10);
  
  // Composite score
  const composite = Math.round((roasScore * 0.4) + (cpaScore * 0.3) + (volumeScore * 0.3));
  
  return {
    roas: Math.round(roasScore),
    cpa: Math.round(cpaScore),
    volume: Math.round(volumeScore),
    composite,
  };
}

function getRecommendation(score) {
  if (score >= 70) return 'increase';
  if (score >= 50) return 'maintain';
  if (score >= 30) return 'monitor';
  return 'decrease';
}

function generateSummary(hourlyAnalysis) {
  const sortedByScore = [...hourlyAnalysis].sort((a, b) => b.scores.composite - a.scores.composite);
  
  const peakHours = sortedByScore
    .filter(h => h.scores.composite >= 70)
    .map(h => `${h.hour}:00`)
    .slice(0, 5);
  
  const underperformingHours = sortedByScore
    .filter(h => h.scores.composite < 40)
    .map(h => `${h.hour}:00`)
    .slice(-5);
  
  // Format hour ranges
  const peakPerformanceHours = formatHourRanges(peakHours);
  const underperformingHoursFormatted = formatHourRanges(underperformingHours);
  
  // Generate top recommendation
  let topRecommendation = '';
  if (underperformingHours.length > 0 && peakHours.length > 0) {
    topRecommendation = `Consider ad scheduling to reduce spend during ${underperformingHoursFormatted} and increase during ${peakPerformanceHours}.`;
  } else if (peakHours.length > 0) {
    topRecommendation = `${peakHours.length} hours show strong performance (avg score: ${Math.round(sortedByScore[0]?.scores.composite || 0)}).`;
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
  if (!hours.length) return '';
  
  // Extract hour numbers
  const hourNums = hours.map(h => parseInt(h.split(':')[0])).sort((a, b) => a - b);
  
  if (hourNums.length === 0) return '';
  if (hourNums.length === 1) return `${hourNums[0]}:00`;
  
  // Group consecutive hours
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
  
  // Check for significant hourly variation
  const scores = hourlyAnalysis.map(h => h.scores.composite);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  
  if (maxScore - minScore > 30) {
    recommendations.push({
      type: 'dayparting',
      priority: 'high',
      reason: `Performance varies significantly by hour. Peak hours (${formatHourRanges(hourlyAnalysis.filter(h => h.scores.composite >= 70).map(h => `${h.hour}:00`))}) show ${Math.round((maxScore - minScore))}% better performance than weak hours (${formatHourRanges(hourlyAnalysis.filter(h => h.scores.composite < 40).map(h => `${h.hour}:00`))}).`,
    });
  }
  
  // ROAS recommendation
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
  
  // Budget allocation recommendation
  const increaseable = hourlyAnalysis.filter(h => h.recommendation === 'increase').length;
  const decreaseable = hourlyAnalysis.filter(h => h.recommendation === 'decrease').length;
  
  if (increaseable > 0 && decreaseable > 0) {
    recommendations.push({
      type: 'budget_reallocation',
      priority: 'medium',
      reason: `Reallocate budget from ${decreaseable} underperforming hours to ${increaseable} high-performing hours.`,
    });
  }
  
  return recommendations;
}
