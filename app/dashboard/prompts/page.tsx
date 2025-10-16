'use client';

import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PromptsPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Prompts' }]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Prompts</h1>
        <Card>
          <CardHeader>
            <CardTitle>Prompt Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              View and manage prompts used to track your brand visibility.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
