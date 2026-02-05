/**
 * AI Optimizer Engine
 * Analyzes campaign performance and generates recommendations
 */

import { db } from './supabase';

export class Optimizer {
  constructor(settings = {}) {
    this.settings = {
      maxBudgetIncrease: settings.max_budget_increase || 30,
      maxBudgetDecrease: settings.max_budget_decrease || 30,
      minDataPoints: settings.min_data_hours || 24,
      roasThreshold: settings.roas_threshold || 1.0,
      cpaThresholdMultiplier: 1.2, // 20% above average = bad
      highPerformanceThreshold: 70, // Score above this = increase budget
      lowPerformanceThreshold: 30, // Score below this = decrease budget
    };
  }

  /**
   * Analyze hourly performance and generate scores
   */
  analyzeHourlyPerformance(hourlyAggregates) {
    if (!hourlyAggregates || hourlyAggregates.length === 0) {
      return [];
    }

    // Calculate averages for normalization
    const totals = hourlyAggregates.reduce((acc, h) => ({
      spend: acc.spend + h.total_spend,
      purchases: acc.purchases + h.total_purchases,
      revenue: acc.revenue + h.total_revenue,
    }), { spend: 0, purchases: 0, revenue: 0 });

    const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    const avgCpa = totals.purchases > 0 ? totals.spend / totals.purchases : Infinity;

    // Find min/max for normalization
    const roasValues = hourlyAggregates.map(h => h.avg_roas).filter(v => v > 0);
    const cpaValues = hourlyAggregates.map(h => h.avg_cpa).filter(v => v > 0 && v < Infinity);
    const cvrValues = hourlyAggregates.map(h => h.avg_cvr).filter(v => v > 0);

    const minRoas = Math.min(...roasValues) || 0;
    const maxRoas = Math.max(...roasValues) || 1;
    const minCpa = Math.min(...cpaValues) || 0;
    const maxCpa = Math.max(...cpaValues) || 1;
    const minCvr = Math.min(...cvrValues) || 0;
    const maxCvr = Math.max(...cvrValues) || 1;

    // Score each hour
    return hourlyAggregates.map(h => {
      // Normalize scores (0-100)
      const roasScore = maxRoas > minRoas 
        ? ((h.avg_roas - minRoas) / (maxRoas - minRoas)) * 100 
        : 50;
      
      const cpaScore = maxCpa > minCpa 
        ? ((maxCpa - h.avg_cpa) / (maxCpa - minCpa)) * 100 
        : 50;
      
      const cvrScore = maxCvr > minCvr 
        ? ((h.avg_cvr - minCvr) / (maxCvr - minCvr)) * 100 
        : 50;

      // Volume score (reward hours with more data/spend)
      const maxSpend = Math.max(...hourlyAggregates.map(h => h.total_spend));
      const volumeScore = maxSpend > 0 ? (h.total_spend / maxSpend) * 100 : 50;

      // Weighted composite score
      const compositeScore = 
        roasScore * 0.35 +    // ROAS most important
        cpaScore * 0.30 +     // CPA very important
        cvrScore * 0.20 +     // CVR matters
        volumeScore * 0.15;   // Volume provides confidence

      // Determine recommendation
      let recommendation;
      if (compositeScore >= this.settings.highPerformanceThreshold) {
        recommendation = 'increase';
      } else if (compositeScore <= this.settings.lowPerformanceThreshold) {
        recommendation = 'decrease';
      } else if (compositeScore >= 50) {
        recommendation = 'maintain';
      } else {
        recommendation = 'monitor';
      }

      return {
        hour: h.hour,
        metrics: {
          spend: h.total_spend,
          purchases: h.total_purchases,
          revenue: h.total_revenue,
          roas: h.avg_roas,
          cpa: h.avg_cpa,
          cvr: h.avg_cvr,
        },
        scores: {
          roas: Math.round(roasScore),
          cpa: Math.round(cpaScore),
          cvr: Math.round(cvrScore),
          volume: Math.round(volumeScore),
          composite: Math.round(compositeScore),
        },
        recommendation,
        confidence: this.calculateConfidence(h.data_points),
      };
    });
  }

