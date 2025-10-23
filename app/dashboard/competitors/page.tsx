'use client';

import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Trophy, Target, Users, Award } from 'lucide-react';
import { useBrandAnalyses } from '@/hooks/useBrandAnalyses';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

// Maximum valid position number; positions >= this are considered invalid/placeholder
const MAX_VALID_POSITION = 999;

// Helper function: Calculate provider-specific metrics from results
function calculateProviderMetrics(
  results: any[],
  yourBrandName: string,
  identifiedCompetitors: any[]
) {
  const providerMap: Record<string, any> = {};
  const allCompetitors = new Map<string, any>();
  
  // Initialize with identified competitors
  identifiedCompetitors.forEach((comp: any) => {
    const compName = comp.name || comp;
    allCompetitors.set(compName, {
      name: compName,
      mentions: 0,
      positions: [],
      sentimentScores: [],
      results: [],
      url: comp.url,
      type: comp.type || 'direct',
    });
  });
  
  // Process results by provider
  results.forEach((result: any) => {
    const provider = result.provider?.toLowerCase() || 'unknown';
    
    if (!providerMap[provider]) {
      providerMap[provider] = {
        competitors: new Map(),
        totalResponses: 0,
        brandMentions: 0,
      };
    }
    
    providerMap[provider].totalResponses++;
    
    // Check for brand mentions
    if (result.brandMentioned) {
      providerMap[provider].brandMentions++;
    }
    
    // Track competitors from result
    if (result.competitors) {
      result.competitors.forEach((comp: any) => {
        const compName = comp.name;
        if (compName && compName.toLowerCase() !== yourBrandName) {
          // Provider-specific tracking
          const providerComp = providerMap[provider].competitors.get(compName) || {
            name: compName,
            mentions: 0,
            positions: [],
            sentimentScores: [],
          };
          providerComp.mentions++;
          if (comp.position && comp.position < MAX_VALID_POSITION) {
            providerComp.positions.push(comp.position);
          }
          if (comp.sentimentScore !== undefined) {
            providerComp.sentimentScores.push(comp.sentimentScore);
          }
          providerMap[provider].competitors.set(compName, providerComp);
          
          // Overall tracking
          const overallComp = allCompetitors.get(compName) || {
            name: compName,
            mentions: 0,
            positions: [],
            sentimentScores: [],
            results: [],
          };
          overallComp.mentions++;
          if (comp.position && comp.position < MAX_VALID_POSITION) {
            overallComp.positions.push(comp.position);
          }
          if (comp.sentimentScore !== undefined) {
            overallComp.sentimentScores.push(comp.sentimentScore);
          }
          overallComp.results.push({
            provider,
            position: comp.position,
            sentiment: comp.sentimentScore,
          });
          allCompetitors.set(compName, overallComp);
        }
      });
    }
  });

  // Calculate metrics for each provider
  Object.keys(providerMap).forEach((provider) => {
    const data = providerMap[provider];
    const totalMentions = data.brandMentions + Array.from(data.competitors.values())
      .reduce((sum: number, c: any) => sum + c.mentions, 0);
    
    data.competitorsList = Array.from(data.competitors.values())
      .map((comp: any) => ({
        ...comp,
        averagePosition: comp.positions.length > 0
          ? comp.positions.reduce((a: number, b: number) => a + b, 0) / comp.positions.length
          : 0,
        averageSentiment: comp.sentimentScores.length > 0
          ? comp.sentimentScores.reduce((a: number, b: number) => a + b, 0) / comp.sentimentScores.length
          : 0,
        visibilityScore: data.totalResponses > 0
          ? (comp.mentions / data.totalResponses) * 100
          : 0,
        shareOfVoice: totalMentions > 0
          ? (comp.mentions / totalMentions) * 100
          : 0,
      }))
      .sort((a, b) => b.mentions - a.mentions);
  });

  return { providerMap, allCompetitors };
}

// Helper function: Calculate overall metrics from results
function calculateOverallMetrics(
  results: any[],
  allCompetitors: Map<string, any>,
  yourBrandName: string
) {
  // Count brand mentions from results
  const brandMentions = results.filter((r: any) => r.brandMentioned).length;

  // Calculate overall metrics
  const totalResponseCount = results.length;
  const competitorMentions = Array.from(allCompetitors.values())
    .reduce((sum: number, c: any) => sum + c.mentions, 0);
  const totalMarketMentions = brandMentions + competitorMentions;
  
  const competitorsList = Array.from(allCompetitors.values())
    .filter((comp: any) => comp.mentions > 0) // Only show competitors with mentions
    .map((comp: any) => ({
      ...comp,
      averagePosition: comp.positions.length > 0
        ? comp.positions.reduce((a: number, b: number) => a + b, 0) / comp.positions.length
        : 0,
      averageSentiment: comp.sentimentScores.length > 0
        ? comp.sentimentScores.reduce((a: number, b: number) => a + b, 0) / comp.sentimentScores.length
        : 0,
      visibilityScore: totalResponseCount > 0
        ? (comp.mentions / totalResponseCount) * 100
        : 0,
      marketShare: totalMarketMentions > 0
        ? (comp.mentions / totalMarketMentions) * 100
        : 0,
    }))
    .sort((a, b) => b.mentions - a.mentions);
  
  // Calculate brand's market share
  const brandMarketShare = totalMarketMentions > 0
    ? (brandMentions / totalMarketMentions) * 100
    : 0;

  return {
    competitorsList,
    totalMarketMentions,
    brandMentions,
    brandMarketShare,
  };
}

