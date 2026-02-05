-- =====================================================
-- META ADS OPTIMIZER - SUPABASE SCHEMA
-- =====================================================
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CAMPAIGNS TABLE
-- Stores campaign metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,  -- Meta campaign ID
    name TEXT NOT NULL,
    status TEXT,
    objective TEXT,
    daily_budget DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- HOURLY PERFORMANCE TABLE
-- Stores hourly metrics for each campaign
-- =====================================================
CREATE TABLE IF NOT EXISTS hourly_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    campaign_name TEXT,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    spend DECIMAL(10, 2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    revenue DECIMAL(10, 2) DEFAULT 0,
    cpc DECIMAL(10, 4),
    cpm DECIMAL(10, 4),
    ctr DECIMAL(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for upsert
    UNIQUE(campaign_id, date, hour)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_hourly_campaign_date 
ON hourly_performance(campaign_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_hourly_date 
ON hourly_performance(date DESC);

-- =====================================================
-- RECOMMENDATIONS TABLE
-- Stores AI-generated optimization recommendations
-- =====================================================
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    type TEXT NOT NULL,  -- 'budget_increase', 'budget_decrease', 'dayparting', 'immediate_action'
    hour INTEGER,
    current_value DECIMAL(10, 2),
    recommended_value DECIMAL(10, 2),
    reason TEXT,
    confidence TEXT DEFAULT 'medium',  -- 'low', 'medium', 'high'
    status TEXT DEFAULT 'pending',  -- 'pending', 'applied', 'rejected', 'skipped'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_recommendations_status 
ON recommendations(status, created_at DESC);

-- =====================================================
-- ACTION LOG TABLE
-- Audit trail of all optimization actions taken
-- =====================================================
CREATE TABLE IF NOT EXISTS action_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    details TEXT,
    before_value DECIMAL(10, 2),
    after_value DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_log_date 
ON action_log(created_at DESC);

-- =====================================================
-- SETTINGS TABLE
-- Global optimizer settings
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    auto_optimize BOOLEAN DEFAULT FALSE,
    max_budget_increase INTEGER DEFAULT 30,
    max_budget_decrease INTEGER DEFAULT 30,
    min_data_hours INTEGER DEFAULT 24,
    roas_threshold DECIMAL(5, 2) DEFAULT 1.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default settings
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- HELPER FUNCTION: Get Hourly Aggregates
-- =====================================================
CREATE OR REPLACE FUNCTION get_hourly_aggregates(
    p_campaign_id TEXT,
    p_from_date DATE
)
RETURNS TABLE (
    hour INTEGER,
    total_spend DECIMAL,
    total_purchases INTEGER,
    total_revenue DECIMAL,
    total_clicks INTEGER,
    total_impressions INTEGER,
    data_points BIGINT,
    avg_roas DECIMAL,
    avg_cpa DECIMAL,
    avg_cvr DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hp.hour,
        COALESCE(SUM(hp.spend), 0)::DECIMAL as total_spend,
        COALESCE(SUM(hp.purchases), 0)::INTEGER as total_purchases,
        COALESCE(SUM(hp.revenue), 0)::DECIMAL as total_revenue,
        COALESCE(SUM(hp.clicks), 0)::INTEGER as total_clicks,
        COALESCE(SUM(hp.impressions), 0)::INTEGER as total_impressions,
        COUNT(*)::BIGINT as data_points,
        CASE 
            WHEN SUM(hp.spend) > 0 THEN (SUM(hp.revenue) / SUM(hp.spend))::DECIMAL 
            ELSE 0 
        END as avg_roas,
        CASE 
            WHEN SUM(hp.purchases) > 0 THEN (SUM(hp.spend) / SUM(hp.purchases))::DECIMAL 
            ELSE 0 
        END as avg_cpa,
        CASE 
            WHEN SUM(hp.clicks) > 0 THEN ((SUM(hp.purchases)::DECIMAL / SUM(hp.clicks)) * 100)::DECIMAL 
            ELSE 0 
        END as avg_cvr
    FROM hourly_performance hp
    WHERE hp.campaign_id = p_campaign_id
      AND hp.date >= p_from_date
    GROUP BY hp.hour
    ORDER BY hp.hour;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (Optional but recommended)
-- =====================================================
-- Uncomment these if you want to enable RLS

-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE hourly_performance ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
-- These allow the anon key to access the tables

GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON hourly_performance TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON recommendations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON action_log TO anon;
GRANT SELECT, INSERT, UPDATE ON settings TO anon;
GRANT EXECUTE ON FUNCTION get_hourly_aggregates TO anon;

-- =====================================================
-- DONE! Your database is ready.
-- =====================================================