  /**
   * Calculate confidence based on data points
   */
  calculateConfidence(dataPoints) {
    if (dataPoints >= 14) return 'high';
    if (dataPoints >= 7) return 'medium';
    return 'low';
  }

  /**
   * Generate budget recommendations
   */
  generateRecommendations(campaignId, hourlyAnalysis, currentBudget) {
    const recommendations = [];
    const now = new Date();
    const currentHour = now.getHours();

    // Group hours by recommendation
    const increaseHours = hourlyAnalysis.filter(h => h.recommendation === 'increase');
    const decreaseHours = hourlyAnalysis.filter(h => h.recommendation === 'decrease');

    // Calculate optimal budget adjustment
    const avgIncreaseScore = increaseHours.length > 0
      ? increaseHours.reduce((sum, h) => sum + h.scores.composite, 0) / increaseHours.length
      : 0;

    const avgDecreaseScore = decreaseHours.length > 0
      ? decreaseHours.reduce((sum, h) => sum + h.scores.composite, 0) / decreaseHours.length
      : 100;

    // Generate dayparting recommendation
    if (increaseHours.length >= 3 && decreaseHours.length >= 3) {
      const peakHours = increaseHours.map(h => h.hour).sort((a, b) => a - b);
      const weakHours = decreaseHours.map(h => h.hour).sort((a, b) => a - b);

      recommendations.push({
        campaignId,
        type: 'dayparting',
        priority: 'high',
        peakHours,
        weakHours,
        reason: `Performance varies significantly by hour. Peak hours (${this.formatHours(peakHours)}) show ${Math.round(avgIncreaseScore)}% better performance than weak hours (${this.formatHours(weakHours)}).`,
        suggestedAction: `Consider ad scheduling to reduce spend during ${this.formatHours(weakHours)} and increase during ${this.formatHours(peakHours)}.`,
        estimatedImpact: {
          roasImprovement: `+${Math.round((avgIncreaseScore - avgDecreaseScore) / 2)}%`,
          cpaReduction: `-${Math.round((avgIncreaseScore - avgDecreaseScore) / 3)}%`,
        },
      });
    }

    // Budget increase recommendation
    if (increaseHours.length >= 5 && avgIncreaseScore > 70) {
      const increasePct = Math.min(
        this.settings.maxBudgetIncrease,
        Math.round((avgIncreaseScore - 50) / 2)
      );

      recommendations.push({
        campaignId,
        type: 'budget_increase',
        priority: avgIncreaseScore > 80 ? 'high' : 'medium',
        currentBudget,
        recommendedBudget: currentBudget * (1 + increasePct / 100),
        percentChange: increasePct,
        reason: `${increaseHours.length} hours show strong performance (avg score: ${Math.round(avgIncreaseScore)}).`,
        confidence: increaseHours[0]?.confidence || 'medium',
      });
    }

    // Budget decrease warning
    if (decreaseHours.length >= 5 && avgDecreaseScore < 30) {
      const decreasePct = Math.min(
        this.settings.maxBudgetDecrease,
        Math.round((50 - avgDecreaseScore) / 2)
      );

      recommendations.push({
        campaignId,
        type: 'budget_decrease',
        priority: avgDecreaseScore < 20 ? 'high' : 'medium',
        currentBudget,
        recommendedBudget: currentBudget * (1 - decreasePct / 100),
        percentChange: -decreasePct,
        reason: `${decreaseHours.length} hours underperforming (avg score: ${Math.round(avgDecreaseScore)}). Spending without adequate returns.`,
        confidence: decreaseHours[0]?.confidence || 'medium',
      });
    }

    // Immediate action if current hour is underperforming
    const currentHourAnalysis = hourlyAnalysis.find(h => h.hour === currentHour);
    if (currentHourAnalysis && currentHourAnalysis.recommendation === 'decrease' && currentHourAnalysis.scores.composite < 25) {
      recommendations.push({
        campaignId,
        type: 'immediate_action',
        priority: 'urgent',
        hour: currentHour,
        reason: `Current hour (${currentHour}:00) is historically your worst performing time (score: ${currentHourAnalysis.scores.composite}).`,
        suggestedAction: 'Consider pausing or reducing budget immediately.',
        metrics: currentHourAnalysis.metrics,
      });
    }

    return recommendations;
  }

