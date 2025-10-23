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
  Line,
  LineChart,
  Legend
} from 'recharts';

// Helper function to generate visibility chart data over time
const generateVisibilityChartData = (
  analyses: any[],
  yourBrandName: string,
  showCompetitor: boolean
) => {
  if (!analyses || analyses.length === 0) return [];

  // Get all analyses and calculate visibility for each
  const chartData = analyses
    .slice(0, 30) // Last 30 analyses
    .reverse() // Show oldest to newest
    .map((analysis) => {
      const analysisData = (analysis.analysisData || {}) as any;
      const promptResults = analysisData.promptResults || [];
      const brandNameLower = (analysisData.company?.name || analysis.companyName || yourBrandName).toLowerCase();
      
      // Get all results from prompt results
      const allResults = promptResults
        .filter((pr: any) => pr && pr.results && pr.results.length > 0)
        .flatMap((pr: any) => pr.results);
      
      // Calculate brand visibility
      const brandMentions = allResults.filter((r: any) => r.brandMentioned).length;
      const brandVisibility = allResults.length > 0 
        ? (brandMentions / allResults.length) * 100 
        : 0;
      
      // Calculate competitor visibility if needed
      let competitorVisibility = 0;
      if (showCompetitor) {
        const competitorsMap = new Map<string, number>();
        
        allResults.forEach((result: any) => {
          // Track from competitors field
          if (result.competitors) {
            result.competitors.forEach((comp: any) => {
              const compName = comp.name || comp;
              if (compName && compName.toLowerCase() !== brandNameLower) {
                competitorsMap.set(compName, (competitorsMap.get(compName) || 0) + 1);
              }
            });
          }
          
          // Also track from citations
          const citations = result.citations || [];
          citations.forEach((citation: any) => {
            if (citation.mentionedCompanies) {
              citation.mentionedCompanies.forEach((company: string) => {
                if (company && company.toLowerCase() !== brandNameLower) {
                  competitorsMap.set(company, (competitorsMap.get(company) || 0) + 1);
                }
              });
            }
          });
        });
        
        // Get top competitor visibility
        const topCompetitor = Array.from(competitorsMap.entries())
          .sort((a, b) => b[1] - a[1])[0];
        
        if (topCompetitor && allResults.length > 0) {
          competitorVisibility = (topCompetitor[1] / allResults.length) * 100;
        }
      }
      
      // Format date
      const date = new Date(analysis.createdAt || analysis.timestamp || Date.now());
      const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      return {
        date: formattedDate,
        fullDate: date,
        brandVisibility,
        competitorVisibility: showCompetitor ? competitorVisibility : undefined,
      };
    });
  
  return chartData;
};

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
    const latest = analyses[0];
    const analysisData = latest?.analysisData as any;
    console.log('[Dashboard] Latest Analysis Data:', {
      hasPromptResults: !!analysisData?.promptResults,
      promptResultsCount: analysisData?.promptResults?.length || 0,
      hasResponses: !!analysisData?.responses,
      responsesCount: analysisData?.responses?.length || 0,
      hasCompetitors: !!analysisData?.competitors,
      competitorsCount: analysisData?.competitors?.length || 0,
    });
    return latest;
  }, [analyses]);

  // Calculate comprehensive metrics from prompt results
  const dashboardMetrics = useMemo(() => {
    if (!latestAnalysis?.analysisData) return null;

    const analysisData = latestAnalysis.analysisData as any;
    const promptResults = analysisData.promptResults || [];
    const yourBrandName = (analysisData.company?.name || latestAnalysis.companyName || '').toLowerCase();

    // Get all results from prompt results
    const allResults = promptResults
      .filter((pr: any) => pr && pr.results && pr.results.length > 0)
      .flatMap((pr: any) => pr.results);

    console.log('[Dashboard] Total Results from Prompts:', allResults.length);

    if (allResults.length === 0) {
      return {
        visibilityScore: 0,
        shareOfVoice: 0,
        totalMentions: 0,
        totalResponses: 0,
        topSources: [],
        topUrls: [],
        competitors: [],
        allBrandsWithShare: [],
        brandRank: 0,
        totalMarketMentions: 0,
        promptResults: 0,
        promptsCount: 0,
        avgPosition: 0,
        avgSentiment: 0,
      };
    }

    // Calculate brand mentions from results
    const brandMentions = allResults.filter((r: any) => r.brandMentioned).length;
    const visibilityScore = (brandMentions / allResults.length) * 100;

    // Calculate average position
    const positions = allResults
      .filter((r: any) => r.brandPosition && r.brandPosition < 999)
      .map((r: any) => r.brandPosition!);
    const avgPosition = positions.length > 0 
      ? positions.reduce((a: number, b: number) => a + b, 0) / positions.length 
      : 0;

    // Calculate average sentiment
    const sentiments = allResults.filter((r: any) => r.sentimentScore !== undefined);
    const avgSentiment = sentiments.length > 0
      ? sentiments.reduce((sum: number, r: any) => sum + r.sentimentScore!, 0) / sentiments.length
      : 0;

    // Track sources and URLs from citations
    const sourcesMap = new Map<string, number>();
    const urlsMap = new Map<string, number>();
    const competitorsMap = new Map<string, { name: string; mentions: number; }>();

    allResults.forEach((result: any) => {
      const citations = result.citations || [];
      
      citations.forEach((citation: any) => {
        const url = citation.url;
        
        // Skip Google's internal proxy URLs
        if (url && url.includes('vertexaisearch.cloud.google.com')) {
          return;
        }
        
        let domain = citation.domain || citation.source;
        if (!domain && url) {
          try {
            domain = new URL(url).hostname;
          } catch (e) {
            // ignore
          }
        }
        
        // Skip if domain is the Google proxy
        if (domain && domain.includes('vertexaisearch.cloud.google.com')) {
          return;
        }
        
        if (domain) {
          sourcesMap.set(domain, (sourcesMap.get(domain) || 0) + 1);
        }
        if (url) {
          urlsMap.set(url, (urlsMap.get(url) || 0) + 1);
        }

        // Track mentioned companies as competitors
        if (citation.mentionedCompanies) {
          citation.mentionedCompanies.forEach((company: string) => {
            if (company && company.toLowerCase() !== yourBrandName) {
              const existing = competitorsMap.get(company) || { name: company, mentions: 0 };
              existing.mentions++;
              competitorsMap.set(company, existing);
            }
          });
        }
      });

      // Also track competitors from result.competitors field
      if (result.competitors) {
        result.competitors.forEach((comp: any) => {
          const compName = comp.name || comp;
          if (compName && compName.toLowerCase() !== yourBrandName) {
            const existing = competitorsMap.get(compName) || { name: compName, mentions: 0 };
            existing.mentions++;
            competitorsMap.set(compName, existing);
          }
        });
      }
    });

    // Create top sources list
    const topSources = Array.from(sourcesMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);

    // Create top URLs list
    const topUrls = Array.from(urlsMap.entries())
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count);

    // Create competitors list with visibility scores
    const competitors = Array.from(competitorsMap.values())
      .map(c => ({
        ...c,
        visibilityScore: allResults.length > 0 ? (c.mentions / allResults.length) * 100 : 0,
      }))
      .sort((a, b) => b.mentions - a.mentions);

    // Calculate total market mentions (including brand)
    const totalCompetitorMentions = competitors.reduce((sum, c) => sum + c.mentions, 0);
    const totalMarketMentions = brandMentions + totalCompetitorMentions;
    
    // Calculate share of voice (market share)
    const shareOfVoice = totalMarketMentions > 0
      ? (brandMentions / totalMarketMentions) * 100
      : 0;
    
    // Add market share to competitors and include the brand itself for ranking
    const allBrandsWithShare = [
      {
        name: analysisData.company?.name || latestAnalysis.companyName || 'Your Brand',
        mentions: brandMentions,
        marketShare: shareOfVoice,
        isYourBrand: true,
      },
      ...competitors.map(c => ({
        name: c.name,
        mentions: c.mentions,
        marketShare: totalMarketMentions > 0 ? (c.mentions / totalMarketMentions) * 100 : 0,
        isYourBrand: false,
      }))
    ].sort((a, b) => b.mentions - a.mentions); // Sort by mentions descending
    
    // Find actual rank of the brand
    const brandRank = allBrandsWithShare.findIndex(b => b.isYourBrand) + 1;

    // Count total prompts from topics
    const topics = analysisData.topics || [];
    const totalPrompts = topics.reduce((sum: number, t: any) => sum + (t.prompts?.length || 0), 0);

    const metrics = {
      visibilityScore,
      shareOfVoice,
      totalMentions: brandMentions,
      totalResponses: allResults.length,
      topSources,
      topUrls,
      competitors,
      allBrandsWithShare,
      brandRank,
      totalMarketMentions,
      promptResults: promptResults.length,
      promptsCount: totalPrompts,
      avgPosition,
      avgSentiment,
    };

    console.log('[Dashboard] Calculated Metrics:', metrics);
    return metrics;
  }, [latestAnalysis]);

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
        {!loading && !error && latestAnalysis && dashboardMetrics && (
          <>
            {/* Metric Cards - Row 1 */}
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
                    {dashboardMetrics.visibilityScore.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dashboardMetrics.totalMentions} mentions in {dashboardMetrics.totalResponses} responses
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
                  {dashboardMetrics.topSources[0] ? (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <span className="text-lg">📰</span>
                        </div>
                        <div className="font-semibold truncate">{dashboardMetrics.topSources[0].domain}</div>
                      </div>
                      <p className="text-sm text-muted-foreground">{dashboardMetrics.topSources[0].count} citations</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No sources found</p>
                  )}
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
                  {dashboardMetrics.competitors[0] ? (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <span className="text-lg">🏢</span>
                        </div>
                        <div className="font-semibold">{dashboardMetrics.competitors[0].name}</div>
                      </div>
                      <p className="text-sm text-muted-foreground">{dashboardMetrics.competitors[0].mentions} mentions</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No competitors found</p>
                  )}
                </CardContent>
              </Card>

              {/* Brand Ranking */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Market Ranking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">#{dashboardMetrics.brandRank}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Out of {dashboardMetrics.allBrandsWithShare.length} brands
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Additional Metric Cards - Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Share of Voice */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Market Share
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {dashboardMetrics.shareOfVoice.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dashboardMetrics.totalMentions} of {dashboardMetrics.totalMarketMentions} total mentions
                  </p>
                </CardContent>
              </Card>

              {/* Total Competitors */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Competitors Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{dashboardMetrics.competitors.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mentioned in responses
                  </p>
                </CardContent>
              </Card>

              {/* Total Sources */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Unique Sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{dashboardMetrics.topSources.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Citation domains
                  </p>
                </CardContent>
              </Card>

              {/* Prompts Executed */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Prompts Executed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{dashboardMetrics.promptResults}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Out of {dashboardMetrics.promptsCount} total
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Brand Visibility Chart and Competitor Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Brand Visibility Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Brand Visibility Comparison</CardTitle>
                    <div className="flex items-center gap-3">
                      <label htmlFor="competitor-toggle" className="text-sm text-muted-foreground cursor-pointer">
                        Show top competitor
                      </label>
                      <Switch
                        id="competitor-toggle"
                        checked={showCompetitorVisibility}
                        onCheckedChange={setShowCompetitorVisibility}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Percentage of AI responses mentioning each brand
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={generateVisibilityChartData(
                          analyses || [],
                          latestAnalysis.companyName || (latestAnalysis.analysisData as any)?.company?.name || 'Your Brand',
                          showCompetitorVisibility
                        )}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          label={{ value: 'Date', position: 'insideBottom', offset: -10 }}
                        />
                        <YAxis 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          domain={[0, 100]}
                          ticks={[0, 20, 40, 60, 80, 100]}
                          label={{ value: 'Daily Visibility (%)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            `${value.toFixed(1)}%`,
                            name === 'brandVisibility' ? 'Your Brand' : 'Top Competitor'
                          ]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="brandVisibility"
                          name="Your Brand"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          dot={{ fill: 'hsl(var(--primary))', r: 5 }}
                          activeDot={{ r: 7 }}
                        />
                        {showCompetitorVisibility && (
                          <Line
                            type="monotone"
                            dataKey="competitorVisibility"
                            name="Top Competitor"
                            stroke="hsl(var(--destructive))"
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={{ fill: 'hsl(var(--destructive))', r: 5 }}
                            activeDot={{ r: 7 }}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-6 mt-4 justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-sm text-muted-foreground">
                        Your Brand ({dashboardMetrics.visibilityScore.toFixed(1)}%)
                      </span>
                    </div>
                    {showCompetitorVisibility && dashboardMetrics.competitors[0] && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                        <span className="text-sm text-muted-foreground">
                          {dashboardMetrics.competitors[0].name} ({(dashboardMetrics.competitors[0].visibilityScore || 0).toFixed(1)}%)
                        </span>
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
                      <div className="flex-1">Brand</div>
                      <div className="flex-shrink-0 w-24 text-right">Mentions</div>
                      <div className="flex-shrink-0 w-20 text-right">Share</div>
                    </div>
                    {/* Show All Brands Sorted by Rank */}
                    {dashboardMetrics.allBrandsWithShare.slice(0, 8).map((brand: any, index: number) => {
                      const rank = index + 1;
                      const isYourBrand = brand.isYourBrand;
                      
                      return (
                        <div 
                          key={brand.name} 
                          className={`flex items-center text-sm ${isYourBrand ? 'bg-primary/10 rounded px-2 py-2' : ''}`}
                        >
                          <div className="flex-shrink-0 w-12 font-medium">{rank}</div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">{isYourBrand ? '⚫' : '🏢'}</span>
                            <span className={`truncate ${isYourBrand ? 'font-semibold' : ''}`}>
                              {brand.name} {isYourBrand ? '(You)' : ''}
                            </span>
                          </div>
                          <div className="flex-shrink-0 w-24 text-right font-medium">
                            {brand.mentions}
                          </div>
                          <div className="flex-shrink-0 w-20 text-right">
                            <span className="text-xs text-muted-foreground">
                              {brand.marketShare.toFixed(1)}%
                            </span>
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
                      <div className="flex-shrink-0 w-32 text-right">Citations</div>
                    </div>
                    {dashboardMetrics.topSources.slice(0, 5).map((source: any, index: number) => {
                      const rank = index + 1;
                      return (
                        <div key={rank} className="flex items-center text-sm">
                          <div className="flex-shrink-0 w-12 font-medium">{rank}</div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">📰</span>
                            <span className="truncate">{source.domain}</span>
                          </div>
                          <div className="flex-shrink-0 w-32 text-right font-medium">
                            {source.count}
                          </div>
                        </div>
                      );
                    })}
                    {dashboardMetrics.topSources.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No sources found yet
                      </div>
                    )}
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
                      <div className="flex-shrink-0 w-32 text-right">Citations</div>
                    </div>
                    {dashboardMetrics.topUrls.slice(0, 5).map((page: any, index: number) => {
                      const rank = index + 1;
                      return (
                        <div key={rank} className="flex items-center text-sm">
                          <div className="flex-shrink-0 w-12 font-medium">{rank}</div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">⚫</span>
                            <a 
                              href={page.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline truncate text-primary"
                            >
                              {page.url}
                            </a>
                          </div>
                          <div className="flex-shrink-0 w-32 text-right font-medium">
                            {page.count}
                          </div>
                        </div>
                      );
                    })}
                    {dashboardMetrics.topUrls.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No URLs found yet
                      </div>
                    )}
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
