'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandAnalysis } from '@/lib/types';

interface ShoppingTabProps {
  analysis: BrandAnalysis;
}

export default function ShoppingTab({ analysis }: ShoppingTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Shopping Results</CardTitle>
          <CardDescription>Your brand visibility in shopping/e-commerce results</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Shopping visibility data coming soon</p>
            <p className="text-muted-foreground text-sm">Product visibility, pricing comparisons, and shopping platform performance</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
