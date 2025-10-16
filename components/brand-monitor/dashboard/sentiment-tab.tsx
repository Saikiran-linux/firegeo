'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandAnalysis } from '@/lib/types';

interface SentimentTabProps {
  analysis: BrandAnalysis;
}

export default function SentimentTab({ analysis }: SentimentTabProps) {
  const brandData = analysis?.competitors?.find(c => c.isOwn);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Analysis</CardTitle>
          <CardDescription>Brand sentiment trends and competitor comparison</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            {brandData && (
              <>
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2">Current Sentiment Score</p>
                  <p className="text-4xl font-bold text-foreground">{brandData.sentimentScore || 0}</p>
                  <p className="text-sm text-muted-foreground mt-2 capitalize">{brandData.sentiment}</p>
                </div>
              </>
            )}
            <p className="text-muted-foreground">Detailed sentiment breakdown coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
