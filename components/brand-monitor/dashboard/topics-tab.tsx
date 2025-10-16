'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandAnalysis } from '@/lib/types';

interface TopicsTabProps {
  analysis: BrandAnalysis;
}

export default function TopicsTab({ analysis }: TopicsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Topic Analysis</CardTitle>
          <CardDescription>Key topics and keywords associated with your brand</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Topics based on {analysis?.prompts?.length || 0} prompts analyzed</p>
            <p className="text-muted-foreground text-sm">Topic breakdown and keyword analysis coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
