import { useState, useEffect } from 'react';
import Head from 'next/head';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [settings, setSettings] = useState({
    autoOptimize: false,
    maxBudgetIncrease: 30,
    maxBudgetDecrease: 30,
  });
  // Fetch settings on load
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setSettings({
          autoOptimize: data.settings.auto_optimize || false,
          maxBudgetIncrease: data.settings.max_budget_increase || 30,
          maxBudgetDecrease: data.settings.max_budget_decrease || 30,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Fetch campaigns on load
  useEffect(() => {
    fetchCampaigns();
    fetchRecommendations();
  }, []);

  // Fetch analysis when campaign selected
  useEffect(() => {
    if (selectedCampaign) {
      fetchAnalysis(selectedCampaign.id);
      fetchCampaignSettings(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  const fetchCampaignSettings = async (campaignId) => {
    try {
      const res = await fetch(`/api/campaign-settings?campaignId=${campaignId}`);
      const data = await res.json();
      if (data.settings) {
        setSettings({
          autoOptimize: data.settings.auto_optimize || false,
          maxBudgetIncrease: data.settings.max_budget_increase || 30,
          maxBudgetDecrease: data.settings.max_budget_decrease || 30,
        });
      }
    } catch (error) {
      console.error('Error fetching campaign settings:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      if (data.campaigns?.length > 0 && !selectedCampaign) {
        setSelectedCampaign(data.campaigns[0]);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysis = async (campaignId) => {
    try {
      const res = await fetch(`/api/analyze?campaignId=${campaignId}`);
      const data = await res.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Error fetching analysis:', error);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const res = await fetch('/api/recommendations');
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const syncData = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLastSync(new Date());
        fetchCampaigns();
        if (selectedCampaign) {
          fetchAnalysis(selectedCampaign.id);
        }
      }
    } catch (error) {
      console.error('Error syncing data:', error);
    } finally {
      setSyncing(false);
    }
  };

  const applyRecommendation = async (recId, action) => {
    try {
      const res = await fetch('/api/apply-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: recId, action }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRecommendations();
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error applying recommendation:', error);
    }
  };

  const getRecommendationBadge = (rec) => {
    switch (rec) {
      case 'increase': return <span className="badge badge-green">↑ Increase</span>;
      case 'decrease': return <span className="badge badge-red">↓ Decrease</span>;
      case 'maintain': return <span className="badge badge-yellow">→ Maintain</span>;
      case 'monitor': return <span className="badge badge-orange">⚠ Monitor</span>;
      default: return <span className="badge badge-blue">—</span>;
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatPercent = (value) => `${value.toFixed(2)}%`;

  return (
    <>
      <Head>
        <title>Meta Ads Optimizer | Dashboard</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-dark-900">
        {/* Header */}
        <header className="border-b border-white/10 bg-dark-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <span className="text-xl">📊</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold">Meta Ads Optimizer</h1>
                  <p className="text-sm text-gray-400">AI-Powered Budget Optimization</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">
                  {lastSync && `Last sync: ${lastSync.toLocaleTimeString()}`}
                </div>
                <button 
                  onClick={syncData}
                  disabled={syncing}
                  className="btn btn-primary"
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Syncing...
                    </>
                  ) : (
                    <>🔄 Sync Data</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Campaign Selector */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-400 mb-2">Select Campaign</label>
            <div className="flex gap-2 flex-wrap">
              {campaigns.map(campaign => (
                <button
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCampaign?.id === campaign.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {campaign.name}
                </button>
              ))}
              {campaigns.length === 0 && !loading && (
                <p className="text-gray-500">No campaigns found. Click "Sync Data" to fetch from Meta.</p>
              )}
            </div>
          </div>

          {/* KPI Cards */}
          {analysis?.overallMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5 card-hover">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Spend</p>
                <p className="text-2xl font-bold font-mono text-blue-400">
                  {formatCurrency(analysis.overallMetrics.totalSpend)}
                </p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5 card-hover">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Purchases</p>
                <p className="text-2xl font-bold font-mono text-purple-400">
                  {analysis.overallMetrics.totalPurchases}
                </p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5 card-hover">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Revenue</p>
                <p className="text-2xl font-bold font-mono text-green-400">
                  {formatCurrency(analysis.overallMetrics.totalRevenue)}
                </p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5 card-hover">
                <p className="text-xs text-gray-400 uppercase tracking-wider">ROAS</p>
                <p className={`text-2xl font-bold font-mono ${
                  analysis.overallMetrics.overallRoas >= 1 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {analysis.overallMetrics.overallRoas.toFixed(2)}x
                </p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5 card-hover">
                <p className="text-xs text-gray-400 uppercase tracking-wider">CPA</p>
                <p className="text-2xl font-bold font-mono text-yellow-400">
                  {formatCurrency(analysis.overallMetrics.overallCpa)}
                </p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5 card-hover">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Period</p>
                <p className="text-lg font-bold">{analysis.period}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Chart */}
            <div className="lg:col-span-2">
              <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                <h2 className="text-lg font-semibold mb-4">Hourly Performance</h2>
                {analysis?.hourlyAnalysis && (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={analysis.hourlyAnalysis.sort((a, b) => a.hour - b.hour)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                      <XAxis 
                        dataKey="hour" 
                        stroke="#8888a0"
                        tickFormatter={(h) => `${h}:00`}
                      />
                      <YAxis yAxisId="left" stroke="#8888a0" />
                      <YAxis yAxisId="right" orientation="right" stroke="#a855f7" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#12121a', 
                          border: '1px solid #2a2a3a',
                          borderRadius: '8px'
                        }}
                        formatter={(value, name) => {
                          if (name === 'ROAS') return [value.toFixed(2) + 'x', name];
                          if (name === 'CPA') return ['$' + value.toFixed(2), name];
                          if (name === 'Score') return [value, name];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar 
                        yAxisId="left"
                        dataKey="scores.composite" 
                        name="Score"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="metrics.roas" 
                        name="ROAS"
                        stroke="#22c55e" 
                        strokeWidth={2}
                        dot={{ fill: '#22c55e' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Hourly Table */}
              <div className="bg-dark-800 rounded-xl p-6 border border-white/5 mt-6">
                <h2 className="text-lg font-semibold mb-4">Hourly Breakdown</h2>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Hour</th>
                        <th>Spend</th>
                        <th>Purchases</th>
                        <th>ROAS</th>
                        <th>CPA</th>
                        <th>Score</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis?.hourlyAnalysis?.map(h => (
                        <tr key={h.hour}>
                          <td className="font-mono">{String(h.hour).padStart(2, '0')}:00</td>
                          <td className="font-mono">{formatCurrency(h.metrics.spend)}</td>
                          <td>{h.metrics.purchases}</td>
                          <td className={`font-mono ${h.metrics.roas >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                            {h.metrics.roas.toFixed(2)}x
                          </td>
                          <td className="font-mono">{formatCurrency(h.metrics.cpa)}</td>
                          <td>{h.scores.composite}</td>
                          <td>{getRecommendationBadge(h.recommendation)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Summary Card */}
              {analysis?.summary && (
                <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-500/20">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <span>🎯</span> Quick Summary
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-400">Best Hours</p>
                      <p className="text-green-400 font-mono">{analysis.summary.peakPerformanceHours || 'Analyzing...'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Worst Hours</p>
                      <p className="text-red-400 font-mono">{analysis.summary.underperformingHours || 'Analyzing...'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Top Recommendation</p>
                      <p className="text-white">{analysis.summary.topRecommendation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span>💡</span> Recommendations
                </h3>
                <div className="space-y-3">
                  {analysis?.recommendations?.map((rec, i) => (
                    <div 
                      key={i}
                      className={`p-4 rounded-lg border ${
                        rec.priority === 'urgent' ? 'border-red-500/50 bg-red-500/10' :
                        rec.priority === 'high' ? 'border-yellow-500/50 bg-yellow-500/10' :
                        'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`badge ${
                          rec.priority === 'urgent' ? 'badge-red' :
                          rec.priority === 'high' ? 'badge-yellow' :
                          'badge-blue'
                        }`}>
                          {rec.priority}
                        </span>
                        <span className="text-xs text-gray-400 uppercase">{rec.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">{rec.reason}</p>
                      {rec.suggestedAction && (
                        <p className="text-sm text-purple-400">{rec.suggestedAction}</p>
                      )}
                      {rec.percentChange && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-400">Budget change:</span>
                          <span className={`font-mono font-bold ${
                            rec.percentChange > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {rec.percentChange > 0 ? '+' : ''}{rec.percentChange}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {(!analysis?.recommendations || analysis.recommendations.length === 0) && (
                    <p className="text-gray-500 text-sm">No recommendations yet. Sync data to analyze.</p>
                  )}
                </div>
              </div>

            {/* Campaign Settings */}
<div className="bg-dark-800 rounded-xl p-6 border border-white/5">
  <h3 className="font-semibold mb-4 flex items-center gap-2">
    <span>⚙️</span> Campaign Settings
  </h3>
  {selectedCampaign && (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-300">Auto-Optimize This Campaign</label>
        <button
          onClick={async () => {
            const newValue = !settings.autoOptimize;
            setSettings(s => ({ ...s, autoOptimize: newValue }));
            await fetch('/api/campaign-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaign_id: selectedCampaign.id,
                auto_optimize: newValue,
                max_budget_increase: settings.maxBudgetIncrease,
                max_budget_decrease: settings.maxBudgetDecrease,
              }),
            });
          }}
          className={`toggle ${settings.autoOptimize ? 'toggle-enabled' : 'toggle-disabled'}`}
        >
          <span className={`toggle-knob ${settings.autoOptimize ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </div>
      <div>
        <label className="text-sm text-gray-400 block mb-1">Max Budget Increase</label>
        <input
          type="range"
          min="10"
          max="50"
          value={settings.maxBudgetIncrease}
          onChange={async (e) => {
            const value = parseInt(e.target.value);
            setSettings(s => ({ ...s, maxBudgetIncrease: value }));
            await fetch('/api/campaign-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaign_id: selectedCampaign.id,
                auto_optimize: settings.autoOptimize,
                max_budget_increase: value,
                max_budget_decrease: settings.maxBudgetDecrease,
              }),
            });
          }}
          className="w-full"
        />
        <span className="text-sm font-mono">{settings.maxBudgetIncrease}%</span>
      </div>
      <div>
        <label className="text-sm text-gray-400 block mb-1">Max Budget Decrease</label>
        <input
          type="range"
          min="10"
          max="50"
          value={settings.maxBudgetDecrease}
          onChange={async (e) => {
            const value = parseInt(e.target.value);
            setSettings(s => ({ ...s, maxBudgetDecrease: value }));
            await fetch('/api/campaign-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaign_id: selectedCampaign.id,
                auto_optimize: settings.autoOptimize,
                max_budget_increase: settings.maxBudgetIncrease,
                max_budget_decrease: value,
              }),
            });
          }}
          className="w-full"
        />
        <span className="text-sm font-mono">{settings.maxBudgetDecrease}%</span>
      </div>
    </div>
  )}
</div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">Auto-Optimize</label>
                    <button
                     onClick={() => {
  const newSettings = { ...settings, autoOptimize: !settings.autoOptimize };
  setSettings(newSettings);
  saveSettings(newSettings);
}}
                      className={`toggle ${settings.autoOptimize ? 'toggle-enabled' : 'toggle-disabled'}`}
                    >
                      <span className={`toggle-knob ${settings.autoOptimize ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Max Budget Increase</label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={settings.maxBudgetIncrease}
                      onChange={(e) => setSettings(s => ({ ...s, maxBudgetIncrease: e.target.value }))}
                      className="w-full"
                    />
                    <span className="text-sm font-mono">{settings.maxBudgetIncrease}%</span>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Max Budget Decrease</label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={settings.maxBudgetDecrease}
                      onChange={(e) => setSettings(s => ({ ...s, maxBudgetDecrease: e.target.value }))}
                      className="w-full"
                    />
                    <span className="text-sm font-mono">{settings.maxBudgetDecrease}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
