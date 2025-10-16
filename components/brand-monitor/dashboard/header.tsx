'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandAnalysis } from '@/lib/types';

interface DashboardHeaderProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  dateRange: '7d' | '15d' | '30d' | 'custom';
  onDateRangeChange: (range: '7d' | '15d' | '30d' | 'custom') => void;
  analysis: BrandAnalysis | null;
}

export default function DashboardHeader({
  theme,
  onThemeChange,
  dateRange,
  onDateRangeChange,
  analysis,
}: DashboardHeaderProps) {
  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6 gap-4">
        {/* Left: Brand Info */}
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {analysis?.company?.name || 'Brand Analytics'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {analysis?.company?.url || 'No brand selected'}
          </p>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-4">
          {/* Date Range Buttons */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {['7d', '15d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => onDateRangeChange(range as '7d' | '15d' | '30d')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range === '7d' ? 'Last 7 days' : range === '15d' ? 'Last 15 days' : 'Last 30 days'}
              </button>
            ))}
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-lg"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Moon className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
