'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useBrandAnalyses } from '@/hooks/useBrandAnalyses';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  Plus, 
  Loader2, 
  Search, 
  MessageSquare,
  Edit2,
  Trash2,
  Copy,
  Sparkles,
  Check,
  X,
  Play,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MapPin,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BrandTopic {
  id: string;
  name: string;
  location?: string;
  createdAt?: string;
  prompts: BrandPrompt[];
}

interface BrandPrompt {
  id: string;
  prompt: string;
  topicId: string;
}

interface PromptResult {
  promptId: string;
  prompt: string;
  topicId?: string;
  results: {
    provider: string;
    response: string;
    error?: string;
    timestamp: string;
    sources?: Array<{
      url: string;
      title?: string;
      snippet?: string;
    }>;
    citations?: Array<{
      url: string;
      title?: string;
      source?: string;
      mentionedCompanies?: string[];
    }>;
    brandMentioned?: boolean;
    brandPosition?: number;
    sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
    sentimentScore?: number;
    confidence?: number;
    competitors?: Array<{
      name: string;
      position?: number;
      sentimentScore?: number;
    }>;
  }[];
}

export default function PromptsPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const { data: analyses, isLoading: analysesLoading, refetch: refetchAnalyses } = useBrandAnalyses();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // Topic management
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<BrandTopic | null>(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicLocation, setNewTopicLocation] = useState('');

  // Prompt management
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [editingPrompt, setEditingPrompt] = useState<BrandPrompt | null>(null);
  const [newPrompt, setNewPrompt] = useState('');

  // Generate topics state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedTopics, setGeneratedTopics] = useState<BrandTopic[]>([]);
  const [selectedGeneratedTopics, setSelectedGeneratedTopics] = useState<Set<string>>(new Set());
  const [generateCount, setGenerateCount] = useState('3');

  // Prompt results state
  const [promptResults, setPromptResults] = useState<Record<string, PromptResult>>({});
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());
  const [runAllLoading, setRunAllLoading] = useState(false);
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modal state for viewing results
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [selectedPromptResult, setSelectedPromptResult] = useState<{ prompt: string; result: PromptResult } | null>(null);

  // Get topics from latest analysis
  const topics = useMemo(() => {
    if (!analyses || analyses.length === 0) return [];
    const latestAnalysis = analyses[0];
    
    const storedTopics = (latestAnalysis.analysisData as any)?.topics || [];
    
    return storedTopics.filter((topic: any) => {
      return topic && 
             typeof topic === 'object' && 
             topic.id && 
             topic.name &&
             Array.isArray(topic.prompts);
    }) as BrandTopic[];
  }, [analyses]);

  // Get company info from latest analysis
  const companyInfo = useMemo(() => {
    if (!analyses || analyses.length === 0) return null;
    const latestAnalysis = analyses[0];
    return {
      name: latestAnalysis.companyName,
      url: latestAnalysis.url,
      competitors: (latestAnalysis.analysisData as any)?.competitors || []
    };
  }, [analyses]);

  // Initialize prompt results from analysis data
  React.useEffect(() => {
    if (analyses && analyses.length > 0) {
      const latestAnalysis = analyses[0];
      const savedResults = (latestAnalysis.analysisData as any)?.promptResults || [];
      const resultsMap: Record<string, PromptResult> = {};
      
      savedResults.forEach((result: PromptResult) => {
        resultsMap[result.promptId] = result;
      });
      
      setPromptResults(resultsMap);
    }
  }, [analyses]);

  // Cleanup progress timeout on unmount
  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, []);

  // Filter topics and prompts
  const filteredTopics = useMemo(() => {
    if (!searchQuery) return topics;
    
    return topics
      .map(topic => ({
        ...topic,
        prompts: topic.prompts.filter(prompt =>
          prompt.prompt.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }))
      .filter(topic => 
        topic.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        topic.prompts.length > 0
      );
  }, [topics, searchQuery]);

  // Calculate overall metrics from all prompts
  const overallMetrics = useMemo(() => {
    const allResults = Object.values(promptResults)
      .filter(r => r && r.results.length > 0)
      .flatMap(r => r.results);

    if (allResults.length === 0) {
      return {
        totalPrompts: topics.reduce((sum, t) => sum + t.prompts.length, 0),
        promptsRun: 0,
        totalResponses: 0,
        brandVisibility: 0,
        avgPosition: 0,
        avgSentiment: 0,
        competitorsFound: 0,
        totalCitations: 0,
      };
    }

    // Calculate metrics
    const brandMentions = allResults.filter(r => r.brandMentioned).length;
    const brandVisibility = (brandMentions / allResults.length) * 100;
    
    const positions = allResults
      .filter(r => r.brandPosition && r.brandPosition < 999)
      .map(r => r.brandPosition!);
    const avgPosition = positions.length > 0 
      ? positions.reduce((a, b) => a + b, 0) / positions.length 
      : 0;

    const sentiments = allResults.filter(r => r.sentimentScore !== undefined);
    const avgSentiment = sentiments.length > 0
      ? sentiments.reduce((sum, r) => sum + r.sentimentScore!, 0) / sentiments.length
      : 0;

    const competitorsSet = new Set<string>();
    allResults.forEach(r => {
      r.competitors?.forEach(comp => competitorsSet.add(comp.name));
    });

    const totalCitations = allResults.reduce((sum, r) => sum + (r.citations?.length || 0), 0);

    return {
      totalPrompts: topics.reduce((sum, t) => sum + t.prompts.length, 0),
      promptsRun: Object.keys(promptResults).length,
      totalResponses: allResults.length,
      brandVisibility,
      avgPosition,
      avgSentiment,
      competitorsFound: competitorsSet.size,
      totalCitations,
    };
  }, [promptResults, topics]);

  // Calculate metrics for topics
  const topicsWithMetrics = useMemo(() => {
    return filteredTopics.map(topic => {
      const promptIds = topic.prompts.map(p => p.id);
      const topicResults = promptIds
        .map(id => promptResults[id])
        .filter(r => r && r.results.length > 0);
      
      // Calculate avg visibility
      let totalVisibility = 0;
      let visibilityCount = 0;
      
      topicResults.forEach(result => {
        result.results.forEach(r => {
          if (r.brandMentioned !== undefined) {
            totalVisibility += r.brandMentioned ? 100 : 0;
            visibilityCount++;
          }
        });
      });
      
      const avgVisibility = visibilityCount > 0 ? totalVisibility / visibilityCount : 0;
      
      // Get unique competitors mentioned
      const competitors = new Set<string>();
      topicResults.forEach(result => {
        result.results.forEach(r => {
          r.competitors?.forEach(comp => competitors.add(comp.name));
        });
      });
      
      // Check status
      const allPromptsRun = promptIds.every(id => promptResults[id]?.results?.length > 0);
      const somePromptsRun = promptIds.some(id => promptResults[id]?.results?.length > 0);
      const status = allPromptsRun ? 'complete' : somePromptsRun ? 'partial' : 'pending';
      
      return {
        ...topic,
        avgVisibility,
        competitorsCount: competitors.size,
        status,
      };
    });
  }, [filteredTopics, promptResults]);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/login');
    }
  }, [session, sessionLoading, router]);

  // Toggle topic expansion
  const toggleTopic = (topicId: string) => {
    setExpandedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  // Add topic
  const handleAddTopic = async () => {
    if (!newTopicName.trim()) return;
    
    try {
      if (!analyses || analyses.length === 0) {
        toast.error('No analysis found. Please run an analysis first.');
        return;
      }

      const newTopic: BrandTopic = {
        id: `topic-${Date.now()}`,
        name: newTopicName.trim(),
        location: newTopicLocation.trim() || undefined,
        createdAt: new Date().toISOString(),
        prompts: [],
      };

      const response = await fetch('/api/brand-monitor/prompts/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newTopic }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add topic' }));
        throw new Error(errorData.message || 'Failed to add topic');
      }

      setNewTopicName('');
      setNewTopicLocation('');
      setTopicDialogOpen(false);
      setEditingTopic(null);
      
      await refetchAnalyses();
      
      toast.success('Topic added successfully!');
    } catch (error) {
      console.error('Error adding topic:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add topic');
    }
  };

  // Delete topic
  const handleDeleteTopic = async (topicId: string) => {
    toast.promise(
      (async () => {
        const response = await fetch('/api/brand-monitor/prompts/topics', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicId }),
        });

        if (!response.ok) {
          throw new Error('Failed to delete topic');
        }

        await refetchAnalyses();
      })(),
      {
        loading: 'Deleting topic...',
        success: 'Topic deleted successfully!',
        error: 'Failed to delete topic',
      }
    );
  };

  // Add prompt to topic
  const handleAddPrompt = async () => {
    if (!newPrompt.trim() || !selectedTopicId) return;
    
    try {
      if (!analyses || analyses.length === 0) {
        toast.error('No analysis found');
        return;
      }

      const newPromptObj: BrandPrompt = {
        id: `prompt-${Date.now()}`,
        prompt: newPrompt.trim(),
        topicId: selectedTopicId,
      };

      const response = await fetch('/api/brand-monitor/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: newPromptObj }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add prompt' }));
        throw new Error(errorData.message || 'Failed to add prompt');
      }

      setNewPrompt('');
      setPromptDialogOpen(false);
      setEditingPrompt(null);
      
      await refetchAnalyses();
      
      toast.success('Prompt added successfully!');
    } catch (error) {
      console.error('Error adding prompt:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add prompt');
    }
  };

  // Delete prompt
  const handleDeletePrompt = async (promptId: string) => {
    toast.promise(
      (async () => {
        const response = await fetch('/api/brand-monitor/prompts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptId }),
        });

        if (!response.ok) {
          throw new Error('Failed to delete prompt');
        }

        await refetchAnalyses();
      })(),
      {
        loading: 'Deleting prompt...',
        success: 'Prompt deleted successfully!',
        error: 'Failed to delete prompt',
      }
    );
  };

  // Copy prompt
  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast.success('Copied to clipboard!');
  };

  // Open results modal
  const handleViewResults = (promptId: string, promptText: string) => {
    const result = promptResults[promptId];
    if (result) {
      setSelectedPromptResult({ prompt: promptText, result });
      setResultsModalOpen(true);
    }
  };

  // Run single prompt
  const handleRunPrompt = async (promptId: string) => {
    if (!analyses || analyses.length === 0) {
      toast.error('No analysis found');
      return;
    }

    setRunningPrompts(prev => new Set(prev).add(promptId));
    const toastId = toast.loading('Running prompt...');
    
    try {
      const response = await fetch('/api/brand-monitor/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptIds: [promptId] }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to run prompt' }));
        throw new Error(errorData.message || 'Failed to run prompt');
      }

      const data = await response.json();
      
      const resultsMap: Record<string, PromptResult> = {};
      data.results.forEach((result: PromptResult) => {
        resultsMap[result.promptId] = result;
      });
      
      setPromptResults(prev => ({ ...prev, ...resultsMap }));
      toast.success('Prompt completed!', { id: toastId });
    } catch (error) {
      console.error('Error running prompt:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run prompt', { id: toastId });
    } finally {
      setRunningPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
    }
  };

  // Run all prompts across all topics
  const handleRunAllPrompts = async () => {
    if (!topics || topics.length === 0) {
      toast.error('No topics found. Please add topics first.');
      return;
    }

    const allPromptIds = topics.flatMap(t => t.prompts.map(p => p.id));
    
    if (allPromptIds.length === 0) {
      toast.error('No prompts found. Please add prompts first.');
      return;
    }

    setRunningPrompts(new Set(allPromptIds));
    setRunAllLoading(true);
    const toastId = toast.loading(`Running ${allPromptIds.length} prompts across ${topics.length} topics...`);
    
    try {
      const response = await fetch('/api/brand-monitor/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptIds: allPromptIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to run prompts' }));
        throw new Error(errorData.message || 'Failed to run prompts');
      }

      const data = await response.json();
      
      const resultsMap: Record<string, PromptResult> = {};
      data.results.forEach((result: PromptResult) => {
        resultsMap[result.promptId] = result;
      });
      
      setPromptResults(prev => ({ ...prev, ...resultsMap }));
      toast.success(`Successfully completed ${allPromptIds.length} prompts!`, { id: toastId });
    } catch (error) {
      console.error('Error running prompts:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run prompts', { id: toastId });
    } finally {
      setRunningPrompts(new Set());
      setRunAllLoading(false);
    }
  };

  // Run all prompts in a topic
  const handleRunTopicPrompts = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic || topic.prompts.length === 0) return;

    const promptIds = topic.prompts.map(p => p.id);
    setRunningPrompts(prev => new Set([...prev, ...promptIds]));
    
    const toastId = toast.loading(`Running ${promptIds.length} prompts...`);
    
    try {
      const response = await fetch('/api/brand-monitor/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to run prompts' }));
        throw new Error(errorData.message || 'Failed to run prompts');
      }

      const data = await response.json();
      
      const resultsMap: Record<string, PromptResult> = {};
      data.results.forEach((result: PromptResult) => {
        resultsMap[result.promptId] = result;
      });
      
      setPromptResults(prev => ({ ...prev, ...resultsMap }));
      toast.success(`Completed ${promptIds.length} prompts!`, { id: toastId });
    } catch (error) {
      console.error('Error running prompts:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run prompts', { id: toastId });
    } finally {
      setRunningPrompts(prev => {
        const newSet = new Set(prev);
        promptIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  // Generate topics with AI
  const handleGenerateTopics = async () => {
    if (!companyInfo || !companyInfo.name) {
      toast.error('Please run an analysis first to identify your company.');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/brand-monitor/generate-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyInfo.name,
          companyUrl: companyInfo.url || '',
          count: parseInt(generateCount),
          promptsPerTopic: 5,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate topics');
      }

      const data = await response.json();
      setGeneratedTopics(data.topics || []);
      setSelectedGeneratedTopics(new Set(data.topics.map((t: BrandTopic) => t.id)));
      toast.success(`Generated ${data.topics?.length || 0} topics!`);
    } catch (error) {
      console.error('Error generating topics:', error);
      toast.error('Failed to generate topics');
    } finally {
      setGenerating(false);
    }
  };

  // Add generated topics
  const handleAddGeneratedTopics = async () => {
    try {
      const topicsToAdd = generatedTopics.filter(t => selectedGeneratedTopics.has(t.id));
      
      if (topicsToAdd.length === 0) return;

      if (!analyses || analyses.length === 0) {
        toast.error('No analysis found');
        return;
      }

      setGenerating(true);
      
      const response = await fetch('/api/brand-monitor/prompts/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: topicsToAdd }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add topics' }));
        throw new Error(errorData.message || 'Failed to add topics');
      }

      setGenerateDialogOpen(false);
      setGeneratedTopics([]);
      setSelectedGeneratedTopics(new Set());
      
      await refetchAnalyses();
      
      toast.success(`Successfully added ${topicsToAdd.length} topic(s)!`);
    } catch (error) {
      console.error('Error adding topics:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add topics');
    } finally {
      setGenerating(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const loading = analysesLoading;

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Prompts' }]}>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Prompts</h1>
            <p className="text-muted-foreground mt-1">
              Manage topics and prompts to track your brand visibility
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setGenerateDialogOpen(true)}
              className="bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
              disabled={runAllLoading}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Topics
            </Button>
            
            <Button 
              onClick={() => {
                setEditingTopic(null);
                setNewTopicName('');
                setNewTopicLocation('');
                setTopicDialogOpen(true);
              }}
              className="bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
              variant="outline"
              disabled={runAllLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Topic
            </Button>

            <Button 
              onClick={handleRunAllPrompts}
              disabled={runAllLoading || topics.length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {runAllLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run All Prompts
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Overall Metrics Summary */}
        {overallMetrics.totalPrompts > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Brand Visibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {overallMetrics.brandVisibility.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {overallMetrics.totalResponses} responses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Prompts Executed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {overallMetrics.promptsRun}/{overallMetrics.totalPrompts}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((overallMetrics.promptsRun / overallMetrics.totalPrompts) * 100).toFixed(0)}% complete
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Competitors Found
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overallMetrics.competitorsFound}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Unique competitors mentioned
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Sentiment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {overallMetrics.avgSentiment > 0 ? overallMetrics.avgSentiment.toFixed(0) : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overallMetrics.avgPosition > 0 && `Avg Position: #${overallMetrics.avgPosition.toFixed(1)}`}
                  {overallMetrics.avgPosition === 0 && 'Out of 100'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Topic Dialog */}
        <Dialog open={topicDialogOpen} onOpenChange={setTopicDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTopic ? 'Edit Topic' : 'Add New Topic'}</DialogTitle>
              <DialogDescription>
                Create a topic to organize related prompts about your business.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="topicName">Topic Name</Label>
                <Input
                  id="topicName"
                  placeholder="E.g., Business Credit Cards (India)"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topicLocation">Location (Optional)</Label>
                <Input
                  id="topicLocation"
                  placeholder="E.g., IN, US, Global"
                  value={newTopicLocation}
                  onChange={(e) => setNewTopicLocation(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setTopicDialogOpen(false)}
                className="bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddTopic} 
                disabled={!newTopicName.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {editingTopic ? 'Update' : 'Add'} Topic
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Generate Topics Dialog */}
        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate Topics with AI
              </DialogTitle>
              <DialogDescription>
                Let AI generate relevant topics and prompts for tracking your brand visibility.
              </DialogDescription>
            </DialogHeader>

            {generatedTopics.length === 0 ? (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="topic-count">Number of Topics</Label>
                  <Select value={generateCount} onValueChange={setGenerateCount}>
                    <SelectTrigger id="topic-count">
                      <SelectValue placeholder="Select count" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 topics (5 prompts each)</SelectItem>
                      <SelectItem value="5">5 topics (5 prompts each)</SelectItem>
                      <SelectItem value="7">7 topics (5 prompts each)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-medium">AI will generate topics based on:</h4>
                  {companyInfo && companyInfo.name ? (
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Your company: <span className="font-medium text-foreground">{companyInfo.name}</span></li>
                      <li>• URL: <span className="font-medium text-foreground">{companyInfo.url || 'Not set'}</span></li>
                      <li>• Competitors: <span className="font-medium text-foreground">{companyInfo.competitors.length} identified</span></li>
                    </ul>
                  ) : (
                    <p className="text-sm text-amber-600">
                      ⚠️ No company analysis found. Please run an analysis first.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto py-4">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Select the topics you want to add ({selectedGeneratedTopics.size} of {generatedTopics.length} selected)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedGeneratedTopics(new Set(generatedTopics.map(t => t.id)))}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedGeneratedTopics(new Set())}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {generatedTopics.map((topic) => {
                    const isSelected = selectedGeneratedTopics.has(topic.id);
                    
                    return (
                      <div
                        key={topic.id}
                        onClick={() => {
                          const newSelected = new Set(selectedGeneratedTopics);
                          if (newSelected.has(topic.id)) {
                            newSelected.delete(topic.id);
                          } else {
                            newSelected.add(topic.id);
                          }
                          setSelectedGeneratedTopics(newSelected);
                        }}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected 
                              ? 'border-primary bg-primary text-primary-foreground' 
                              : 'border-muted-foreground'
                          }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{topic.name}</p>
                              {topic.location && (
                                <Badge variant="outline" className="gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {topic.location}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">{topic.prompts.length} prompts:</p>
                              {topic.prompts.slice(0, 3).map((prompt, idx) => (
                                <p key={idx} className="text-sm text-muted-foreground pl-2">• {prompt.prompt}</p>
                              ))}
                              {topic.prompts.length > 3 && (
                                <p className="text-xs text-muted-foreground pl-2">...and {topic.prompts.length - 3} more</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter>
              {generatedTopics.length === 0 ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setGenerateDialogOpen(false)}
                    disabled={generating}
                    className="bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleGenerateTopics}
                    disabled={generating}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Topics
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setGeneratedTopics([]);
                      setSelectedGeneratedTopics(new Set());
                    }}
                    className="bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                  <Button 
                    onClick={handleAddGeneratedTopics}
                    disabled={selectedGeneratedTopics.size === 0}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add {selectedGeneratedTopics.size} Topic{selectedGeneratedTopics.size !== 1 ? 's' : ''}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Prompt Dialog */}
        <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}</DialogTitle>
              <DialogDescription>
                Add a prompt to track your brand visibility.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="E.g., What are the best business credit cards in India?"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setPromptDialogOpen(false)}
                className="bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddPrompt} 
                disabled={!newPrompt.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {editingPrompt ? 'Update' : 'Add'} Prompt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Search and Provider Filter */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search topics or prompts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="chatgpt">ChatGPT</SelectItem>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="perplexity">Perplexity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading topics...</p>
              </div>
            ) : topicsWithMetrics.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {topics.length === 0 ? 'No topics yet' : 'No matching topics'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {topics.length === 0 
                    ? 'Get started by generating topics or adding them manually.'
                    : 'Try adjusting your search criteria.'
                  }
                </p>
                {topics.length === 0 && (
                  <div className="flex gap-3 justify-center">
                    <Button 
                      variant="outline" 
                      onClick={() => setGenerateDialogOpen(true)}
                      className="bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Topics
                    </Button>
                    <Button 
                      onClick={() => setTopicDialogOpen(true)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Manually
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                  <div className="col-span-1"></div>
                  <div className="col-span-3">Topic</div>
                  <div className="col-span-1 text-center">Prompts</div>
                  <div className="col-span-2 text-center">Avg Visibility</div>
                  <div className="col-span-2 text-center">Competitors</div>
                  <div className="col-span-1 text-center">Location</div>
                  <div className="col-span-1 text-center">Created</div>
                  <div className="col-span-1 text-center">Status</div>
                </div>

                {/* Topics */}
                {topicsWithMetrics.map((topic) => {
                  const isExpanded = expandedTopics.has(topic.id);
                  
                  return (
                    <div key={topic.id} className="border rounded-lg overflow-hidden">
                      {/* Topic Row */}
                      <div className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-muted/30 cursor-pointer items-center"
                        onClick={() => toggleTopic(topic.id)}
                      >
                        <div className="col-span-1">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="col-span-3 font-medium">{topic.name}</div>
                        <div className="col-span-1 text-center">
                          <Badge variant="secondary">{topic.prompts.length}</Badge>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="font-semibold">{topic.avgVisibility.toFixed(0)}%</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <div className="flex justify-center items-center gap-1">
                            {topic.competitorsCount > 0 && (
                              <>
                                <span className="text-2xl">🤖</span>
                                <span className="text-2xl">✨</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="col-span-1 text-center">
                          {topic.location && (
                            <Badge variant="outline" className="gap-1">
                              <MapPin className="h-3 w-3" />
                              {topic.location}
                            </Badge>
                          )}
                        </div>
                        <div className="col-span-1 text-center text-sm text-muted-foreground">
                          {topic.createdAt ? new Date(topic.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                        </div>
                        <div className="col-span-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {topic.status === 'complete' ? (
                              <Badge className="bg-green-50 text-green-700 border-green-200">Complete</Badge>
                            ) : topic.status === 'partial' ? (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                Partial
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted text-muted-foreground">
                                Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Prompts */}
                      {isExpanded && (
                        <div className="bg-muted/20 border-t">
                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">Prompts in this topic:</p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedTopicId(topic.id);
                                    setPromptDialogOpen(true);
                                  }}
                                  className="bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Prompt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteTopic(topic.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            
                            {topic.prompts.map((prompt) => {
                              const result = promptResults[prompt.id];
                              const isRunning = runningPrompts.has(prompt.id);
                              const providerResults = result?.results || [];
                              const filteredResults = selectedProvider === 'all' 
                                ? providerResults 
                                : providerResults.filter(r => r.provider.toLowerCase() === selectedProvider.toLowerCase());

                              return (
                                <div key={prompt.id} className="bg-card border rounded-lg p-3">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1">
                                      <p className="text-sm">{prompt.prompt}</p>
                                      {filteredResults.length > 0 && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                          {filteredResults.map((r, idx) => (
                                            <Badge key={idx} variant="outline" className="gap-1">
                                              {r.provider}: {r.brandMentioned ? '✓' : '✗'}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {isRunning ? (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          Running...
                                        </Badge>
                                      ) : filteredResults.length > 0 ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleViewResults(prompt.id, prompt.prompt)}
                                          className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100 hover:text-green-800"
                                        >
                                          See →
                                        </Button>
                                      ) : null}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleCopyPrompt(prompt.prompt)}
                                        className="text-foreground hover:bg-accent hover:text-accent-foreground"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeletePrompt(prompt.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Modal */}
        <Dialog open={resultsModalOpen} onOpenChange={setResultsModalOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Prompt Results</DialogTitle>
              <DialogDescription className="text-sm">
                {selectedPromptResult?.prompt}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4">
              {selectedPromptResult?.result && (
                <Tabs defaultValue={selectedPromptResult.result.results[0]?.provider || ''} className="w-full">
                  <TabsList className="grid w-full" style={{ 
                    gridTemplateColumns: `repeat(${Math.min(selectedPromptResult.result.results.length, 4)}, minmax(0, 1fr))` 
                  }}>
                    {selectedPromptResult.result.results.map((r, idx) => (
                      <TabsTrigger key={idx} value={r.provider}>
                        {r.provider}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {selectedPromptResult.result.results.map((r, idx) => (
                    <TabsContent key={idx} value={r.provider} className="mt-4">
                      {r.error ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{r.error}</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-4">
                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-4">
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Brand Mentioned</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold">
                                  {r.brandMentioned ? (
                                    <span className="text-green-600">✓ Yes</span>
                                  ) : (
                                    <span className="text-red-600">✗ No</span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>

                            {r.brandPosition && (
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-xs text-muted-foreground">Position</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold">#{r.brandPosition}</div>
                                </CardContent>
                              </Card>
                            )}

                            {r.sentimentScore !== undefined && (
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-xs text-muted-foreground">Sentiment</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold">{r.sentimentScore}/100</div>
                                </CardContent>
                              </Card>
                            )}
                          </div>

                          {/* Response */}
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Response</h4>
                            <div className="bg-muted/50 rounded-lg p-4">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.response}</p>
                            </div>
                          </div>

                          {/* Competitors */}
                          {r.competitors && r.competitors.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Competitors Mentioned</h4>
                              <div className="flex flex-wrap gap-2">
                                {r.competitors.map((comp, cidx) => (
                                  <Badge key={cidx} variant="secondary">
                                    {comp.name}
                                    {comp.position && <span className="ml-1">#{comp.position}</span>}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Citations */}
                          {r.citations && r.citations.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">
                                Citations ({r.citations.length})
                              </h4>
                              <div className="space-y-2">
                                {r.citations.map((citation, cidx) => (
                                  <div key={cidx} className="p-3 bg-muted/30 rounded-lg">
                                    <a
                                      href={citation.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                                    >
                                      {citation.title || citation.url}
                                      <ChevronRight className="h-3 w-3" />
                                    </a>
                                    {citation.mentionedCompanies && citation.mentionedCompanies.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {citation.mentionedCompanies.map((company, compIdx) => (
                                          <Badge key={compIdx} variant="outline" className="text-xs">
                                            {company}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setResultsModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
