'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useBrandAnalyses } from '@/hooks/useBrandAnalyses';
import { useCustomer } from '@/hooks/useAutumnCustomer';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

// Mock data for fallback
const mockVisibilityData = [
  { date: 'Jul 10', vercel: 50, netlify: 60 },
  { date: 'Jul 12', vercel: 55, netlify: 45 },
  { date: 'Jul 14', vercel: 58, netlify: 38 },
  { date: 'Jul 16', vercel: 56, netlify: 25 },
  { date: 'Jul 18', vercel: 52, netlify: 35 },
  { date: 'Jul 20', vercel: 50, netlify: 38 },
  { date: 'Jul 22', vercel: 65, netlify: 32 },
  { date: 'Jul 24', vercel: 75, netlify: 30 },
  { date: 'Jul 26', vercel: 85, netlify: 35 },
  { date: 'Jul 28', vercel: 82, netlify: 40 },
];

const mockTopSources = [
  { rank: 1, source: 'AWS', mentions: 32 },
  { rank: 2, source: 'Google Cloud', mentions: 28 },
  { rank: 3, source: 'Microsoft Azure', mentions: 24 },
  { rank: 4, source: 'Stack Overflow', mentions: 22 },
  { rank: 5, source: 'Dev.to', mentions: 18 },
];

const mockTopWebPages = [
  { rank: 1, url: 'https://example.com/', mentions: 37 },
  { rank: 2, url: 'https://example.com/docs', mentions: 28 },
  { rank: 3, url: 'https://example.com/blog', mentions: 22 },
  { rank: 4, url: 'https://example.com/pricing', mentions: 18 },
  { rank: 5, url: 'https://example.com/guides', mentions: 15 },
];

