/**
 * API Route: /api/analyze
 * Analyze campaign performance and generate recommendations
 */

import { db } from '../../lib/supabase';
import { Optimizer } from '../../lib/optimizer';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { campaignId } = req.query;

  if (!campaignId) {
    return res.status(400).json({ error: 'Campaign ID is required' });
  }

  try {
    // Get settings
    const settings = await db.getSettings();
    
    // Create optimizer
    const optimizer = new Optimizer(settings);
    
    // Run analysis
    const analysis = await optimizer.analyzeCapmaign(campaignId, 14);

    // Save recommendations to database
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      for (const rec of analysis.recommendations) {
        await db.saveRecommendation({
          campaignId: rec.campaignId,
          type: rec.type,
          hour: rec.hour || null,
          currentValue: rec.currentBudget || null,
          recommendedValue: rec.recommendedBudget || null,
          reason: rec.reason,
          confidence: rec.confidence || 'medium',
        });
      }
    }

    res.status(200).json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
}
