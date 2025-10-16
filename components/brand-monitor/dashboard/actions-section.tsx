'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Target, Users, MoreHorizontal, Clock, CheckCircle2 } from 'lucide-react';

type ActionsTab = 'generate' | 'opportunities' | 'brandkit';

interface ContentItem {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'published';
  tags: string[];
  updated: string;
}

const contentItems: ContentItem[] = [
  {
    id: '1',
    name: 'Stopping LLM Hide-and-Seek',
    status: 'scheduled',
    tags: ['AI', 'SEO'],
    updated: 'just now',
  },
  {
    id: '2',
    name: 'Goal Tracking',
    status: 'draft',
    tags: ['AI', 'Analytics'],
    updated: '6 minutes ago',
  },
  {
    id: '3',
    name: 'Goal Tracking',
    status: 'draft',
    tags: ['Analytics'],
    updated: '22 minutes ago',
  },
  {
    id: '4',
    name: 'Stopping LLM Hide-and-Seek',
    status: 'scheduled',
    tags: ['AI', 'SEO'],
    updated: '6 days ago',
  },
];

export default function ActionsSection() {
  const [activeTab, setActiveTab] = useState<ActionsTab>('generate');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('generate')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'generate'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Generate Content
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'opportunities'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Opportunities
          </button>
          <button
            onClick={() => setActiveTab('brandkit')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'brandkit'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Brand Kit & Audience Segments
          </button>
        </div>
      </div>

      {/* Generate Content Tab */}
      {activeTab === 'generate' && (
        <div className="space-y-6">
          {/* Hero Section */}
          <Card className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-indigo-500/20">
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mb-6">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Create content
              </h2>
              <h3 className="text-3xl font-bold text-foreground mb-4">
                That Increases
              </h3>
              <h3 className="text-3xl font-bold text-foreground mb-6">
                Your AI Visibility
              </h3>
              <Button size="lg" className="bg-white text-black hover:bg-gray-100">
                <FileText className="h-4 w-4 mr-2" />
                Generate Content Brief
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                ⚡ Build AEO content in minutes, not days
              </p>
            </div>
          </Card>

          {/* Content Table */}
          <Card>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Updated</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentItems.map((item) => (
                      <tr key={item.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium text-foreground">{item.name}</p>
                              <div className="flex gap-1 mt-1">
                                {item.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {item.status === 'scheduled' ? (
                              <>
                                <Clock className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm text-foreground capitalize">{item.status}</span>
                              </>
                            ) : (
                              <>
                                <div className="h-2 w-2 rounded-full bg-gray-400" />
                                <span className="text-sm text-muted-foreground capitalize">{item.status}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-muted-foreground">{item.updated}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Opportunities Tab */}
      {activeTab === 'opportunities' && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Opportunities</h3>
          <p className="text-sm text-muted-foreground">
            Discover content opportunities based on your brand visibility data
          </p>
        </div>
      )}

      {/* Brand Kit Tab */}
      {activeTab === 'brandkit' && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Brand Kit & Audience Segments</h3>
          <p className="text-sm text-muted-foreground">
            Manage your brand assets and audience segments
          </p>
        </div>
      )}
    </div>
  );
}

