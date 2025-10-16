'use client';

import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BlogsPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Blogs' }]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Blogs</h1>
        <Card>
          <CardHeader>
            <CardTitle>Blog Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Create and manage blog content to improve brand visibility.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
