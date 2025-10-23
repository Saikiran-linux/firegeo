'use client';

import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, FileText, TrendingUp, Globe, Target, Award, BarChart3 } from 'lucide-react';
import { useBrandAnalyses } from '@/hooks/useBrandAnalyses';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { calculateBrandVsCompetitorMetrics } from '@/lib/citation-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Helper to get provider icon and color
const getProviderIcon = (provider: string) => {
  const providerLower = provider.toLowerCase();
  switch (providerLower) {
    case 'chatgpt':
      return { icon: '🤖', color: 'bg-green-500/10 text-green-700 dark:text-green-400', name: 'ChatGPT' };
    case 'claude':
      return { icon: '🧠', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400', name: 'Claude' };
    case 'gemini':
      return { icon: '✨', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', name: 'Gemini' };
    case 'perplexity':
      return { icon: '🔍', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', name: 'Perplexity' };
    default:
      return { icon: '🔧', color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400', name: provider };
  }
};

export default function SourcesPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'domains' | 'urls'>('domains');
  
  const { data: analyses, isLoading: analysesLoading, error: analysesError } = useBrandAnalyses();

  // Get the most recent analysis
  const latestAnalysis = useMemo(() => {
    if (!analyses || analyses.length === 0) return null;
    return analyses[0];
  }, [analyses]);

  // Calculate competitive metrics from prompt results
  const competitiveMetrics = useMemo(() => {
    if (!latestAnalysis?.analysisData) return null;
    
    const analysisData = latestAnalysis.analysisData as any;
    const brandName = analysisData.company?.name || latestAnalysis.companyName || '';
    const competitors = analysisData.competitors || [];
    const promptResults = analysisData.promptResults || [];
    
    // Get all results from prompt results
    const allResults = promptResults
      .filter((pr: any) => pr && pr.results && pr.results.length > 0)
      .flatMap((pr: any) => pr.results);
    
    if (allResults.length === 0 || !brandName || competitors.length === 0) {
      return null;
    }

    return calculateBrandVsCompetitorMetrics(allResults, brandName, competitors);
  }, [latestAnalysis]);

  // Calculate source metrics by provider from prompt results
  const sourceMetrics = useMemo(() => {
    if (!latestAnalysis?.analysisData) return null;

    const analysisData = latestAnalysis.analysisData as any;
    const promptResults = analysisData.promptResults || [];
    const citationAnalysis = analysisData.citationAnalysis || {};
    
    // Get all results from prompt results
    const allResults = promptResults
      .filter((pr: any) => pr && pr.results && pr.results.length > 0)
      .flatMap((pr: any) => pr.results);
    
    const providerMap: Record<string, any> = {};
    const allSources = new Map<string, number>();
    const allUrls = new Map<string, number>();
    // Track which providers cite each domain
    const domainProviders = new Map<string, Set<string>>();
    const urlProviders = new Map<string, Set<string>>();
    
    // Group by provider
    allResults.forEach((result: any) => {
      const provider = result.provider?.toLowerCase() || 'unknown';
      
      if (!providerMap[provider]) {
        providerMap[provider] = {
          sources: new Map(),
          urls: new Map(),
          citationCount: 0,
        };
      }
      
      // Track citations
      if (result.citations) {
        providerMap[provider].citationCount += result.citations.length;
        
        result.citations.forEach((citation: any) => {
          const url = citation.url;
          
          // Skip Google's internal proxy URLs
          if (url && url.includes('vertexaisearch.cloud.google.com')) {
            return;
          }
          
          let domain = citation.domain || citation.source;
          
          // Extract domain from URL if not provided
          if (!domain && url) {
            try {
              domain = new URL(url).hostname;
            } catch (e) {
              domain = null;
            }
          }
          
          // Skip if domain is the Google proxy
          if (domain && domain.includes('vertexaisearch.cloud.google.com')) {
            return;
          }
          
          if (domain) {
            // Provider-specific tracking
            const current = providerMap[provider].sources.get(domain) || { domain, count: 0, citations: [] };
            current.count++;
            current.citations.push(citation);
            providerMap[provider].sources.set(domain, current);
            
            // All sources tracking
            allSources.set(domain, (allSources.get(domain) || 0) + 1);
            
            // Track which providers cite this domain
            if (!domainProviders.has(domain)) {
              domainProviders.set(domain, new Set());
            }
            domainProviders.get(domain)!.add(provider);
          }
          
          if (url) {
            // Provider-specific URL tracking
            const currentUrl = providerMap[provider].urls.get(url) || { url, count: 0, title: citation.title || null };
            currentUrl.count++;
            providerMap[provider].urls.set(url, currentUrl);
            
            // All URLs tracking
            allUrls.set(url, (allUrls.get(url) || 0) + 1);
            
            // Track which providers cite this URL
            if (!urlProviders.has(url)) {
              urlProviders.set(url, new Set());
            }
            urlProviders.get(url)!.add(provider);
          }
        });
      }
    });

    // Convert maps to sorted arrays
    Object.keys(providerMap).forEach((provider) => {
      const data = providerMap[provider];
      data.sourcesList = Array.from(data.sources.values())
        .sort((a: any, b: any) => b.count - a.count);
      data.urlsList = Array.from(data.urls.values())
        .sort((a: any, b: any) => b.count - a.count);
    });

    return {
      byProvider: providerMap,
      allSources: Array.from(allSources.entries())
        .map(([domain, count]) => ({ 
          domain, 
          count,
          providers: Array.from(domainProviders.get(domain) || [])
        }))
        .sort((a, b) => b.count - a.count),
      allUrls: Array.from(allUrls.entries())
        .map(([url, count]) => ({ 
          url, 
          count,
          providers: Array.from(urlProviders.get(url) || [])
        }))
        .sort((a, b) => b.count - a.count),
      totalSources: allSources.size,
      totalUrls: allUrls.size,
      totalCitations: allResults.reduce((sum: number, r: any) => sum + (r.citations?.length || 0), 0),
      citationAnalysis,
      domainProviders,
      urlProviders,
    };
  }, [latestAnalysis]);

  // Get current view data
  const currentData = useMemo(() => {
    if (!sourceMetrics) return null;
    
    if (selectedProvider === 'all') {
      return {
        sources: sourceMetrics.allSources,
        urls: sourceMetrics.allUrls,
        citationCount: sourceMetrics.totalCitations,
      };
    } else {
      const providerData = sourceMetrics.byProvider[selectedProvider];
      return providerData ? {
        sources: providerData.sourcesList,
        urls: providerData.urlsList,
        citationCount: providerData.citationCount,
      } : null;
    }
  }, [sourceMetrics, selectedProvider]);

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
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sources' }]}>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sources & Citations</h1>
            <p className="text-muted-foreground mt-1">
              Analyze where AI models find information about your brand
            </p>
          </div>
          {sourceMetrics && (
            <div className="flex items-center gap-4">
              <div className="text-sm text-right">
                <span className="text-muted-foreground">Total Sources:</span>{' '}
                <span className="font-semibold">{sourceMetrics.totalSources}</span>
              </div>
              <div className="text-sm text-right">
                <span className="text-muted-foreground">Total Citations:</span>{' '}
                <span className="font-semibold">{sourceMetrics.totalCitations}</span>
              </div>
            </div>
          )}
        </div>

        {/* Provider Filter */}
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
          {currentData && (
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{currentData.citationCount}</span> citations
              {selectedProvider !== 'all' && (
                <span> from <span className="font-semibold text-foreground capitalize">{selectedProvider}</span></span>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading source data...</p>
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
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No source data available. Run your first brand analysis to see sources.
                </p>
                <Button onClick={() => router.push('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Source Data */}
        {!loading && !error && sourceMetrics && currentData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Unique Domains
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentData.sources.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sources citing your brand
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Unique URLs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentData.urls.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Individual pages referenced
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Citations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentData.citationCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    References found
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Citation Analysis Summary */}
            {sourceMetrics.citationAnalysis && Object.keys(sourceMetrics.citationAnalysis).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Citation Analysis</CardTitle>
                  <CardDescription>Detailed breakdown of source citations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {sourceMetrics.citationAnalysis.totalSources !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">Total Sources</p>
                        <p className="text-2xl font-bold">{sourceMetrics.citationAnalysis.totalSources}</p>
                      </div>
                    )}
                    {sourceMetrics.citationAnalysis.totalUrls !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">Total URLs</p>
                        <p className="text-2xl font-bold">{sourceMetrics.citationAnalysis.totalUrls}</p>
                      </div>
                    )}
                    {sourceMetrics.citationAnalysis.averageCitationsPerResponse !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Citations/Response</p>
                        <p className="text-2xl font-bold">
                          {sourceMetrics.citationAnalysis.averageCitationsPerResponse.toFixed(1)}
                        </p>
                      </div>
                    )}
                    {sourceMetrics.citationAnalysis.totalCitations !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">Total Citations</p>
                        <p className="text-2xl font-bold">{sourceMetrics.citationAnalysis.totalCitations}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Brand vs Competitor Citation Analysis */}
            {competitiveMetrics && (
              <>
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Brand vs Competitor Citations
                    </CardTitle>
                    <CardDescription>
                      How your brand compares to competitors in AI-generated citations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Share of Voice */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Award className="h-4 w-4" />
                          Share of Voice
                        </h3>
                        <div className="space-y-2">
                          {/* Brand */}
                          <div className="flex items-center gap-2">
                            <div className="w-32 text-sm font-medium truncate">
                              {competitiveMetrics.brandName}
                            </div>
                            <div className="flex-1 relative h-8 bg-muted rounded-md overflow-hidden">
                              <div
                                className="absolute left-0 top-0 h-full bg-primary transition-all duration-500"
                                style={{ width: `${competitiveMetrics.shareOfVoice.brand}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-medium text-foreground mix-blend-difference">
                                  {competitiveMetrics.shareOfVoice.brand.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="w-16 text-right">
                              <Badge variant="default" className="text-xs">
                                {competitiveMetrics.brandCitations.count}
                              </Badge>
                            </div>
                          </div>

                          {/* Competitors */}
                          {Object.entries(competitiveMetrics.shareOfVoice.competitors).map(([competitor, sov]) => {
                            const compData = competitiveMetrics.competitorCitations[competitor];
                            return (
                              <div key={competitor} className="flex items-center gap-2">
                                <div className="w-32 text-sm text-muted-foreground truncate">
                                  {competitor}
                                </div>
                                <div className="flex-1 relative h-8 bg-muted rounded-md overflow-hidden">
                                  <div
                                    className="absolute left-0 top-0 h-full bg-orange-500/70 transition-all duration-500"
                                    style={{ width: `${sov}%` }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-medium text-foreground mix-blend-difference">
                                      {sov.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-16 text-right">
                                  <Badge variant="secondary" className="text-xs">
                                    {compData?.count || 0}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Citation Gap */}
                      {competitiveMetrics.citationGap.leadingCompetitor && (
                        <div className="p-4 bg-muted/50 rounded-lg border border-muted">
                          <div className="flex items-start gap-3">
                            <BarChart3 className="h-5 w-5 text-orange-500 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">Citation Gap Analysis</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                <span className="font-semibold">{competitiveMetrics.citationGap.leadingCompetitor}</span>
                                {' '}leads by{' '}
                                <span className="font-semibold">{Math.abs(competitiveMetrics.citationGap.gap)}</span>
                                {' '}citations
                                {' '}({competitiveMetrics.citationGap.gapPercentage.toFixed(1)}% more)
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Detailed Metrics Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Brand Card */}
                        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                          <p className="text-sm font-semibold mb-3">{competitiveMetrics.brandName}</p>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Citations</span>
                              <span className="font-medium">{competitiveMetrics.brandCitations.count}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Unique Sources</span>
                              <span className="font-medium">{competitiveMetrics.brandCitations.uniqueSources}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Avg Position</span>
                              <span className="font-medium">{competitiveMetrics.brandCitations.averagePosition !== null ? competitiveMetrics.brandCitations.averagePosition.toFixed(1) : 'N/A'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Top Competitor */}
                        {competitiveMetrics.citationGap.leadingCompetitor && (
                          <div className="p-4 bg-muted/30 rounded-lg border border-muted">
                            <div className="text-sm font-semibold mb-3">
                              {competitiveMetrics.citationGap.leadingCompetitor}
                              <Badge variant="secondary" className="ml-2 text-xs">Leading</Badge>
                            </div>
                            <div className="space-y-2 text-xs">
                              {(() => {
                                const topComp = competitiveMetrics.competitorCitations[competitiveMetrics.citationGap.leadingCompetitor];
                                return topComp ? (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Citations</span>
                                      <span className="font-medium">{topComp.count}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Unique Sources</span>
                                      <span className="font-medium">{topComp.uniqueSources}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Avg Position</span>
                                      <span className="font-medium">{topComp.averagePosition !== null ? topComp.averagePosition.toFixed(1) : 'N/A'}</span>
                                    </div>
                                  </>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Sources Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Citation Sources by Company</CardTitle>
                    <CardDescription>
                      Where different companies are most frequently cited
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue={competitiveMetrics.brandName} className="w-full">
                      <TabsList className="inline-flex w-full overflow-x-auto">
                        <TabsTrigger value={competitiveMetrics.brandName}>
                          {competitiveMetrics.brandName}
                        </TabsTrigger>
                        {Object.keys(competitiveMetrics.topSourcesForCompetitors).map(competitor => (
                          <TabsTrigger key={competitor} value={competitor}>
                            {competitor}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      
                      <TabsContent value={competitiveMetrics.brandName} className="mt-4">
                        <div className="space-y-2">
                          {competitiveMetrics.topSourcesForBrand.map((source, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-6">#{idx + 1}</span>
                                <Globe className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{source.domain}</span>
                              </div>
                              <Badge variant="secondary">{source.count}</Badge>
                            </div>
                          ))}
                          {competitiveMetrics.topSourcesForBrand.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No sources found</p>
                          )}
                        </div>
                      </TabsContent>

                      {Object.entries(competitiveMetrics.topSourcesForCompetitors).map(([competitor, sources]) => (
                        <TabsContent key={competitor} value={competitor} className="mt-4">
                          <div className="space-y-2">
                            {sources.map((source, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-6">#{idx + 1}</span>
                                  <Globe className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">{source.domain}</span>
                                </div>
                                <Badge variant="secondary">{source.count}</Badge>
                              </div>
                            ))}
                            {sources.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No sources found</p>
                            )}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Tabs for Domains vs URLs */}
            <div className="flex gap-2 border-b">
              <button
                onClick={() => setActiveTab('domains')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'domains'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="inline-block w-4 h-4 mr-2" />
                Top Domains ({currentData.sources.length})
              </button>
              <button
                onClick={() => setActiveTab('urls')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'urls'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <ExternalLink className="inline-block w-4 h-4 mr-2" />
                Top URLs ({currentData.urls.length})
              </button>
            </div>

            {/* Top Domains Table */}
            {activeTab === 'domains' && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Source Domains</CardTitle>
                  <CardDescription>
                    Domains most frequently cited by AI models
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center text-xs font-medium text-muted-foreground pb-2 border-b">
                      <div className="w-12">Rank</div>
                      <div className="flex-1">Domain</div>
                      {selectedProvider === 'all' && <div className="w-48">AI Bots</div>}
                      <div className="w-24 text-right">Citations</div>
                      <div className="w-32 text-right">Share</div>
                    </div>
                    {currentData.sources.slice(0, 50).map((source: any, index: number) => {
                      const sharePercentage = currentData.citationCount > 0 
                        ? (source.count / currentData.citationCount) * 100 
                        : 0;
                      
                      return (
                        <div
                          key={index}
                          className="flex items-center py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
                        >
                          <div className="w-12 text-sm font-medium text-muted-foreground">
                            {index + 1}
                          </div>
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium truncate">
                              {source.domain}
                            </span>
                          </div>
                          {selectedProvider === 'all' && source.providers && (
                            <div className="w-48 flex items-center gap-1 flex-wrap">
                              {source.providers.map((provider: string) => {
                                const providerInfo = getProviderIcon(provider);
                                return (
                                  <Badge
                                    key={provider}
                                    variant="secondary"
                                    className={`text-xs px-2 py-0.5 ${providerInfo.color}`}
                                  >
                                    <span className="mr-1">{providerInfo.icon}</span>
                                    {providerInfo.name}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                          <div className="w-24 text-right text-sm font-bold">
                            {source.count}
                          </div>
                          <div className="w-32 text-right">
                            <Badge variant="secondary">
                              {sharePercentage.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                    {currentData.sources.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No source domains found
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top URLs Table */}
            {activeTab === 'urls' && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Source URLs</CardTitle>
                  <CardDescription>
                    Specific pages most frequently referenced
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center text-xs font-medium text-muted-foreground pb-2 border-b">
                      <div className="w-12">Rank</div>
                      <div className="flex-1">URL</div>
                      {selectedProvider === 'all' && <div className="w-48">AI Bots</div>}
                      <div className="w-24 text-right">Citations</div>
                      <div className="w-20 text-center">Visit</div>
                    </div>
                    {currentData.urls.slice(0, 50).map((urlData: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
                      >
                        <div className="w-12 text-sm font-medium text-muted-foreground">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {urlData.title || urlData.url}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {urlData.url}
                          </div>
                        </div>
                        {selectedProvider === 'all' && urlData.providers && (
                          <div className="w-48 flex items-center gap-1 flex-wrap">
                            {urlData.providers.map((provider: string) => {
                              const providerInfo = getProviderIcon(provider);
                              return (
                                <Badge
                                  key={provider}
                                  variant="secondary"
                                  className={`text-xs px-2 py-0.5 ${providerInfo.color}`}
                                >
                                  <span className="mr-1">{providerInfo.icon}</span>
                                  {providerInfo.name}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        <div className="w-24 text-right text-sm font-bold">
                          {urlData.count}
                        </div>
                        <div className="w-20 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            className="h-8 w-8 p-0"
                          >
                            <a
                              href={urlData.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {currentData.urls.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No URLs found
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Provider Breakdown */}
            {selectedProvider === 'all' && (
              <Card>
                <CardHeader>
                  <CardTitle>Citations by Provider</CardTitle>
                  <CardDescription>
                    How each AI model cites sources
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(sourceMetrics.byProvider).map(([provider, data]: [string, any]) => (
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
                              {data.sourcesList.length} sources, {data.urlsList.length} URLs
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{data.citationCount}</p>
                          <p className="text-xs text-muted-foreground">citations</p>
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
