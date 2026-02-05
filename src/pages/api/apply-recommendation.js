/**
 * API Route: /api/apply-recommendation
 * Apply or reject a recommendation
 */

import { createMetaAPI } from '../../lib/meta-api';
import { db } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recommendationId, action } = req.body;

  if (!recommendationId || !action) {
    return res.status(400).json({ error: 'Recommendation ID and action required' });
  }

  if (!['apply', 'reject', 'skip'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Use: apply, reject, or skip' });
  }

  try {
    if (action === 'apply') {
      // Get the recommendation details
      const { data: rec, error } = await db.supabase
        .from('recommendations')
        .select('*')
        .eq('id', recommendationId)
        .single();

      if (error || !rec) {
        throw new Error('Recommendation not found');
      }

      // Apply the change via Meta API
      const metaApi = createMetaAPI();

      if (rec.type === 'budget_increase' || rec.type === 'budget_decrease') {
        await metaApi.updateCampaignBudget(rec.campaign_id, rec.recommended_value);

        // Log the action
        await db.logAction({
          campaignId: rec.campaign_id,
          type: rec.type,
          details: rec.reason,
          beforeValue: rec.current_value,
          afterValue: rec.recommended_value,
        });
      }

      // Mark as applied
      await db.updateRecommendationStatus(recommendationId, 'applied', new Date().toISOString());

      res.status(200).json({ success: true, message: 'Recommendation applied successfully' });
    } else {
      // Mark as rejected or skipped
      await db.updateRecommendationStatus(recommendationId, action === 'reject' ? 'rejected' : 'skipped');
      res.status(200).json({ success: true, message: `Recommendation ${action}ed` });
    }
  } catch (error) {
    console.error('Error applying recommendation:', error);
    res.status(500).json({ error: error.message });
  }
}
