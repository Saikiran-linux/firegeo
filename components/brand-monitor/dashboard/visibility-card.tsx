'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface VisibilityCardProps {
  score: number;
  trend?: number;
  rank?: number;
  totalCompetitors?: number;
}

export default function VisibilityCard({
  score,
  trend = 3.5,
  rank = 1,
  totalCompetitors = 5,
}: VisibilityCardProps) {
  const isPositive = trend >= 0;

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Visibility Score</CardTitle>
        <CardDescription>How often your brand appears in AI-generated answers</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-6">
        {/* Main Score */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-foreground">{score.toFixed(1)}%</span>
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
              <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                {isPositive ? '+' : ''}{trend.toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">from previous period</p>
        </div>

        {/* Rank Info */}
        <div className="text-right">
          <div className="text-3xl font-bold text-foreground">#{rank}</div>
          <p className="text-sm text-muted-foreground">of {totalCompetitors} competitors</p>
        </div>
      </CardContent>
    </Card>
  );
}
