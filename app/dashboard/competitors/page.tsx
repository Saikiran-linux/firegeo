'use client';

import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CompetitorsPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Competitors' }]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Competitors</h1>
        <Card>
          <CardHeader>
            <CardTitle>Competitor Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Track and analyze your competitors' brand visibility.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
