'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Settings, ExternalLink, MoreHorizontal } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type WebsiteTab = 'overview' | 'bots' | 'pages' | 'logs' | 'referrals';

const chartData = [
  { date: 'Mar 30', chatgpt: 450, claude: 380, perplexity: 290 },
  { date: 'Mar 31', chatgpt: 520, claude: 420, perplexity: 310 },
  { date: 'Apr 1', chatgpt: 480, claude: 390, perplexity: 260 },
  { date: 'Apr 2', chatgpt: 550, claude: 440, perplexity: 320 },
  { date: 'Today', chatgpt: 520, claude: 410, perplexity: 280 },
];

const platformData = [
  {
    name: 'OpenAI',
    icon: '🤖',
    crawls: '1.2k',
    crawlsChange: '+200',
    visitors: '500',
    visitorsChange: '+200',
    indexed: '20%',
    lastIndexed: '13 mins ago',
  },
  {
    name: 'Anthropic',
    icon: '🔵',
    crawls: '890',
    crawlsChange: '+150',
    visitors: '380',
    visitorsChange: '+120',
    indexed: '18%',
    lastIndexed: '25 mins ago',
  },
  {
    name: 'Perplexity',
    icon: '🔍',
    crawls: '650',
    crawlsChange: '+80',
    visitors: '290',
    visitorsChange: '+90',
    indexed: '15%',
    lastIndexed: '45 mins ago',
  },
];

export default function MyWebsiteSection() {
  const [activeTab, setActiveTab] = useState<WebsiteTab>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('7d');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex gap-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'bots', label: 'Bots' },
            { id: 'pages', label: 'Pages' },
            { id: 'logs', label: 'Logs' },
            { id: 'referrals', label: 'Referrals' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as WebsiteTab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">tryprofound.com</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {[
              { id: '7d', label: 'Last 7d' },
              { id: '14d', label: 'Last 14d' },
              { id: '30d', label: 'Last 30d' },
              { id: 'custom', label: 'Custom' },
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setDateRange(range.id as '7d' | '14d' | '30d')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  dateRange === range.id
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-3 w-3 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-3 w-3 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm text-muted-foreground">AI Bot Traffic</p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-foreground">23.1%</p>
                <div className="flex items-center text-green-500 text-sm font-medium">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +2%
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm text-muted-foreground">AI-Referred Visitors</p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-foreground">1.2k</p>
                <div className="flex items-center text-green-500 text-sm font-medium">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +200
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm text-muted-foreground">Pages Indexed by AI Bots</p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-foreground">48%</p>
                <div className="flex items-center text-green-500 text-sm font-medium">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +4%
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm text-muted-foreground">Most Active AI Bot</p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-2xl font-bold text-foreground">ChatGPT-User</p>
            </Card>
          </div>

          {/* AI Bot Visits Chart */}
          <Card className="p-6">
            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-1">
                <h3 className="text-lg font-semibold text-foreground">AI Bot Visits</h3>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-foreground">1,320</p>
                <div className="flex items-center text-green-500 text-sm font-medium">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +56
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="chatgpt"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="ChatGPT"
                  />
                  <Line
                    type="monotone"
                    dataKey="claude"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    name="Claude"
                  />
                  <Line
                    type="monotone"
                    dataKey="perplexity"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Perplexity"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Platform Table */}
          <Card className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Platform</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Crawls</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">AI-Referred Visitors</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pages Indexed</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Last Indexed</th>
                  </tr>
                </thead>
                <tbody>
                  {platformData.map((platform) => (
                    <tr key={platform.name} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{platform.icon}</span>
                          <span className="text-sm font-medium text-foreground">{platform.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{platform.crawls}</span>
                          <span className="text-xs text-green-500">{platform.crawlsChange}</span>
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 w-3/4" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{platform.visitors}</span>
                          <span className="text-xs text-green-500">{platform.visitorsChange}</span>
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 w-2/3" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-foreground">{platform.indexed}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-muted-foreground">{platform.lastIndexed}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

