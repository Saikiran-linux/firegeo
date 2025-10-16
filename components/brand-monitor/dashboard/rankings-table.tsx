'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetitorRanking } from '@/lib/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface RankingsTableProps {
  competitors: CompetitorRanking[];
}

export default function RankingsTable({ competitors }: RankingsTableProps) {
  const sortedCompetitors = [...competitors].sort((a, b) => b.visibilityScore - a.visibilityScore);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200';
      case 'negative':
        return 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200';
      case 'neutral':
        return 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-200';
      case 'mixed':
        return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitor Rankings</CardTitle>
        <CardDescription>Visibility scores across all competitors</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Rank</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Brand</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-muted-foreground">Visibility</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-muted-foreground">Mentions</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-muted-foreground">Avg Position</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-muted-foreground">Sentiment</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-muted-foreground">Share of Voice</th>
              </tr>
            </thead>
            <tbody>
              {sortedCompetitors.map((competitor, index) => (
                <tr
                  key={competitor.name}
                  className={`border-b border-border hover:bg-muted/50 transition-colors ${
                    competitor.isOwn ? 'bg-muted/20' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <span className="text-sm font-semibold text-foreground">#{index + 1}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-foreground">
                      {competitor.name}
                      {competitor.isOwn && (
                        <Badge className="ml-2 bg-primary/20 text-primary hover:bg-primary/30">Your Brand</Badge>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm font-semibold text-foreground">
                      {competitor.visibilityScore.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm text-muted-foreground">{competitor.mentions || 0}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm text-muted-foreground">
                      {competitor.averagePosition?.toFixed(1) || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge className={`${getSentimentColor(competitor.sentiment)} border-0`}>
                      {competitor.sentiment}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm font-semibold text-foreground">
                        {competitor.shareOfVoice.toFixed(1)}%
                      </span>
                      {competitor.weeklyChange !== undefined && (
                        <>
                          {competitor.weeklyChange >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
