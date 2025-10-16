'use client';

import React, { useState } from 'react';
import { BrandAnalysis } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VisibilityTabProps {
  analysis: BrandAnalysis;
}

// Mock data matching Profound's chart
const visibilityData = [
  { date: 'Apr 12', profound: 45, writesonic: 35, semrush: 30, seomonitor: 25, brightedge: 22 },
  { date: 'Apr 13', profound: 48, writesonic: 38, semrush: 32, seomonitor: 27, brightedge: 24 },
  { date: 'Apr 14', profound: 52, writesonic: 40, semrush: 28, seomonitor: 26, brightedge: 23 },
  { date: 'Apr 15', profound: 55, writesonic: 42, semrush: 35, seomonitor: 30, brightedge: 25 },
  { date: 'Apr 16', profound: 60, writesonic: 45, semrush: 40, seomonitor: 32, brightedge: 28 },
  { date: 'Apr 17', profound: 70, writesonic: 48, semrush: 50, seomonitor: 38, brightedge: 35 },
  { date: 'Apr 17', profound: 75, writesonic: 52, semrush: 45, seomonitor: 40, brightedge: 38 },
];

const competitorRankings = [
  { rank: 1, name: 'Profound', tag: 'Your Site', score: 41.8, change: 2.4, isOwn: true },
  { rank: 2, name: 'Writesonic', tag: '', score: 41.5, change: -1.29, isOwn: false },
  { rank: 3, name: 'Semrush', tag: '', score: 28.2, change: -0.37, isOwn: false },
  { rank: 4, name: 'SEOmonitor', tag: '', score: 24.6, change: 1.14, isOwn: false },
  { rank: 5, name: 'BrightEdge', tag: '', score: 24.2, change: -3.44, isOwn: false },
];

export default function VisibilityTab({ analysis }: VisibilityTabProps) {
  const [showPreviousPeriod, setShowPreviousPeriod] = useState(true);
  const [compareCompetitors, setCompareCompetitors] = useState(false);

  return (
    <div className="space-y-6">
      {/* Title Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Visibility Score</h2>
        <p className="text-sm text-muted-foreground">How often Ramp appears in AI-generated answers.</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visibility Score */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Visibility Score</h3>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold text-foreground">48.3%</span>
            <div className="flex items-center gap-1 text-green-500 text-lg font-semibold">
              <TrendingUp className="h-5 w-5" />
              <span>+3.5%</span>
            </div>
          </div>
        </Card>

        {/* Visibility Score Rank */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Visibility Score Rank</h3>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground pb-2">
              <span>Brand</span>
              <span>Score</span>
            </div>
            {competitorRankings.map((item) => (
              <div
                key={item.rank}
                className="flex items-center justify-between py-2 hover:bg-muted/30 rounded px-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-4">{item.rank}</span>
                  <div className="flex items-center gap-2">
                    {item.isOwn && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                    {item.tag && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {item.tag}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{item.score}%</span>
                  <span className={`text-xs font-medium ${item.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {item.change > 0 ? '+' : ''}{item.change}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-6">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visibilityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="profound"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={false}
                name="Profound"
              />
              <Line
                type="monotone"
                dataKey="writesonic"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={false}
                name="Writesonic"
              />
              <Line
                type="monotone"
                dataKey="semrush"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                name="Semrush"
              />
              <Line
                type="monotone"
                dataKey="seomonitor"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={false}
                name="SEOmonitor"
              />
              <Line
                type="monotone"
                dataKey="brightedge"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
                name="BrightEdge"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showPreviousPeriod}
                onChange={(e) => setShowPreviousPeriod(e.target.checked)}
                className="rounded"
              />
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Current Period</span>
              </div>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!showPreviousPeriod}
                onChange={(e) => setShowPreviousPeriod(!e.target.checked)}
                className="rounded"
              />
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-xs text-muted-foreground">Previous Period</span>
              </div>
            </label>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={compareCompetitors}
                onChange={(e) => setCompareCompetitors(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">Compare Competitors</span>
            </label>
            <Button variant="link" size="sm" className="text-xs">
              Expand
            </Button>
          </div>
        </div>
      </Card>

      {/* Share of Voice */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Share of Voice</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Mentions of Ramp in AI-generated answers in relation to competitors.
        </p>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Chart Config</h3>
          </div>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Chart placeholder - Share of Voice visualization
          </div>
        </Card>
      </div>
    </div>
  );
}
