'use client';

import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function OutreachPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Outreach' }]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Outreach</h1>
        <Card>
          <CardHeader>
            <CardTitle>Outreach Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Manage outreach campaigns to boost your brand presence.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
