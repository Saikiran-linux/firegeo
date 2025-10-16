'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandAnalysis } from '@/lib/types';

interface PlatformsTabProps {
  analysis: BrandAnalysis;
}

export default function PlatformsTab({ analysis }: PlatformsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Platform Performance</CardTitle>
          <CardDescription>Your brand visibility across different AI platforms</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Analyzed {analysis?.responses?.length || 0} responses across platforms</p>
            <p className="text-muted-foreground text-sm">Platform-specific metrics (ChatGPT, Perplexity, Gemini, etc.) coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
