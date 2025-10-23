'use client';

import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, SmilePlus, Frown, Meh, TrendingUp, TrendingDown } from 'lucide-react';
import { useBrandAnalyses } from '@/hooks/useBrandAnalyses';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

export default function SentimentPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  
  const { data: analyses, isLoading: analysesLoading, error: analysesError } = useBrandAnalyses();

  // Get the most recent analysis
  const latestAnalysis = useMemo(() => {
    if (!analyses || analyses.length === 0) return null;
    return analyses[0];
  }, [analyses]);

  // Calculate sentiment metrics from prompt results
  const sentimentMetrics = useMemo(() => {
    if (!latestAnalysis?.analysisData) return null;

    const analysisData = latestAnalysis.analysisData as any;
    const promptResults = analysisData.promptResults || [];
    const yourBrandName = (analysisData.company?.name || '').toLowerCase();
    
    // Get all results from prompt results
    const allResults = promptResults
      .filter((pr: any) => pr && pr.results && pr.results.length > 0)
      .flatMap((pr: any) => pr.results);
    
    const providerMap: Record<string, any> = {};
    let allSentimentScores: number[] = [];
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    
    // Process results by provider
    allResults.forEach((result: any) => {
      const provider = result.provider?.toLowerCase() || 'unknown';
      
      if (!providerMap[provider]) {
        providerMap[provider] = {
          sentimentScores: [],
          positive: 0,
          neutral: 0,
          negative: 0,
          mentions: [],
        };
      }
      
      // Track sentiment if available
      if (result.sentimentScore !== undefined) {
        const score = result.sentimentScore;
        providerMap[provider].sentimentScores.push(score);
        allSentimentScores.push(score);
        
        // Categorize sentiment
        if (score >= 60) {
          providerMap[provider].positive++;
          positiveCount++;
        } else if (score >= 40) {
          providerMap[provider].neutral++;
          neutralCount++;
        } else {
          providerMap[provider].negative++;
          negativeCount++;
        }
        
        // Store mention details if brand was mentioned
        if (result.brandMentioned) {
          const text = result.response || '';
          providerMap[provider].mentions.push({
            text: text.substring(0, 200) + '...',
            score,
            prompt: '', // We don't have prompt text in results
          });
        }
      }
    });

    // Calculate averages for each provider
    Object.keys(providerMap).forEach((provider) => {
      const data = providerMap[provider];
      data.averageSentiment = data.sentimentScores.length > 0
        ? data.sentimentScores.reduce((a: number, b: number) => a + b, 0) / data.sentimentScores.length
        : 0;
      data.totalMentions = data.sentimentScores.length;
    });

    // Calculate overall average
    const averageSentiment = allSentimentScores.length > 0
      ? allSentimentScores.reduce((a, b) => a + b, 0) / allSentimentScores.length
      : 0;

    const totalMentions = allSentimentScores.length;
    const positivePercentage = totalMentions > 0 ? (positiveCount / totalMentions) * 100 : 0;
    const neutralPercentage = totalMentions > 0 ? (neutralCount / totalMentions) * 100 : 0;
    const negativePercentage = totalMentions > 0 ? (negativeCount / totalMentions) * 100 : 0;

    return {
      byProvider: providerMap,
      overall: {
        averageSentiment,
        totalMentions,
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
        positivePercentage,
        neutralPercentage,
        negativePercentage,
        allScores: allSentimentScores,
      },
    };
  }, [latestAnalysis]);

  // Get current view data
  const currentData = useMemo(() => {
    if (!sentimentMetrics) return null;
    
    if (selectedProvider === 'all') {
      return sentimentMetrics.overall;
    } else {
      const providerData = sentimentMetrics.byProvider[selectedProvider];
      if (!providerData) return null;
      
      const total = providerData.totalMentions;
      return {
        averageSentiment: providerData.averageSentiment,
        totalMentions: total,
        positive: providerData.positive,
        neutral: providerData.neutral,
        negative: providerData.negative,
        positivePercentage: total > 0 ? (providerData.positive / total) * 100 : 0,
        neutralPercentage: total > 0 ? (providerData.neutral / total) * 100 : 0,
        negativePercentage: total > 0 ? (providerData.negative / total) * 100 : 0,
        mentions: providerData.mentions,
      };
    }
  }, [sentimentMetrics, selectedProvider]);

  // Get sentiment label and color
  const getSentimentInfo = (score: number) => {
    if (score >= 70) return { label: 'Very Positive', color: 'text-green-600 bg-green-50', icon: SmilePlus };
    if (score >= 60) return { label: 'Positive', color: 'text-green-500 bg-green-50', icon: SmilePlus };
    if (score >= 40) return { label: 'Neutral', color: 'text-yellow-600 bg-yellow-50', icon: Meh };
    return { label: 'Negative', color: 'text-red-600 bg-red-50', icon: Frown };
  };

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
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sentiment' }]}>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sentiment Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Understand how AI models perceive your brand
            </p>
          </div>
          {currentData && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Overall Sentiment</div>
              <div className="text-3xl font-bold">
                {currentData.averageSentiment.toFixed(0)}
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
              Analyzing <span className="font-semibold text-foreground">{currentData.totalMentions}</span> mentions
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
            <p className="text-muted-foreground">Loading sentiment data...</p>
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
                <Meh className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No sentiment data available. Run your first brand analysis to see sentiment.
                </p>
                <Button onClick={() => router.push('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sentiment Data */}
        {!loading && !error && sentimentMetrics && currentData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Average Sentiment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="text-4xl font-bold">
                      {currentData.averageSentiment.toFixed(0)}
                    </div>
                    <Badge className={getSentimentInfo(currentData.averageSentiment).color}>
                      {getSentimentInfo(currentData.averageSentiment).label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Out of 100 points
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Positive Mentions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <SmilePlus className="h-8 w-8 text-green-500" />
                    <div>
                      <div className="text-3xl font-bold">{currentData.positive}</div>
                      <p className="text-xs text-muted-foreground">
                        {currentData.positivePercentage.toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Neutral Mentions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Meh className="h-8 w-8 text-yellow-500" />
                    <div>
                      <div className="text-3xl font-bold">{currentData.neutral}</div>
                      <p className="text-xs text-muted-foreground">
                        {currentData.neutralPercentage.toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Negative Mentions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Frown className="h-8 w-8 text-red-500" />
                    <div>
                      <div className="text-3xl font-bold">{currentData.negative}</div>
                      <p className="text-xs text-muted-foreground">
                        {currentData.negativePercentage.toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sentiment Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Distribution</CardTitle>
                <CardDescription>
                  Breakdown of sentiment across all brand mentions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Positive */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <SmilePlus className="h-5 w-5 text-green-500" />
                        <span className="text-sm font-medium">Positive (60-100)</span>
                      </div>
                      <span className="text-sm font-bold">
                        {currentData.positive} ({currentData.positivePercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${currentData.positivePercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Neutral */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Meh className="h-5 w-5 text-yellow-500" />
                        <span className="text-sm font-medium">Neutral (40-59)</span>
                      </div>
                      <span className="text-sm font-bold">
                        {currentData.neutral} ({currentData.neutralPercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500"
                        style={{ width: `${currentData.neutralPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Negative */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Frown className="h-5 w-5 text-red-500" />
                        <span className="text-sm font-medium">Negative (0-39)</span>
                      </div>
                      <span className="text-sm font-bold">
                        {currentData.negative} ({currentData.negativePercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${currentData.negativePercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provider Comparison */}
            {selectedProvider === 'all' && (
              <Card>
                <CardHeader>
                  <CardTitle>Sentiment by Provider</CardTitle>
                  <CardDescription>
                    How different AI models perceive your brand
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(sentimentMetrics.byProvider).map(([provider, data]: [string, any]) => {
                      const sentimentInfo = getSentimentInfo(data.averageSentiment);
                      const Icon = sentimentInfo.icon;
                      
                      return (
                        <div key={provider} className="p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
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
                                  {data.totalMentions} mentions analyzed
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <Icon className="h-6 w-6" />
                                <div className="text-3xl font-bold">
                                  {data.averageSentiment.toFixed(0)}
                                </div>
                              </div>
                              <Badge className={sentimentInfo.color + ' mt-1'}>
                                {sentimentInfo.label}
                              </Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="text-center">
                              <div className="font-bold text-green-600">{data.positive}</div>
                              <div className="text-xs text-muted-foreground">Positive</div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold text-yellow-600">{data.neutral}</div>
                              <div className="text-xs text-muted-foreground">Neutral</div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold text-red-600">{data.negative}</div>
                              <div className="text-xs text-muted-foreground">Negative</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sample Mentions (if available for selected provider) */}
            {selectedProvider !== 'all' && (currentData as any)?.mentions && (currentData as any)?.mentions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Sample Mentions</CardTitle>
                  <CardDescription>
                    Recent brand mentions from {selectedProvider}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {((currentData as any)?.mentions || []).slice(0, 5).map((mention: any, index: number) => {
                      const sentimentInfo = getSentimentInfo(mention.score);
                      const Icon = sentimentInfo.icon;
                      
                      return (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-start gap-3">
                            <Icon className="h-5 w-5 mt-1 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={sentimentInfo.color}>
                                  Score: {mention.score.toFixed(0)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {mention.prompt.substring(0, 50)}...
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {mention.text}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
