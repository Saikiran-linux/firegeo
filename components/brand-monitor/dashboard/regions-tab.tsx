'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { BrandAnalysis } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface RegionsTabProps {
  analysis: BrandAnalysis;
}

// Regional data matching Profound's layout
const regionData = [
  { country: 'United States', flag: '🇺🇸', visibility: 52.1, change: 14.5, sentiment: 72.3, shareOfVoice: 44.9 },
  { country: 'Argentina', flag: '🇦🇷', visibility: 35.5, change: 15.1, sentiment: 68.2, shareOfVoice: 42.1 },
  { country: 'Mexico', flag: '🇲🇽', visibility: 64.1, change: 11.0, sentiment: 75.4, shareOfVoice: 48.3 },
  { country: 'China', flag: '🇨🇳', visibility: 19.5, change: 10.0, sentiment: 65.1, shareOfVoice: 38.7 },
  { country: 'India', flag: '🇮🇳', visibility: 18.3, change: 10.1, sentiment: 70.2, shareOfVoice: 40.5 },
  { country: 'Spain', flag: '🇪🇸', visibility: 17.2, change: 10.3, sentiment: 69.8, shareOfVoice: 39.2 },
  { country: 'Germany', flag: '🇩🇪', visibility: 15.5, change: 11.4, sentiment: 71.5, shareOfVoice: 41.8 },
  { country: 'Sri Lanka', flag: '🇱🇰', visibility: 12.1, change: 10.0, sentiment: 66.3, shareOfVoice: 37.4 },
  { country: 'Thailand', flag: '🇹🇭', visibility: 12.1, change: 12.0, sentiment: 68.9, shareOfVoice: 40.1 },
  { country: 'Singapore', flag: '🇸🇬', visibility: 11.8, change: 10.2, sentiment: 73.1, shareOfVoice: 43.2 },
  { country: 'Switzerland', flag: '🇨🇭', visibility: 11.7, change: 11.4, sentiment: 74.5, shareOfVoice: 44.6 },
  { country: 'United Kingdom', flag: '🇬🇧', visibility: 11.5, change: 10.9, sentiment: 72.8, shareOfVoice: 42.9 },
];

export default function RegionsTab({ analysis }: RegionsTabProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visibility' | 'sentiment' | 'shareofvoice'>('visibility');

  return (
    <div className="space-y-6">
      {/* Date Range Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          {['7d', '15d', '30d', 'Custom'].map((range) => (
            <button
              key={range}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors text-muted-foreground hover:text-foreground"
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <Card className="lg:col-span-2 p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Chart Config</h3>
          </div>
          
          {/* World Map - Simplified representation */}
          <div className="relative w-full h-96 bg-gradient-to-b from-muted/30 to-muted/10 rounded-lg overflow-hidden">
            {/* Map background */}
            <div className="absolute inset-0">
              <svg viewBox="0 0 1000 500" className="w-full h-full">
                {/* Simplified world map paths */}
                {/* North America */}
                <path
                  d="M 100 100 L 150 80 L 200 90 L 250 100 L 280 150 L 260 200 L 200 220 L 150 200 L 120 180 Z"
                  fill="hsl(var(--muted-foreground))"
                  opacity="0.3"
                  className="cursor-pointer hover:opacity-50 transition-opacity"
                  onMouseEnter={() => setHoveredRegion('United States')}
                  onMouseLeave={() => setHoveredRegion(null)}
                />
                {/* South America */}
                <path
                  d="M 200 280 L 230 260 L 260 280 L 270 320 L 260 380 L 230 400 L 210 380 L 200 340 Z"
                  fill="hsl(var(--muted-foreground))"
                  opacity="0.3"
                  className="cursor-pointer hover:opacity-50 transition-opacity"
                />
                {/* Europe */}
                <path
                  d="M 450 120 L 480 110 L 520 120 L 530 150 L 510 170 L 470 160 L 450 140 Z"
                  fill="hsl(var(--muted-foreground))"
                  opacity="0.3"
                  className="cursor-pointer hover:opacity-50 transition-opacity"
                />
                {/* Asia */}
                <path
                  d="M 600 100 L 700 90 L 780 110 L 800 150 L 750 200 L 680 210 L 620 180 L 600 140 Z"
                  fill="hsl(var(--muted-foreground))"
                  opacity="0.3"
                  className="cursor-pointer hover:opacity-50 transition-opacity"
                />
                {/* Africa */}
                <path
                  d="M 480 200 L 520 190 L 550 220 L 560 280 L 530 320 L 490 310 L 470 270 Z"
                  fill="hsl(var(--muted-foreground))"
                  opacity="0.3"
                  className="cursor-pointer hover:opacity-50 transition-opacity"
                />
                {/* Australia */}
                <path
                  d="M 750 320 L 800 310 L 830 340 L 820 370 L 780 380 L 750 360 Z"
                  fill="hsl(var(--muted-foreground))"
                  opacity="0.3"
                  className="cursor-pointer hover:opacity-50 transition-opacity"
                />
                
                {/* Highlighted regions */}
                <circle cx="150" cy="130" r="8" fill="#3b82f6" opacity="0.8" />
                <circle cx="750" cy="200" r="6" fill="#8b5cf6" opacity="0.8" />
              </svg>
            </div>

            {/* Tooltip */}
            {hoveredRegion && (
              <div className="absolute top-20 left-40 bg-background border border-border rounded-lg p-4 shadow-lg z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🇺🇸</span>
                  <span className="font-medium text-foreground text-sm">{hoveredRegion}</span>
                  <span className="text-xs text-muted-foreground">May 2</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-muted-foreground">Visibility</span>
                    <span className="font-medium text-foreground">52.1%</span>
                  </div>
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-muted-foreground">Positive Sentiment</span>
                    <span className="font-medium text-foreground">72.3%</span>
                  </div>
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-muted-foreground">Share of Voice</span>
                    <span className="font-medium text-foreground">44.9%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Current Period</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-xs text-muted-foreground">Previous Period</span>
            </div>
            <label className="flex items-center gap-2 ml-auto">
              <input type="checkbox" className="rounded" />
              <span className="text-xs text-muted-foreground">Compare Competitors</span>
            </label>
            <Button variant="link" size="sm" className="text-xs">
              Expand
            </Button>
          </div>
        </Card>

        {/* Regions List */}
        <Card className="p-6">
          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-border">
            <button
              onClick={() => setActiveTab('visibility')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'visibility'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              Visibility
            </button>
            <button
              onClick={() => setActiveTab('sentiment')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sentiment'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              Share of Voice
            </button>
            <button
              onClick={() => setActiveTab('shareofvoice')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'shareofvoice'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              Sentiment
            </button>
          </div>

          {/* Region List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground pb-2 border-b border-border">
              <span>Region</span>
              <span>Visibility</span>
            </div>
            {regionData.map((region, index) => (
              <div
                key={region.country}
                className="flex items-center justify-between py-2 hover:bg-muted/50 rounded-lg px-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm font-medium w-4">{index + 1}</span>
                  <span className="text-lg">{region.flag}</span>
                  <span className="text-sm font-medium text-foreground">{region.country}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{region.visibility}%</span>
                  <span className="text-xs text-green-500 font-medium">+{region.change}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
