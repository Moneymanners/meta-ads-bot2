/**
 * API Route: /api/recommendations
 * Get pending recommendations
 */

import { db } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const recommendations = await db.getPendingRecommendations();
    res.status(200).json({ recommendations });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: error.message });
  }
}
