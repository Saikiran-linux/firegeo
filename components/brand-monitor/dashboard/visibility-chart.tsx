'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface VisibilityChartProps {
  companyName?: string;
}

// Placeholder 7-day data
const generatePlaceholderData = () => {
  const data = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    data.push({
      date: `${month}/${day}`,
      visibility: Math.floor(45 + Math.random() * 10),
      benchmark: Math.floor(42 + Math.random() * 8),
    });
  }
  return data;
};

export default function VisibilityChart({ companyName = 'Your Brand' }: VisibilityChartProps) {
  const data = generatePlaceholderData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>7-Day Visibility Trend</CardTitle>
        <CardDescription>Your brand visibility over the past week</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs text-muted-foreground"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-xs text-muted-foreground"
              tick={{ fill: 'currentColor' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              cursor={{ stroke: 'hsl(var(--muted))' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="visibility"
              stroke="#ff6b35"
              strokeWidth={2}
              name={companyName}
              dot={{ fill: '#ff6b35', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="#6366f1"
              strokeWidth={2}
              name="Industry Average"
              dot={{ fill: '#6366f1', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