export default function CompetitorsPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'mentions' | 'visibility' | 'sentiment'>('mentions');
  
  const { data: analyses, isLoading: analysesLoading, error: analysesError } = useBrandAnalyses();

  // Get the most recent analysis
  const latestAnalysis = useMemo(() => {
    if (!analyses || analyses.length === 0) return null;
    return analyses[0];
  }, [analyses]);

  // Get data from prompt results
  const normalizedData = useMemo(() => {
    if (!latestAnalysis?.analysisData) return null;

    const analysisData = latestAnalysis.analysisData as any;
    const promptResults = analysisData.promptResults || [];
    const yourBrandName = (analysisData.company?.name || '').toLowerCase();
    const identifiedCompetitors = (latestAnalysis as any).identifiedCompetitors || latestAnalysis.competitors || [];
    
    // Get all results from prompt results
    const allResults = promptResults
      .filter((pr: any) => pr && pr.results && pr.results.length > 0)
      .flatMap((pr: any) => pr.results);

    return {
      results: allResults,
      yourBrandName,
      identifiedCompetitors,
    };
  }, [latestAnalysis]);

  // Calculate competitor metrics by provider
  const competitorMetrics = useMemo(() => {
    if (!normalizedData) return null;

    const { results, yourBrandName, identifiedCompetitors } = normalizedData;

    // Calculate provider-specific metrics
    const { providerMap, allCompetitors } = calculateProviderMetrics(
      results,
      yourBrandName,
      identifiedCompetitors
    );

    // Calculate overall metrics
    const {
      competitorsList,
      totalMarketMentions,
      brandMentions,
      brandMarketShare,
    } = calculateOverallMetrics(results, allCompetitors, yourBrandName);

    return {
      byProvider: providerMap,
      allCompetitors: competitorsList,
      totalCompetitors: competitorsList.length,
      identifiedCompetitors: identifiedCompetitors.length,
      totalMarketMentions,
      brandMentions,
      brandMarketShare,
      yourBrandName,
    };
  }, [normalizedData]);

  // Get current view data
  const currentData = useMemo(() => {
    if (!competitorMetrics) return null;
    
    let competitors;
    if (selectedProvider === 'all') {
      competitors = competitorMetrics.allCompetitors;
    } else {
      const providerData = competitorMetrics.byProvider[selectedProvider];
      competitors = providerData?.competitorsList || [];
    }
    
    // Sort competitors
    const sorted = [...competitors].sort((a, b) => {
      if (sortBy === 'mentions') return b.mentions - a.mentions;
      if (sortBy === 'visibility') return b.visibilityScore - a.visibilityScore;
      if (sortBy === 'sentiment') return b.averageSentiment - a.averageSentiment;
      return 0;
    });
    
    return sorted;
  }, [competitorMetrics, selectedProvider, sortBy]);

  // Redirect if not authenticated
  React.useEffect(() => {
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

  const loading = analysesLoading;
  const error = analysesError?.message || null;

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Competitors' }]}>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Competitor Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Track and compare your competitors' AI visibility
            </p>
          </div>
          {competitorMetrics && (
            <div className="flex items-center gap-4">
              <div className="text-sm text-right">
                <span className="text-muted-foreground">Tracked:</span>{' '}
                <span className="font-semibold">{competitorMetrics.totalCompetitors}</span>
              </div>
              <div className="text-sm text-right">
                <span className="text-muted-foreground">Total Market Mentions:</span>{' '}
                <span className="font-semibold">{competitorMetrics.totalMarketMentions}</span>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🌐 All Providers</SelectItem>
                <SelectItem value="chatgpt">🤖 ChatGPT</SelectItem>
                <SelectItem value="claude">🧠 Claude</SelectItem>
                <SelectItem value="gemini">✨ Gemini</SelectItem>
                <SelectItem value="perplexity">🔍 Perplexity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mentions">Sort by Mentions</SelectItem>
                <SelectItem value="visibility">Sort by Visibility</SelectItem>
                <SelectItem value="sentiment">Sort by Sentiment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {currentData && (
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{currentData.length}</span> competitors
              {selectedProvider !== 'all' && (
                <span> on <span className="font-semibold text-foreground capitalize">{selectedProvider}</span></span>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading competitor data...</p>
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
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No competitor data available. Run your first brand analysis to see competitors.
                </p>
                <Button onClick={() => router.push('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Competitor Data */}
        {!loading && !error && competitorMetrics && currentData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Competitors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{competitorMetrics.totalCompetitors}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {competitorMetrics.identifiedCompetitors} identified initially
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Your Market Share
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{competitorMetrics.brandMarketShare.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {competitorMetrics.brandMentions} of {competitorMetrics.totalMarketMentions} mentions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Top Competitor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentData[0] ? (
                    <>
                      <div className="text-lg font-bold truncate">{currentData[0].name}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {currentData[0].mentions} mentions
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No data</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Visibility
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {currentData.length > 0
                      ? (currentData.reduce((sum, c) => sum + c.visibilityScore, 0) / currentData.length).toFixed(1)
                      : '0.0'
                    }%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average competitor visibility
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Competitors Table */}
            <Card>
              <CardHeader>
                <CardTitle>Competitor Rankings</CardTitle>
                <CardDescription>
                  Detailed breakdown of competitor performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground pb-2 border-b">
                    <div className="col-span-1">Rank</div>
                    <div className="col-span-3">Competitor</div>
                    <div className="col-span-2 text-center">Mentions</div>
                    <div className="col-span-2 text-center">Market Share</div>
                    <div className="col-span-2 text-center">Avg Position</div>
                    <div className="col-span-2 text-center">Sentiment</div>
                  </div>
                  {currentData.map((competitor: any, index: number) => {
                    const rank = index + 1;
                    const getRankIcon = (rank: number) => {
                      if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
                      if (rank === 2) return <Award className="h-5 w-5 text-gray-400" />;
                      if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
                      return null;
                    };

                    const getSentimentColor = (score: number) => {
                      if (score >= 70) return 'text-green-600 bg-green-50';
                      if (score >= 40) return 'text-yellow-600 bg-yellow-50';
                      return 'text-red-600 bg-red-50';
                    };

                    return (
                      <div
                        key={competitor.name}
                        className="grid grid-cols-12 gap-4 items-center py-4 hover:bg-muted/50 rounded-lg px-2 transition-colors border-b last:border-0"
                      >
                        <div className="col-span-1 flex items-center gap-2">
                          <span className="text-sm font-medium">{rank}</span>
                          {getRankIcon(rank)}
                        </div>
                        <div className="col-span-3">
                          <div className="font-medium text-sm">{competitor.name}</div>
                          {competitor.type && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {competitor.type}
                            </Badge>
                          )}
                          {competitor.url && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {competitor.url}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 text-center">
                          <div className="text-sm font-bold">{competitor.mentions}</div>
                          <div className="text-xs text-muted-foreground">
                            {competitor.visibilityScore.toFixed(1)}% visible
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <div className="text-sm font-bold">
                            {competitor.marketShare.toFixed(1)}%
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          {competitor.averagePosition > 0 ? (
                            <Badge variant="secondary">
                              #{Math.round(competitor.averagePosition)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </div>
                        <div className="col-span-2 text-center">
                          {competitor.averageSentiment > 0 ? (
                            <Badge className={getSentimentColor(competitor.averageSentiment)}>
                              {competitor.averageSentiment.toFixed(0)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {currentData.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No competitors found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Detailed Competitor Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {currentData.slice(0, 6).map((competitor: any, index: number) => (
                <Card key={competitor.name}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{competitor.name}</CardTitle>
                      <Badge variant="secondary">#{index + 1}</Badge>
                    </div>
                    <CardDescription>
                      {competitor.type && <span className="capitalize">{competitor.type} competitor</span>}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Mentions</p>
                        <p className="text-2xl font-bold">{competitor.mentions}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Market Share</p>
                        <p className="text-2xl font-bold">{competitor.marketShare.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Visibility</p>
                        <p className="text-2xl font-bold">{competitor.visibilityScore.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sentiment</p>
                        <p className="text-2xl font-bold">
                          {competitor.averageSentiment > 0 ? competitor.averageSentiment.toFixed(0) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {competitor.marketShare > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Market Share</span>
                          <span className="font-semibold">{competitor.marketShare.toFixed(1)}%</span>
                        </div>
                        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(competitor.marketShare, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Provider Breakdown */}
            {selectedProvider === 'all' && (
              <Card>
                <CardHeader>
                  <CardTitle>Competitor Mentions by Provider</CardTitle>
                  <CardDescription>
                    How each AI model references your competitors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(competitorMetrics.byProvider).map(([provider, data]: [string, any]) => (
                      <div key={provider} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">
                            {provider === 'chatgpt' && '🤖'}
                            {provider === 'claude' && '🧠'}
                            {provider === 'gemini' && '✨'}
                            {provider === 'perplexity' && '🔍'}
                            {!['chatgpt', 'claude', 'gemini', 'perplexity'].includes(provider) && '🔧'}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{provider}</p>
                            <p className="text-sm text-muted-foreground">
                              {data.competitorsList.length} competitors tracked
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {data.competitorsList.reduce((sum: number, c: any) => sum + c.mentions, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">total mentions</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
