'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandAnalysis, CitationAnalysis } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface CitationsTabProps {
  analysis: BrandAnalysis;
}

export default function CitationsTab({ analysis }: CitationsTabProps) {
  const citationAnalysis: CitationAnalysis | undefined = analysis?.citationAnalysis;

  if (!citationAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Citations</CardTitle>
          <CardDescription>Sources citing your brand</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground">No citation data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{citationAnalysis.totalSources}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique sources citing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Brand Citations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{citationAnalysis.brandCitations?.totalCitations || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Times mentioned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Domain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold truncate">
              {citationAnalysis.topSources?.[0]?.domain || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Most citations</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Top Citation Sources</CardTitle>
          <CardDescription>Websites most frequently citing your brand</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {citationAnalysis.topSources?.slice(0, 10).map((source) => (
              <div key={source.url} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{source.domain}</p>
                  {source.title && <p className="text-xs text-muted-foreground truncate mt-0.5">{source.title}</p>}
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <Badge variant="secondary">{source.frequency}</Badge>
                </div>
              </div>
            ))}
            {!citationAnalysis.topSources?.length && (
              <p className="text-center text-muted-foreground py-8">No citation sources available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Competitors Citations */}
      {citationAnalysis.competitorCitations && Object.keys(citationAnalysis.competitorCitations).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Competitor Citations</CardTitle>
            <CardDescription>How competitors are cited vs your brand</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(citationAnalysis.competitorCitations).map(([competitor, data]) => (
                <div key={competitor} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{competitor}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.topDomains?.length || 0} top domains
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{data.totalCitations}</p>
                    <p className="text-xs text-muted-foreground">citations</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
