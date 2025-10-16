'use client';

import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SentimentPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sentiment' }]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Sentiment</h1>
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Analyze sentiment around your brand mentions.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
