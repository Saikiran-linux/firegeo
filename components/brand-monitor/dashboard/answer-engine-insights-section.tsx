'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, TrendingDown, Sparkline, MoreHorizontal } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const relevantSearches = [
  { query: 'profound ai visibility', volume: '549.4k', change: '+76.2k', trend: 'up' },
  { query: 'profound ai', volume: '35k', change: '-2.7k', trend: 'down' },
  { query: 'profound against semrush', volume: '8.4k', change: '+1.5k', trend: 'up' },
];

const popularKeywords = [
  { keyword: 'Profound ai', volume: '205k', change: '+2.1k', trend: 'up' },
  { keyword: 'profound vs semrush', volume: '195k', change: '+2.1k', trend: 'up' },
  { keyword: 'profound ai visibility', volume: '147k', change: '+2.1k', trend: 'up' },
  { keyword: 'geo', volume: '133k', change: '-2.1k', trend: 'down' },
  { keyword: 'aeo', volume: '131k', change: '+2.1k', trend: 'up' },
  { keyword: 'seo vs aeo', volume: '108k', change: '-2.1k', trend: 'down' },
  { keyword: 'boost ai visibility', volume: '114k', change: '+2.1k', trend: 'up' },
];

const trendingKeywords = [
  { keyword: 'generative ai tools', volume: '135k', change: '+2.1k', trend: 'up' },
  { keyword: 'aeo', volume: '120k', change: '+1.4k', trend: 'up' },
  { keyword: 'generative ai', volume: '97k', change: '+1.8k', trend: 'up' },
  { keyword: 'boost ai visibility', volume: '72k', change: '+3.4k', trend: 'up' },
  { keyword: 'google ai overviews', volume: '70k', change: '+2.9k', trend: 'up' },
  { keyword: 'ai content optimization', volume: '64k', change: '+6.4k', trend: 'up' },
  { keyword: 'seo', volume: '42k', change: '+7.1k', trend: 'up' },
];

export default function AnswerEngineInsightsSection() {
  const [searchQuery, setSearchQuery] = useState('profound ai');
  const [bulkAnalysis, setBulkAnalysis] = useState(false);

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 border-blue-500/20">
        <div className="p-12 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-8">
            Explore what people are prompting ChatGPT
          </h2>
          
          {/* Search Bar */}
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4 bg-background border border-border rounded-lg p-4 shadow-lg">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter search term..."
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-muted rounded-full px-4 py-2">
                  <Switch
                    id="bulk-analysis"
                    checked={bulkAnalysis}
                    onCheckedChange={setBulkAnalysis}
                  />
                  <Label htmlFor="bulk-analysis" className="text-xs font-medium cursor-pointer">
                    Bulk analysis
                  </Label>
                </div>
                <Button size="sm" className="rounded-full px-6">
                  Analyze
                </Button>
              </div>
            </div>

            {/* Relevant Searches */}
            {searchQuery && (
              <div className="mt-6 bg-background border border-border rounded-lg p-4 text-left">
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">Relevant searches</p>
                <div className="space-y-2">
                  {relevantSearches.map((search, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <span className="text-sm text-foreground">{search.query}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-foreground">{search.volume}</span>
                        <span className={`text-xs ${search.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                          {search.change}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Keywords Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Keywords */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Popular Keywords</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-green-500">
                <TrendingUp className="h-4 w-4 mr-1" />
                Trending
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500">
                <TrendingDown className="h-4 w-4 mr-1" />
                Declining
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            {popularKeywords.map((keyword, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-foreground font-medium">{keyword.keyword}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${keyword.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                      {keyword.trend === 'up' ? '↑' : '↓'} {keyword.change}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-foreground min-w-[60px] text-right">{keyword.volume}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Trending Keywords */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Trending Keywords</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-green-500">
                <TrendingUp className="h-4 w-4 mr-1" />
                Trending
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500">
                <TrendingDown className="h-4 w-4 mr-1" />
                Declining
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            {trendingKeywords.map((keyword, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-foreground font-medium">{keyword.keyword}</span>
                </div>
                <div className="flex items-center gap-4">
                  {/* Mini sparkline */}
                  <svg width="40" height="20" className="text-green-500">
                    <polyline
                      points="0,15 10,12 20,8 30,10 40,5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${keyword.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                      {keyword.trend === 'up' ? '↑' : '↓'} {keyword.change}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-foreground min-w-[60px] text-right">{keyword.volume}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

