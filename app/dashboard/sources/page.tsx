'use client';

import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SourcesPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sources' }]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Sources</h1>
        <Card>
          <CardHeader>
            <CardTitle>Source Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              View and analyze all sources where your brand is mentioned.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
