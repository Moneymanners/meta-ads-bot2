import { useState, useEffect } from 'react';
import Head from 'next/head';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Home() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [settings, setSettings] = useState({
    autoOptimize: false,
    maxBudgetIncrease: 30,
    maxBudgetDecrease: 30,
  });
  const [dailyAnalysis, setDailyAnalysis] = useState(null);
  const [impact, setImpact] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  
  // Date filter state
  const [dateRange, setDateRange] = useState('last_14_days');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'last_14_days', label: 'Last 14 Days' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const getDateRangeLabel = () => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return `${customStartDate} - ${customEndDate}`;
    }
    const option = dateRangeOptions.find(o => o.value === dateRange);
    return option ? option.label : 'Last 14 Days';
  };

  useEffect(() => {
    fetchCampaigns();
    fetchSuggestions();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      fetchAnalysis(selectedCampaign.id);
      fetchCampaignSettings(selectedCampaign.id);
      fetchDailyAnalysis(selectedCampaign.id);
      fetchImpact(selectedCampaign.id);
    }
  }, [selectedCampaign, dateRange, customStartDate, customEndDate]);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      if (data.campaigns?.length > 0) {
        setSelectedCampaign(data.campaigns[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setLoading(false);
    }
  };

  const fetchAnalysis = async (campaignId) => {
    try {
      let url = `/api/analyze?campaignId=${campaignId}&dateRange=${dateRange}`;
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      console.log('Analysis data:', data);
      setAnalysis(data);
    } catch (error) {
      console.error('Error fetching analysis:', error);
    }
  };

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
      } else {
        setSettings({
          autoOptimize: false,
          maxBudgetIncrease: 30,
          maxBudgetDecrease: 30,
        });
      }
    } catch (error) {
      console.error('Error fetching campaign settings:', error);
    }
  };

  const saveCampaignSettings = async (campaignId, newSettings) => {
    try {
      await fetch('/api/campaign-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          auto_optimize: newSettings.autoOptimize,
          max_budget_increase: newSettings.maxBudgetIncrease,
          max_budget_decrease: newSettings.maxBudgetDecrease,
        }),
      });
    } catch (error) {
      console.error('Error saving campaign settings:', error);
    }
  };

  const fetchDailyAnalysis = async (campaignId) => {
    try {
      let url = `/api/daily-analysis?campaignId=${campaignId}&dateRange=${dateRange}`;
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setDailyAnalysis(data);
    } catch (error) {
      console.error('Error fetching daily analysis:', error);
    }
  };

  const fetchImpact = async (campaignId) => {
    try {
      const res = await fetch(`/api/impact?campaignId=${campaignId}`);
      const data = await res.json();
      setImpact(data.impact);
    } catch (error) {
      console.error('Error fetching impact:', error);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/suggestions');
      const data = await res.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLastSync(new Date().toLocaleTimeString());
        await fetchCampaigns();
        if (selectedCampaign) {
          await fetchAnalysis(selectedCampaign.id);
          await fetchDailyAnalysis(selectedCampaign.id);
          await fetchImpact(selectedCampaign.id);
        }
      }
    } catch (error) {
      console.error('Error syncing:', error);
    }
    setSyncing(false);
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#eab308';
    if (score >= 30) return '#f97316';
    return '#ef4444';
  };

  const getActionBadge = (action) => {
    const actionUpper = (action || 'monitor').toUpperCase();
    const styles = {
      INCREASE: 'bg-green-500/20 text-green-400',
      MAINTAIN: 'bg-blue-500/20 text-blue-400',
      DECREASE: 'bg-red-500/20 text-red-400',
      MONITOR: 'bg-yellow-500/20 text-yellow-400',
    };
    const icons = {
      INCREASE: '↑',
      MAINTAIN: '→',
      DECREASE: '↓',
      MONITOR: '⚠',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[actionUpper] || styles.MONITOR}`}>
        {icons[actionUpper] || '⚠'} {actionUpper}
      </span>
    );
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  // Map analysis data
  const metrics = analysis?.overallMetrics || {};
  const totalSpend = metrics.totalSpend || analysis?.totalSpend || 0;
  const totalPurchases = metrics.totalPurchases || analysis?.totalPurchases || 0;
  const totalRevenue = metrics.totalRevenue || analysis?.totalRevenue || 0;
  const overallRoas = metrics.overallRoas || analysis?.overallRoas || 0;
  const overallCpa = metrics.overallCpa || analysis?.overallCpa || 0;
  
  const hourlyData = (analysis?.hourlyAnalysis || []).map(item => ({
    hour: item.hour,
    spend: item.metrics?.spend || 0,
    purchases: item.metrics?.purchases || 0,
    roas: item.metrics?.roas || 0,
    cpa: item.metrics?.cpa || 0,
    score: item.scores?.composite || 0,
    action: item.recommendation || 'monitor',
  })).sort((a, b) => a.hour - b.hour);
  
  const recommendations = analysis?.recommendations || [];
  const insights = analysis?.summary || {};

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <Head>
        <title>Meta Ads Optimizer</title>
        <meta name="description" content="AI-Powered Budget Optimization" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">Meta Ads Optimizer</h1>
              <p className="text-xs text-gray-400">AI-Powered Budget Optimization</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastSync && (
              <span className="text-xs text-gray-400">Last sync: {lastSync}</span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <span className={syncing ? 'animate-spin' : ''}>🔄</span>
              {syncing ? 'Syncing...' : 'Sync Data'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Campaign Selector and Date Filter Row */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex-1">
            <h2 className="text-sm font-medium text-gray-400 mb-2">Select Campaign</h2>
            {campaigns.length === 0 ? (
              <p className="text-gray-500">No campaigns found. Click Sync Data to fetch from Meta.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => setSelectedCampaign(campaign)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCampaign?.id === campaign.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                    }`}
                  >
                    {campaign.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Filter */}
          <div className="relative">
            <h2 className="text-sm font-medium text-gray-400 mb-2">Date Range</h2>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-white/10 min-w-[180px]"
            >
              <span>📅</span>
              <span className="flex-1 text-left">{getDateRangeLabel()}</span>
              <span className="text-gray-400">▼</span>
            </button>
            
            {showDatePicker && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowDatePicker(false)}
                />
                
                {/* Dropdown */}
                <div className="absolute right-0 mt-2 w-64 bg-dark-800 rounded-lg shadow-xl border border-white/10 z-50 overflow-hidden">
                  {dateRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        if (option.value !== 'custom') {
                          setDateRange(option.value);
                          setShowDatePicker(false);
                        } else {
                          setDateRange('custom');
                        }
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-dark-700 transition-colors flex items-center gap-2 ${
                        dateRange === option.value ? 'bg-purple-600/20 text-purple-400' : 'text-gray-300'
                      }`}
                    >
                      {dateRange === option.value && <span>✓</span>}
                      <span className={dateRange === option.value ? '' : 'ml-5'}>{option.label}</span>
                    </button>
                  ))}
                  
                  {/* Custom Date Range Inputs */}
                  {dateRange === 'custom' && (
                    <div className="p-4 border-t border-white/10">
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Start Date</label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full bg-dark-700 border border-white/10 rounded px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">End Date</label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full bg-dark-700 border border-white/10 rounded px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (customStartDate && customEndDate) {
                              setShowDatePicker(false);
                            }
                          }}
                          disabled={!customStartDate || !customEndDate}
                          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-sm font-medium transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {selectedCampaign && analysis && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-gray-400 mb-1">TOTAL SPEND</p>
                <p className="text-xl font-bold text-purple-400">{formatCurrency(totalSpend)}</p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-gray-400 mb-1">PURCHASES</p>
                <p className="text-xl font-bold text-blue-400">{totalPurchases}</p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-gray-400 mb-1">REVENUE</p>
                <p className="text-xl font-bold text-green-400">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-gray-400 mb-1">ROAS</p>
                <p className={`text-xl font-bold ${overallRoas >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(overallRoas).toFixed(2)}x
                </p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-gray-400 mb-1">CPA</p>
                <p className="text-xl font-bold text-orange-400">{formatCurrency(overallCpa)}</p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-gray-400 mb-1">PERIOD</p>
                <p className="text-lg font-bold text-gray-300">{getDateRangeLabel()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Hourly Performance Chart */}
                <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                  <h3 className="text-lg font-semibold mb-4">Hourly Performance</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData}>
                        <XAxis 
                          dataKey="hour" 
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                          tickFormatter={(h) => `${h}:00`}
                        />
                        <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: '8px',
                          }}
                          formatter={(value, name) => [value, name === 'score' ? 'Score' : name]}
                          labelFormatter={(h) => `Hour: ${h}:00`}
                        />
                        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                          {hourlyData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center mt-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span>Score</span>
                    </div>
                  </div>
                </div>

                {/* Hourly Breakdown Table */}
                <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                  <h3 className="text-lg font-semibold mb-4">Hourly Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-white/10">
                          <th className="text-left py-2 px-2">HOUR</th>
                          <th className="text-right py-2 px-2">SPEND</th>
                          <th className="text-right py-2 px-2">PURCHASES</th>
                          <th className="text-right py-2 px-2">ROAS</th>
                          <th className="text-right py-2 px-2">CPA</th>
                          <th className="text-right py-2 px-2">SCORE</th>
                          <th className="text-right py-2 px-2">ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hourlyData.map((row) => (
                          <tr key={row.hour} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-2 px-2 font-medium">{String(row.hour).padStart(2, '0')}:00</td>
                            <td className="text-right py-2 px-2">{formatCurrency(row.spend)}</td>
                            <td className="text-right py-2 px-2">{row.purchases}</td>
                            <td className={`text-right py-2 px-2 ${row.roas >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                              {Number(row.roas).toFixed(2)}x
                            </td>
                            <td className="text-right py-2 px-2">{formatCurrency(row.cpa)}</td>
                            <td className="text-right py-2 px-2">{row.score}</td>
                            <td className="text-right py-2 px-2">{getActionBadge(row.action)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Day of Week Performance */}
                {dailyAnalysis && dailyAnalysis.daily_breakdown && (
                  <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <span>📅</span> Day-of-Week Performance
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-green-500/10 rounded-lg p-3">
                        <p className="text-xs text-gray-400">Best Days</p>
                        <p className="text-green-400 font-semibold">
                          {dailyAnalysis.best_days?.length > 0 ? dailyAnalysis.best_days.join(', ') : 'Analyzing...'}
                        </p>
                      </div>
                      <div className="bg-red-500/10 rounded-lg p-3">
                        <p className="text-xs text-gray-400">Worst Days</p>
                        <p className="text-red-400 font-semibold">
                          {dailyAnalysis.worst_days?.length > 0 ? dailyAnalysis.worst_days.join(', ') : 'None'}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 border-b border-white/10">
                            <th className="text-left py-2">DAY</th>
                            <th className="text-right py-2">AVG SPEND</th>
                            <th className="text-right py-2">ROAS</th>
                            <th className="text-right py-2">CPA</th>
                            <th className="text-right py-2">SCORE</th>
                            <th className="text-right py-2">ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyAnalysis.daily_breakdown.map((day) => (
                            <tr key={day.day_name} className="border-b border-white/5">
                              <td className="py-2 font-medium">{day.day_name}</td>
                              <td className="text-right">${day.avg_spend}</td>
                              <td className={`text-right ${parseFloat(day.roas) >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                {day.roas}x
                              </td>
                              <td className="text-right">${day.cpa}</td>
                              <td className="text-right">{day.score}</td>
                              <td className="text-right">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  day.recommendation === 'INCREASE' ? 'bg-green-500/20 text-green-400' :
                                  day.recommendation === 'DECREASE' ? 'bg-red-500/20 text-red-400' :
                                  'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {day.recommendation}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {dailyAnalysis.recommendation && (
                      <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
                        <p className="text-sm text-blue-400">💡 {dailyAnalysis.recommendation}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-Optimize Impact */}
                {impact && impact.auto_optimize_enabled_at && (
                  <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <span>📈</span> Auto-Optimize Impact
                    </h3>
                    
                    <p className="text-sm text-gray-400 mb-4">
                      Performance since auto-optimize enabled
                    </p>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-dark-700 rounded-lg p-4">
                        <p className="text-xs text-gray-400">ROAS</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-gray-500 line-through">{parseFloat(impact.before_roas).toFixed(2)}x</span>
                          <span className="text-xl font-bold text-green-400">{parseFloat(impact.after_roas).toFixed(2)}x</span>
                        </div>
                        <p className="text-sm text-green-400">+{impact.roas_improvement}%</p>
                      </div>

                      <div className="bg-dark-700 rounded-lg p-4">
                        <p className="text-xs text-gray-400">CPA</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-gray-500 line-through">${parseFloat(impact.before_cpa).toFixed(2)}</span>
                          <span className="text-xl font-bold text-green-400">${parseFloat(impact.after_cpa).toFixed(2)}</span>
                        </div>
                        <p className="text-sm text-green-400">-{impact.cpa_improvement}%</p>
                      </div>

                      <div className="bg-dark-700 rounded-lg p-4">
                        <p className="text-xs text-gray-400">EXTRA PROFIT</p>
                        <p className="text-2xl font-bold text-green-400">
                          +${parseFloat(impact.total_extra_profit).toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-400">since enabled</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Suggestions */}
                {suggestions && suggestions.youtube_tips && (
                  <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <span>🤖</span> Latest Optimization Tips
                    </h3>

                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-400 mb-3">📺 From YouTube Experts</h4>
                      <div className="space-y-3">
                        {suggestions.youtube_tips.map((tip, index) => (
                          <div key={index} className="bg-dark-700 rounded-lg p-3">
                            <p className="font-medium text-sm">{tip.title}</p>
                            <p className="text-xs text-gray-400">— {tip.source}</p>
                            <p className="text-xs text-blue-400 mt-1">💡 {tip.tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {suggestions.web_tips && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-400 mb-3">🌐 From the Web</h4>
                        <div className="space-y-3">
                          {suggestions.web_tips.map((tip, index) => (
                            <div key={index} className="bg-dark-700 rounded-lg p-3">
                              <p className="font-medium text-sm">{tip.title}</p>
                              <p className="text-xs text-gray-400">— {tip.source}</p>
                              <p className="text-xs text-blue-400 mt-1">💡 {tip.tip}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {suggestions.general_recommendations && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-3">⚡ Quick Wins</h4>
                        <ul className="space-y-2">
                          {suggestions.general_recommendations.map((tip, index) => (
                            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-green-400">✓</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Summary */}
                <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <span>🎯</span> Quick Summary
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-400">Best Hours</p>
                      <p className="text-green-400 font-medium">
                        {insights?.peakPerformanceHours || 'Analyzing...'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Worst Hours</p>
                      <p className="text-red-400 font-medium">
                        {insights?.underperformingHours || 'None'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Top Recommendation</p>
                      <p className="text-gray-300 text-sm">
                        {insights?.topRecommendation || 'No immediate actions needed'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <span>💡</span> Recommendations
                  </h3>
                  {recommendations.length === 0 ? (
                    <p className="text-gray-500 text-sm">No recommendations yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {recommendations.slice(0, 3).map((rec, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg ${
                            rec.priority === 'high'
                              ? 'bg-purple-500/10 border border-purple-500/20'
                              : 'bg-dark-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              rec.priority === 'high' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {rec.priority}
                            </span>
                            <span className="text-xs text-gray-400">{rec.type}</span>
                          </div>
                          <p className="text-sm text-gray-300">{rec.reason}</p>
                          {rec.percentChange && (
                            <p className="text-xs text-green-400 mt-1">
                              Budget change: {rec.percentChange > 0 ? '+' : ''}{rec.percentChange}%
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Settings */}
                <div className="bg-dark-800 rounded-xl p-6 border border-white/5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <span>⚙️</span> Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-300">Auto-Optimize</label>
                      <button
                        onClick={async () => {
                          const newSettings = { ...settings, autoOptimize: !settings.autoOptimize };
                          setSettings(newSettings);
                          if (selectedCampaign) {
                            await saveCampaignSettings(selectedCampaign.id, newSettings);
                            if (newSettings.autoOptimize) {
                              await fetch('/api/impact', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  campaign_id: selectedCampaign.id,
                                  action: 'enable',
                                }),
                              });
                            }
                            fetchImpact(selectedCampaign.id);
                          }
                        }}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          settings.autoOptimize ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${
                            settings.autoOptimize ? 'left-6' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Max Budget Increase</label>
                      <input
                        type="range"
                        min="10"
                        max="50"
                        value={settings.maxBudgetIncrease}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          const newSettings = { ...settings, maxBudgetIncrease: value };
                          setSettings(newSettings);
                          if (selectedCampaign) {
                            saveCampaignSettings(selectedCampaign.id, newSettings);
                          }
                        }}
                        className="w-full accent-purple-500"
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
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          const newSettings = { ...settings, maxBudgetDecrease: value };
                          setSettings(newSettings);
                          if (selectedCampaign) {
                            saveCampaignSettings(selectedCampaign.id, newSettings);
                          }
                        }}
                        className="w-full accent-purple-500"
                      />
                      <span className="text-sm font-mono">{settings.maxBudgetDecrease}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin text-4xl">🔄</div>
          </div>
        )}
      </main>
    </div>
  );
}
