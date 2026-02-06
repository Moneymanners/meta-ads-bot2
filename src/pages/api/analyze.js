import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
      return res.status(200).json({ 
        error: 'Missing env vars',
        hasUrl: !!url,
        hasKey: !!key
      });
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from('hourly_performance')
      .select('*')
      .limit(5);

    if (error) {
      return res.status(200).json({ dbError: error.message });
    }

    return res.status(200).json({ 
      success: true,
      recordCount: data ? data.length : 0,
      sample: data ? data[0] : null
    });

  } catch (err) {
    return res.status(200).json({ 
      catchError: err.message
    });
  }
}
