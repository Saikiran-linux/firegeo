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
  TrendingUp, 
  GitCompare, 
  Lightbulb,
  Edit2,
  Trash2,
  Copy,
  Sparkles,
  Check,
  X,
  Play,
  AlertCircle
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
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

type PromptCategory = 'ranking' | 'comparison' | 'alternatives' | 'recommendations';

interface BrandPrompt {
  id: string;
  prompt: string;
  category: PromptCategory;
}

interface PromptResult {
  promptId: string;
  prompt: string;
  category: string;
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
    rankings?: Array<{
      position: number;
      company: string;
      reason?: string;
      sentiment?: string;
    }>;
  }[];
}

const categoryConfig = {
  ranking: { label: 'Ranking', icon: TrendingUp, color: 'bg-blue-500' },
  comparison: { label: 'Comparison', icon: GitCompare, color: 'bg-purple-500' },
  alternatives: { label: 'Alternatives', icon: Lightbulb, color: 'bg-amber-500' },
  recommendations: { label: 'Recommendations', icon: MessageSquare, color: 'bg-green-500' },
};

export default function PromptsPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const { data: analyses, isLoading: analysesLoading, refetch: refetchAnalyses } = useBrandAnalyses();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<BrandPrompt | null>(null);

  // Form state
  const [newPrompt, setNewPrompt] = useState('');
  const [newCategory, setNewCategory] = useState<PromptCategory>('ranking');

  // Generate prompts state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<BrandPrompt[]>([]);
  const [selectedGenerated, setSelectedGenerated] = useState<Set<string>>(new Set());
  const [generateCount, setGenerateCount] = useState('10');
  const [generateCategory, setGenerateCategory] = useState<string>('all');

  // Prompt results state
  const [promptResults, setPromptResults] = useState<Record<string, PromptResult>>({});
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());
  const [runAllLoading, setRunAllLoading] = useState(false);
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get prompts from latest analysis (prioritize promptResults if available)
  const prompts = useMemo(() => {
    if (!analyses || analyses.length === 0) return [];
    const latestAnalysis = analyses[0];
    
    // Check if we have stored prompts in the analysis data
    const storedPrompts = (latestAnalysis.analysisData as any)?.prompts || [];
    
    // Ensure prompts are properly formatted and have valid categories
    return storedPrompts.filter((prompt: any) => {
      return prompt && 
             typeof prompt === 'object' && 
             prompt.id && 
             prompt.prompt && 
             prompt.category &&
             ['ranking', 'comparison', 'alternatives', 'recommendations'].includes(prompt.category);
    }) as BrandPrompt[];
  }, [analyses]);

  // Get company info from latest analysis for running prompts
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

  // Filter prompts
  const filteredPrompts = useMemo(() => {
    return prompts.filter((prompt) => {
      const matchesSearch = prompt.prompt.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || prompt.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [prompts, searchQuery, filterCategory]);

  // Group prompts by category
  const groupedPrompts = useMemo(() => {
    const groups: Record<PromptCategory, BrandPrompt[]> = {
      ranking: [],
      comparison: [],
      alternatives: [],
      recommendations: [],
    };

    filteredPrompts.forEach((prompt) => {
      // Only add to group if category exists and is valid
      if (prompt.category && groups[prompt.category]) {
        groups[prompt.category].push(prompt);
      }
    });

    return groups;
  }, [filteredPrompts]);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/login');
    }
  }, [session, sessionLoading, router]);

  const handleAddPrompt = async () => {
    if (!newPrompt.trim()) return;
    
    try {
      // Check if analysis exists
      if (!analyses || analyses.length === 0) {
        toast.error('No analysis found. Please run an analysis from the Brand Monitor page first.');
        return;
      }

      const newPromptObj: BrandPrompt = {
        id: `custom-${Date.now()}`,
        prompt: newPrompt.trim(),
        category: newCategory,
      };

      const response = await fetch('/api/brand-monitor/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: [newPromptObj] }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add prompt' }));
        throw new Error(errorData.message || 'Failed to add prompt');
      }

      // Reset form and close dialog
      setNewPrompt('');
      setNewCategory('ranking');
      setDialogOpen(false);
      setEditingPrompt(null);
      
      // Refresh the analyses data to show new prompt
      await refetchAnalyses();
      
      toast.success('Prompt added successfully!');
    } catch (error) {
      console.error('Error adding prompt:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add prompt. Please try again.');
    }
  };

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast.success('Copied to clipboard!');
  };

  const handleEditPrompt = (prompt: BrandPrompt) => {
    setEditingPrompt(prompt);
    setNewPrompt(prompt.prompt);
    setNewCategory(prompt.category);
    setDialogOpen(true);
  };

  const handleDeletePrompt = async (promptId: string) => {
    toast.promise(
      (async () => {
        // Delete from database via API
        const response = await fetch('/api/brand-monitor/prompts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptId }),
        });

        if (!response.ok) {
          throw new Error('Failed to delete prompt');
        }

        // Refresh the analyses data to reflect the deletion
        await refetchAnalyses();
      })(),
      {
        loading: 'Deleting prompt...',
        success: 'Prompt deleted successfully!',
        error: 'Failed to delete prompt. Please try again.',
      }
    );
  };

  const handleGeneratePrompts = async () => {
    if (!companyInfo || !companyInfo.name) {
      toast.error('Please run an analysis from the Brand Monitor page first to identify your company.');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/brand-monitor/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyInfo.name,
          companyUrl: companyInfo.url || '',
          industry: analyses?.[0]?.industry || '',
          count: parseInt(generateCount),
          category: generateCategory === 'all' ? undefined : generateCategory,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate prompts');
      }

      const data = await response.json();
      setGeneratedPrompts(data.prompts || []);
      setSelectedGenerated(new Set(data.prompts.map((p: BrandPrompt) => p.id)));
      toast.success(`Generated ${data.prompts?.length || 0} prompts!`);
    } catch (error) {
      console.error('Error generating prompts:', error);
      toast.error('Failed to generate prompts. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleGeneratedPrompt = (promptId: string) => {
    const newSelected = new Set(selectedGenerated);
    if (newSelected.has(promptId)) {
      newSelected.delete(promptId);
    } else {
      newSelected.add(promptId);
    }
    setSelectedGenerated(newSelected);
  };

  const handleAddGeneratedPrompts = async () => {
    try {
      const promptsToAdd = generatedPrompts.filter(p => selectedGenerated.has(p.id));
      
      if (promptsToAdd.length === 0) {
        return;
      }

      // Check if analysis exists
      if (!analyses || analyses.length === 0) {
        toast.error('No analysis found. Please run an analysis from the Brand Monitor page first.');
        return;
      }

      setGenerating(true);
      
      const response = await fetch('/api/brand-monitor/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: promptsToAdd }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add prompts' }));
        throw new Error(errorData.message || 'Failed to add prompts');
      }

      const data = await response.json();
      console.log('Prompts added successfully:', data);

      // Close dialog and reset state
      setGenerateDialogOpen(false);
      setGeneratedPrompts([]);
      setSelectedGenerated(new Set());
      
      // Refresh the prompts list by refetching analyses
      await refetchAnalyses();
      
      toast.success(`Successfully added ${data.addedCount || promptsToAdd.length} prompt(s)!`);
    } catch (error) {
      console.error('Error adding prompts:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add prompts. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRunPrompt = async (promptId: string) => {
    // Check if analysis exists
    if (!analyses || analyses.length === 0) {
      toast.error('No analysis found. Please run an analysis from the Brand Monitor page first.');
      return;
    }

    setRunningPrompts(prev => new Set(prev).add(promptId));
    const toastId = toast.loading('Running prompt across all providers...');
    
    try {
      const response = await fetch('/api/brand-monitor/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to run prompts' }));
        throw new Error(errorData.message || 'Failed to run prompts');
      }

      const data = await response.json();
      
      // Update results
      const resultsMap: Record<string, PromptResult> = {};
      data.results.forEach((result: PromptResult) => {
        resultsMap[result.promptId] = result;
      });
      
      setPromptResults(prev => ({ ...prev, ...resultsMap }));
      toast.success('Prompt completed successfully!', { id: toastId });
    } catch (error) {
      console.error('Error running prompt:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run prompt. Please try again.', { id: toastId });
    } finally {
      setRunningPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
    }
  };

  const handleRunAllPrompts = async () => {
    // Check if analysis exists
    if (!analyses || analyses.length === 0) {
      toast.error('No analysis found. Please run an analysis from the Brand Monitor page first.');
      return;
    }

    setRunAllLoading(true);
    setRunProgress({ current: 0, total: filteredPrompts.length });
    
    // Mark all prompts as running
    const allPromptIds = new Set(filteredPrompts.map(p => p.id));
    setRunningPrompts(allPromptIds);
    
    const toastId = toast.loading(`Running ${filteredPrompts.length} prompts across all providers...`);
    
    try {
      const response = await fetch('/api/brand-monitor/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptIds: filteredPrompts.map(p => p.id)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to run prompts' }));
        throw new Error(errorData.message || 'Failed to run prompts');
      }

      const data = await response.json();
      
      // Update results
      const resultsMap: Record<string, PromptResult> = {};
      data.results.forEach((result: PromptResult) => {
        resultsMap[result.promptId] = result;
      });
      
      setPromptResults(resultsMap);
      setRunProgress({ current: filteredPrompts.length, total: filteredPrompts.length });
      toast.success(`Successfully ran ${filteredPrompts.length} prompts!`, { id: toastId });
    } catch (error) {
      console.error('Error running all prompts:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run prompts. Please try again.', { id: toastId });
    } finally {
      setRunAllLoading(false);
      setRunningPrompts(new Set());
      progressTimeoutRef.current = setTimeout(() => setRunProgress(null), 2000); // Clear progress after 2s
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
              Manage prompts used to track your brand visibility across AI platforms
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setGenerateDialogOpen(true)}
              className="bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Prompts
            </Button>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingPrompt(null);
                  setNewPrompt('');
                  setNewCategory('ranking');
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}</DialogTitle>
                <DialogDescription>
                  Create a prompt to test how AI platforms respond to queries about your brand.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={newCategory} onValueChange={(value) => setNewCategory(value as PromptCategory)}>
                    <SelectTrigger id="category" className="bg-background text-foreground border-input">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt</Label>
                  <Textarea
                    id="prompt"
                    placeholder="E.g., What are the best deployment platforms for Next.js applications?"
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    rows={4}
                    className="resize-none bg-background text-foreground border-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Write a natural question that users might ask AI platforms about your industry.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  className="bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
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
          </div>
        </div>

        {/* Generate Prompts Dialog */}
        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate Prompts with AI
              </DialogTitle>
              <DialogDescription>
                Let AI generate relevant prompts for tracking your brand visibility based on your company and industry.
              </DialogDescription>
            </DialogHeader>

            {generatedPrompts.length === 0 ? (
              // Generation Form
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt-count">Number of Prompts</Label>
                    <Select value={generateCount} onValueChange={setGenerateCount}>
                      <SelectTrigger id="prompt-count" className="bg-background text-foreground border-input">
                        <SelectValue placeholder="Select count" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 prompts</SelectItem>
                        <SelectItem value="10">10 prompts</SelectItem>
                        <SelectItem value="15">15 prompts</SelectItem>
                        <SelectItem value="20">20 prompts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gen-category">Category Focus</Label>
                    <Select value={generateCategory} onValueChange={setGenerateCategory}>
                      <SelectTrigger id="gen-category" className="bg-background text-foreground border-input">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {Object.entries(categoryConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-medium">AI will generate prompts based on:</h4>
                  {companyInfo && companyInfo.name ? (
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Your company: <span className="font-medium text-foreground">{companyInfo.name}</span></li>
                      <li>• URL: <span className="font-medium text-foreground">{companyInfo.url || 'Not set'}</span></li>
                      <li>• Competitors: <span className="font-medium text-foreground">{companyInfo.competitors.length} identified</span></li>
                    </ul>
                  ) : (
                    <p className="text-sm text-amber-600">
                      ⚠️ No company analysis found. Please run an analysis from the Brand Monitor page first.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              // Generated Prompts Selection
              <div className="flex-1 overflow-auto py-4">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Select the prompts you want to add ({selectedGenerated.size} of {generatedPrompts.length} selected)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedGenerated(new Set(generatedPrompts.map(p => p.id)))}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedGenerated(new Set())}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {generatedPrompts.map((prompt) => {
                    const config = categoryConfig[prompt.category];
                    const isSelected = selectedGenerated.has(prompt.id);
                    
                    return (
                      <div
                        key={prompt.id}
                        onClick={() => toggleGeneratedPrompt(prompt.id)}
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
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <config.icon className="h-3 w-3" />
                                <span className="text-xs">{config.label}</span>
                              </Badge>
                            </div>
                            <p className="text-sm">{prompt.prompt}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter>
              {generatedPrompts.length === 0 ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setGenerateDialogOpen(false)}
                    disabled={generating}
                    className="bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleGeneratePrompts}
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
                        Generate Prompts
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setGeneratedPrompts([]);
                      setSelectedGenerated(new Set());
                    }}
                    className="bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                  <Button 
                    onClick={handleAddGeneratedPrompts}
                    disabled={selectedGenerated.size === 0}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add {selectedGenerated.size} Prompt{selectedGenerated.size !== 1 ? 's' : ''}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Prompts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{prompts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all categories
              </p>
            </CardContent>
          </Card>

          {Object.entries(categoryConfig).slice(0, 3).map(([key, config]) => {
            const count = groupedPrompts[key as PromptCategory].length;
            return (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <config.icon className="h-4 w-4" />
                    {config.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{count}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {count === 1 ? 'prompt' : 'prompts'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search and Filter with Run All Button */}
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search prompts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-background text-foreground border-input"
                    />
                  </div>
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[200px] bg-background text-foreground border-input">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-3">
                  {runProgress && (
                    <div className="text-sm text-muted-foreground">
                      Running prompts across all providers...
                    </div>
                  )}
                  <Button 
                    onClick={handleRunAllPrompts}
                    disabled={runAllLoading || filteredPrompts.length === 0}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {runAllLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Run All
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="min-h-[600px] max-h-[800px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading prompts...</p>
                </div>
              ) : filteredPrompts.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {prompts.length === 0 ? 'No prompts yet' : 'No matching prompts'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {prompts.length === 0 
                      ? 'Get started by generating prompts or adding them manually.'
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                  {prompts.length === 0 && (
                    <div className="flex gap-3 justify-center">
                      <Button variant="outline" onClick={() => setGenerateDialogOpen(true)}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Prompts
                      </Button>
                      <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Manually
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {filteredPrompts.map((prompt) => {
                  const config = categoryConfig[prompt.category];
                  const result = promptResults[prompt.id];
                  const isRunning = runningPrompts.has(prompt.id);

                  return (
                    <AccordionItem key={prompt.id} value={prompt.id}>
                      <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 rounded-lg transition-colors group">
                        <div className="flex-1 text-left flex items-center gap-3">
                          <Badge variant="secondary" className="flex items-center gap-1 w-[140px] justify-center shrink-0">
                            <config.icon className="h-3 w-3" />
                            <span className="text-xs">{config.label}</span>
                          </Badge>
                          <span className="text-sm font-medium line-clamp-2">{prompt.prompt}</span>
                          {isRunning && (
                            <Badge variant="outline" className="ml-auto bg-blue-50 text-blue-700 border-blue-300 animate-pulse">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Running...
                            </Badge>
                          )}
                          {!isRunning && result && result.results.length > 0 && (
                            <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-300">
                              <Check className="h-3 w-3 mr-1" />
                              {result.results.length} providers
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-auto pl-4" onClick={(e) => e.stopPropagation()}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunPrompt(prompt.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                handleRunPrompt(prompt.id);
                              }
                            }}
                            title="Run this prompt"
                            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 px-3 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground ${isRunning ? 'pointer-events-none opacity-50' : ''}`}
                          >
                            {isRunning ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPrompt(prompt.prompt);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                handleCopyPrompt(prompt.prompt);
                              }
                            }}
                            title="Copy prompt"
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 px-3 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground"
                          >
                            <Copy className="h-4 w-4" />
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPrompt(prompt);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                handleEditPrompt(prompt);
                              }
                            }}
                            title="Edit prompt"
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 px-3 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground"
                          >
                            <Edit2 className="h-4 w-4" />
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePrompt(prompt.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                handleDeletePrompt(prompt.id);
                              }
                            }}
                            title="Delete prompt"
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 px-3 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 py-4 bg-muted/30 rounded-b-lg">
                        <div className="space-y-4">
                          {result && result.results.length > 0 ? (
                            <div>
                              <h4 className="text-sm font-semibold mb-3">Results from AI Providers:</h4>
                              <Tabs defaultValue={result.results[0]?.provider || ''} className="w-full">
                                <TabsList className="grid w-full gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(result.results.length, 4)}, 1fr)` }}>
                                  {result.results.map((providerResult, index) => (
                                    <TabsTrigger 
                                      key={index} 
                                      value={providerResult.provider}
                                      className="text-xs"
                                    >
                                      {providerResult.provider}
                                    </TabsTrigger>
                                  ))}
                                </TabsList>
                                {result.results.map((providerResult, index) => (
                                  <TabsContent 
                                    key={index}
                                    value={providerResult.provider}
                                    className="space-y-3"
                                  >
                                    {providerResult.error ? (
                                      <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                          {providerResult.error}
                                        </AlertDescription>
                                      </Alert>
                                    ) : (
                                      <div className="space-y-3">
                                        <div className="bg-card border rounded-lg p-4">
                                          <p className="text-sm text-foreground whitespace-pre-wrap">
                                            {providerResult.response}
                                          </p>
                                        </div>
                                        
                                        {/* Sources Section */}
                                        {providerResult.sources && providerResult.sources.length > 0 && (
                                          <div className="bg-muted/50 border rounded-lg p-4">
                                            <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                              <span>🔍</span> Sources ({providerResult.sources.length})
                                            </h5>
                                            <div className="space-y-2">
                                              {providerResult.sources.slice(0, 5).map((source, idx) => (
                                                <div key={idx} className="text-xs">
                                                  <a 
                                                    href={source.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline font-medium"
                                                  >
                                                    {source.title || source.url}
                                                  </a>
                                                  {source.snippet && (
                                                    <p className="text-muted-foreground mt-1 line-clamp-2">
                                                      {source.snippet}
                                                    </p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Citations Section */}
                                        {providerResult.citations && providerResult.citations.length > 0 && (
                                          <div className="bg-muted/50 border rounded-lg p-4">
                                            <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                              <span>📚</span> Citations ({providerResult.citations.length})
                                            </h5>
                                            <div className="space-y-2">
                                              {providerResult.citations.slice(0, 5).map((citation, idx) => (
                                                <div key={idx} className="text-xs">
                                                  <a 
                                                    href={citation.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline font-medium"
                                                  >
                                                    {citation.title || citation.source || citation.url}
                                                  </a>
                                                  {citation.mentionedCompanies && citation.mentionedCompanies.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                      {citation.mentionedCompanies.map((company) => (
                                                        <Badge key={company} variant="outline" className="text-xs">
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
                                        
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                          <span>{new Date(providerResult.timestamp).toLocaleString()}</span>
                                          <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => handleCopyPrompt(providerResult.response)}
                                            className="gap-1"
                                          >
                                            <Copy className="h-3 w-3" />
                                            Copy
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </TabsContent>
                                ))}
                              </Tabs>
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">
                                No results yet. Click "Run This Prompt" to get responses from AI providers.
                              </p>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
                </Accordion>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Prompts by Category */}
        {!loading && prompts.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(categoryConfig).map(([category, config]) => {
              const categoryPrompts = groupedPrompts[category as PromptCategory];
              if (categoryPrompts.length === 0) return null;

              return (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${config.color}`} />
                      {config.label}
                      <Badge variant="secondary" className="ml-auto">
                        {categoryPrompts.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Prompts in the {config.label.toLowerCase()} category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {categoryPrompts.slice(0, 5).map((prompt) => (
                        <div
                          key={prompt.id}
                          className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <p className="text-sm">{prompt.prompt}</p>
                        </div>
                      ))}
                      {categoryPrompts.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{categoryPrompts.length - 5} more prompts
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
