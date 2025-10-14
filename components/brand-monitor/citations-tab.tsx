import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CitationAnalysis, SourceFrequency } from '@/lib/types';
import { ExternalLink, TrendingUp, Globe, Users } from 'lucide-react';

interface CitationsTabProps {
  citationAnalysis?: CitationAnalysis;
  brandName: string;
  competitors: string[];
}

export function CitationsTab({ citationAnalysis, brandName, competitors }: CitationsTabProps) {
  const [activeView, setActiveView] = useState<'overview' | 'brand' | 'competitors' | 'sources'>('overview');

  // Debug logging
  console.log('[CitationsTab] Received data:', {
    hasCitationAnalysis: !!citationAnalysis,
    totalSources: citationAnalysis?.totalSources,
    brandCitations: citationAnalysis?.brandCitations?.totalCitations,
    competitorCount: citationAnalysis ? Object.keys(citationAnalysis.competitorCitations).length : 0,
    topSourcesCount: citationAnalysis?.topSources?.length,
    brandName,
    competitorsCount: competitors.length
  });

  if (!citationAnalysis) {
    console.warn('[CitationsTab] No citation analysis data provided');
    return (
      <Card className="p-6 bg-card text-card-foreground gap-6 rounded-xl border shadow-sm border-gray-200">
        <CardContent className="pt-6">
          <div className="text-center py-12 text-gray-500">
            <Globe className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Citation Data Available</p>
            <p className="text-sm mt-2">Citation tracking requires web search-enabled providers.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topSources = citationAnalysis.topSources.slice(0, 10);
  const brandCitations = citationAnalysis.brandCitations;
  const competitorCitations = citationAnalysis.competitorCitations;

  // Calculate statistics
  const totalCitations = citationAnalysis.totalSources;
  const brandCitationCount = brandCitations.totalCitations;
  const brandCitationPercentage = totalCitations > 0 
    ? ((brandCitationCount / totalCitations) * 100).toFixed(1) 
    : '0';

  const competitorCitationCounts = Object.entries(competitorCitations)
    .map(([name, data]) => ({
      name,
      count: data.totalCitations,
      percentage: totalCitations > 0 ? ((data.totalCitations / totalCitations) * 100).toFixed(1) : '0'
    }))
    .sort((a, b) => b.count - a.count);

  // Get providers that found citations
  const activeProviders = useMemo(() => {
    const providers = new Set<string>();
    topSources.forEach(source => {
      source.providers.forEach(p => providers.add(p));
    });
    return Array.from(providers);
  }, [topSources]);

  return (
    <Card className="p-2 bg-card text-card-foreground gap-6 rounded-xl border py-6 shadow-sm border-gray-200 h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold">Citation Analysis</CardTitle>
            <CardDescription className="text-sm text-gray-600 mt-1">
              Sources where your brand and competitors are cited
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-600">{totalCitations}</p>
            <p className="text-xs text-gray-500 mt-1">Total Sources</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 flex-1 overflow-auto">
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="brand">Your Brand</TabsTrigger>
            <TabsTrigger value="competitors">Competitors</TabsTrigger>
            <TabsTrigger value="sources">Top Sources</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Brand Citations Card */}
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-700">Your Brand</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">{brandCitationCount}</div>
                  <p className="text-xs text-gray-600 mt-1">{brandCitationPercentage}% of all sources</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {brandCitations.topDomains.slice(0, 3).map((domain, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{domain}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Competitor Citations Card */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-700">Top Competitor</CardTitle>
                </CardHeader>
                <CardContent>
                  {competitorCitationCounts[0] ? (
                    <>
                      <div className="text-2xl font-bold text-blue-600">{competitorCitationCounts[0].name}</div>
                      <p className="text-xs text-gray-600 mt-1">{competitorCitationCounts[0].count} citations ({competitorCitationCounts[0].percentage}%)</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No competitor citations</p>
                  )}
                </CardContent>
              </Card>

              {/* Active Providers Card */}
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-700">AI Providers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{activeProviders.length}</div>
                  <p className="text-xs text-gray-600 mt-1">Providers with citations</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {activeProviders.map((provider, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{provider}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Citation Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Citation Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Brand bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{brandName}</span>
                      <span className="text-gray-600">{brandCitationCount} ({brandCitationPercentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-orange-500 h-3 rounded-full transition-all duration-500" 
                        style={{ width: `${brandCitationPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Competitor bars */}
                  {competitorCitationCounts.slice(0, 5).map((comp, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{comp.name}</span>
                        <span className="text-gray-600">{comp.count} ({comp.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-500 h-3 rounded-full transition-all duration-500" 
                          style={{ width: `${comp.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brand Citations Tab */}
          <TabsContent value="brand" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Sources Citing {brandName}</CardTitle>
                <CardDescription>Websites and articles where your brand is mentioned</CardDescription>
              </CardHeader>
              <CardContent>
                {brandCitations.sources.length > 0 ? (
                  <div className="space-y-3">
                    {brandCitations.sources.map((citation, idx) => (
                      <div key={idx} className="border-l-4 border-orange-500 pl-4 py-2 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <a 
                              href={citation.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-medium text-gray-900 hover:text-orange-600 flex items-center gap-2"
                            >
                              {citation.title || citation.source || 'Untitled Source'}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {citation.snippet && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{citation.snippet}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-gray-500">{citation.source || new URL(citation.url).hostname}</span>
                              {citation.date && (
                                <span className="text-xs text-gray-500">{citation.date}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No citations found for your brand</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Competitors Citations Tab */}
          <TabsContent value="competitors" className="space-y-4">
            {competitorCitationCounts.map((competitor, idx) => {
              const competitorData = competitorCitations[competitor.name];
              if (!competitorData) return null;

              return (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-base font-semibold">{competitor.name}</CardTitle>
                        <CardDescription>{competitor.count} citations found</CardDescription>
                      </div>
                      <Badge variant="outline">{competitor.percentage}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {competitorData.sources.slice(0, 5).map((citation, citIdx) => (
                        <div key={citIdx} className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50 transition-colors">
                          <a 
                            href={citation.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-sm text-gray-900 hover:text-blue-600 flex items-center gap-2"
                          >
                            {citation.title || citation.source || 'Untitled Source'}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <span className="text-xs text-gray-500">{citation.source || new URL(citation.url).hostname}</span>
                        </div>
                      ))}
                      {competitorData.sources.length > 5 && (
                        <p className="text-xs text-gray-500 text-center pt-2">
                          +{competitorData.sources.length - 5} more sources
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Top Sources Tab */}
          <TabsContent value="sources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Most Cited Sources</CardTitle>
                <CardDescription>Top domains referenced by AI chatbots</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topSources.map((source, idx) => (
                    <div key={idx} className="border rounded-lg p-4 hover:border-orange-300 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-400">#{idx + 1}</span>
                            <div>
                              <a 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-semibold text-gray-900 hover:text-orange-600 flex items-center gap-2"
                              >
                                {source.title || source.domain}
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <p className="text-sm text-gray-500">{source.domain}</p>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              {source.frequency} references
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              {source.mentionedCompanies.length} companies
                            </Badge>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-xs text-gray-500 mr-1">Providers:</span>
                            {source.providers.map((provider, pIdx) => (
                              <Badge key={pIdx} variant="secondary" className="text-xs">
                                {provider}
                              </Badge>
                            ))}
                          </div>

                          {source.mentionedCompanies.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="text-xs text-gray-500 mr-1">Mentions:</span>
                              {source.mentionedCompanies.map((company, cIdx) => (
                                <Badge 
                                  key={cIdx} 
                                  variant={company === brandName ? "default" : "outline"}
                                  className="text-xs"
                                >
                                  {company}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