export default function DashboardPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const [showCompetitorVisibility, setShowCompetitorVisibility] = useState(false);
  const [activeTab, setActiveTab] = useState<'all-time' | 'last-month' | 'last-week'>('all-time');
  const [selectedProvider, setSelectedProvider] = useState('chatgpt');
  
  // Use React Query hooks for real-time data
  const { data: analyses, isLoading: analysesLoading, error: analysesError } = useBrandAnalyses();
  const { customer, isLoading: customerLoading } = useCustomer();

  // Get the most recent analysis
  const latestAnalysis = useMemo(() => {
    if (!analyses || analyses.length === 0) return null;
    return analyses[0];
  }, [analyses]);

  // Get credits from customer data
  const credits = customer?.features?.messages?.balance || 0;

  // Redirect if not authenticated
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/login');
    }
  }, [session, sessionLoading, router]);

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const loading = analysesLoading || customerLoading;
  const error = analysesError?.message || null;

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard' }]}>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Credits:</span>{' '}
              <span className="font-semibold">{credits}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Analyses:</span>{' '}
              <span className="font-semibold">{analyses?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Provider Selector */}
        <div className="w-64">
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chatgpt">🤖 ChatGPT</SelectItem>
              <SelectItem value="claude">🧠 Claude</SelectItem>
              <SelectItem value="gemini">✨ Gemini</SelectItem>
              <SelectItem value="perplexity">🔍 Perplexity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                className="mt-4"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && !latestAnalysis && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  No analysis data available. Run your first brand analysis to see insights here.
                </p>
                <Button onClick={() => router.push('/brand-monitor')}>
                  Start Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Content */}
        {!loading && !error && latestAnalysis && latestAnalysis.analysisData && (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Brand Visibility */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Brand Visibility
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {latestAnalysis.analysisData.visibilityScore?.toFixed(1) || '0'}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on {latestAnalysis.analysisData.prompts?.length || 0} prompts simulated
                  </p>
                </CardContent>
              </Card>

              {/* Top Source */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Top Source
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const topSource = latestAnalysis.analysisData.citationAnalysis?.topSources?.[0];
                    return topSource ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                            <span className="text-lg">📰</span>
                          </div>
                          <div className="font-semibold truncate">{topSource.domain || topSource.url}</div>
                        </div>
                        <p className="text-sm text-muted-foreground">{topSource.count} mentions</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data available</p>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Closest Competitor */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Closest Competitor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const closestCompetitor = latestAnalysis.analysisData.competitors?.[1];
                    return closestCompetitor ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                            <span className="text-lg">🏢</span>
                          </div>
                          <div className="font-semibold">{closestCompetitor.company?.name || 'N/A'}</div>
                        </div>
                        <p className="text-sm text-muted-foreground">{closestCompetitor.mentions || 0} mentions</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No competitors found</p>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Brand Ranking */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Brand Ranking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const yourCompany = latestAnalysis.analysisData.competitors?.find((c: any) => c.isYourCompany);
                    const rank = yourCompany?.rank || latestAnalysis.analysisData.competitors?.findIndex((c: any) => 
                      c.company?.name?.toLowerCase() === latestAnalysis.analysisData.company?.name?.toLowerCase()
                    ) + 1 || 1;
                    return (
                      <>
                        <div className="text-3xl font-bold">#{rank}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {rank === 1 ? 'Market leader' : `Rank ${rank}`}
                        </p>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* Brand Visibility Chart and Competitor Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Brand Visibility Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Brand Visibility</CardTitle>
                    <div className="flex items-center gap-3">
                      <label htmlFor="competitor-toggle" className="text-sm text-muted-foreground cursor-pointer">
                        Show competitor visibility
                      </label>
                      <Switch
                        id="competitor-toggle"
                        checked={showCompetitorVisibility}
                        onCheckedChange={setShowCompetitorVisibility}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mockVisibilityData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          domain={[0, 100]}
                          ticks={[0, 20, 40, 60, 80, 100]}
                          label={{ value: 'Daily Visibility (%)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip />
                        <defs>
                          <linearGradient id="vercelGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="netlifyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="vercel"
                          stroke="hsl(var(--primary))"
                          fill="url(#vercelGradient)"
                          strokeWidth={2}
                        />
                        {showCompetitorVisibility && (
                          <Area
                            type="monotone"
                            dataKey="netlify"
                            stroke="hsl(var(--destructive))"
                            fill="url(#netlifyGradient)"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-6 mt-4 justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-sm text-muted-foreground">Your Brand</span>
                    </div>
                    {showCompetitorVisibility && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                        <span className="text-sm text-muted-foreground">Competitor</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Competitor Rankings */}
              <Card>
                <CardHeader>
                  <CardTitle>Competitor Rankings</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={activeTab === 'all-time' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('all-time')}
                      className="text-xs"
                    >
                      All Time
                    </Button>
                    <Button
                      variant={activeTab === 'last-month' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('last-month')}
                      className="text-xs"
                    >
                      Last Month
                    </Button>
                    <Button
                      variant={activeTab === 'last-week' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('last-week')}
                      className="text-xs"
                    >
                      Last Week
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex text-xs text-muted-foreground mb-2">
                      <div className="flex-shrink-0 w-12">Rank</div>
                      <div className="flex-1">Competitor</div>
                      <div className="flex-shrink-0 w-24 text-right">Market Share</div>
                    </div>
                    {latestAnalysis.analysisData.competitors?.slice(0, 8).map((competitor: any, index: number) => {
                      const rank = index + 1;
                      const isYou = competitor.isYourCompany || 
                        competitor.company?.name?.toLowerCase() === latestAnalysis.analysisData.company?.name?.toLowerCase();
                      return (
                        <div key={rank} className="flex items-center text-sm">
                          <div className="flex-shrink-0 w-12 font-medium">{rank}</div>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-lg">
                              {isYou ? '⚫' : '🏢'}
                            </span>
                            <span className={isYou ? 'font-semibold' : ''}>
                              {competitor.company?.name || 'Unknown'}
                              {isYou && ' (You)'}
                            </span>
                          </div>
                          <div className="flex-shrink-0 w-24 text-right font-medium">
                            {competitor.shareOfVoice?.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Sources and Top Web Pages */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Sources */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Sources</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Button variant="default" size="sm" className="text-xs">
                      All Time
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Last Month
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Last Week
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex text-xs text-muted-foreground mb-2">
                      <div className="flex-shrink-0 w-12">Rank</div>
                      <div className="flex-1">Source</div>
                      <div className="flex-shrink-0 w-32 text-right">Total Mentions</div>
                    </div>
                    {(latestAnalysis.analysisData.citationAnalysis?.topSources || mockTopSources).slice(0, 5).map((source: any, index: number) => {
                      const rank = index + 1;
                      return (
                        <div key={rank} className="flex items-center text-sm">
                          <div className="flex-shrink-0 w-12 font-medium">{rank}</div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">📰</span>
                            <span className="truncate">
                              {source.domain || source.source || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex-shrink-0 w-32 text-right font-medium">
                            {source.count || source.mentions || 0}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Top Web Pages */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Web Pages</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Button variant="default" size="sm" className="text-xs">
                      All Time
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Last Month
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Last Week
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex text-xs text-muted-foreground mb-2">
                      <div className="flex-shrink-0 w-12">Rank</div>
                      <div className="flex-1">Web Page</div>
                      <div className="flex-shrink-0 w-32 text-right">Total Mentions</div>
                    </div>
                    {(latestAnalysis.analysisData.citationAnalysis?.topUrls || mockTopWebPages).slice(0, 5).map((page: any, index: number) => {
                      const rank = index + 1;
                      const pageUrl = page.url || page;
                      const mentions = page.count || page.mentions || 0;
                      return (
                        <div key={rank} className="flex items-center text-sm">
                          <div className="flex-shrink-0 w-12 font-medium">{rank}</div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">⚫</span>
                            <a 
                              href={typeof pageUrl === 'string' ? pageUrl : pageUrl.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline truncate text-primary"
                            >
                              {typeof pageUrl === 'string' ? pageUrl : pageUrl.url}
                            </a>
                          </div>
                          <div className="flex-shrink-0 w-32 text-right font-medium">
                            {mentions}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