  /**
   * Format hours for display
   */
  formatHours(hours) {
    if (hours.length === 0) return 'none';
    
    // Group consecutive hours
    const ranges = [];
    let start = hours[0];
    let end = hours[0];

    for (let i = 1; i <= hours.length; i++) {
      if (i < hours.length && hours[i] === end + 1) {
        end = hours[i];
      } else {
        if (start === end) {
          ranges.push(`${start}:00`);
        } else {
          ranges.push(`${start}:00-${end}:59`);
        }
        if (i < hours.length) {
          start = hours[i];
          end = hours[i];
        }
      }
    }

    return ranges.join(', ');
  }

  /**
   * Run full optimization analysis for a campaign
   */
  async analyzeCapmaign(campaignId, daysBack = 14) {
    // Get historical data
    const hourlyAggregates = await db.getHourlyAggregates(campaignId, daysBack);
    
    if (!hourlyAggregates || hourlyAggregates.length < this.settings.minDataPoints / 24) {
      return {
        campaignId,
        status: 'insufficient_data',
        message: `Need at least ${this.settings.minDataPoints} hours of data. Currently have ${hourlyAggregates?.length || 0} days.`,
        hourlyAnalysis: [],
        recommendations: [],
      };
    }

    // Analyze performance
    const hourlyAnalysis = this.analyzeHourlyPerformance(hourlyAggregates);

    // Get current budget (would come from Meta API in production)
    const campaign = await db.getCampaigns().then(c => c.find(camp => camp.id === campaignId));
    const currentBudget = campaign?.daily_budget || 100;

    // Generate recommendations
    const recommendations = this.generateRecommendations(campaignId, hourlyAnalysis, currentBudget);

    // Calculate overall metrics
    const totals = hourlyAggregates.reduce((acc, h) => ({
      spend: acc.spend + h.total_spend,
      purchases: acc.purchases + h.total_purchases,
      revenue: acc.revenue + h.total_revenue,
    }), { spend: 0, purchases: 0, revenue: 0 });

    return {
      campaignId,
      status: 'analyzed',
      period: `Last ${daysBack} days`,
      overallMetrics: {
        totalSpend: totals.spend,
        totalPurchases: totals.purchases,
        totalRevenue: totals.revenue,
        overallRoas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
        overallCpa: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
      },
      hourlyAnalysis: hourlyAnalysis.sort((a, b) => b.scores.composite - a.scores.composite),
      recommendations,
      summary: this.generateSummary(hourlyAnalysis, recommendations),
    };
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(hourlyAnalysis, recommendations) {
    const peakHours = hourlyAnalysis
      .filter(h => h.recommendation === 'increase')
      .map(h => h.hour);
    
    const weakHours = hourlyAnalysis
      .filter(h => h.recommendation === 'decrease')
      .map(h => h.hour);

    const highPriorityRecs = recommendations.filter(r => r.priority === 'high' || r.priority === 'urgent');

    return {
      peakPerformanceHours: this.formatHours(peakHours.sort((a, b) => a - b)),
      underperformingHours: this.formatHours(weakHours.sort((a, b) => a - b)),
      actionItemsCount: highPriorityRecs.length,
      topRecommendation: recommendations[0]?.suggestedAction || recommendations[0]?.reason || 'No immediate actions needed',
    };
  }
}

export default Optimizer;
