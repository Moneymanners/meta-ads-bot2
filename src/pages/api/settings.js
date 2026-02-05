/**
 * API Route: /api/settings
 * Get and update optimizer settings
 */

import { db } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const settings = await db.getSettings();
      res.status(200).json({ settings });
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { autoOptimize, maxBudgetIncrease, maxBudgetDecrease } = req.body;
      
      await db.updateSettings({
        auto_optimize: autoOptimize,
        max_budget_increase: maxBudgetIncrease,
        max_budget_decrease: maxBudgetDecrease,
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
