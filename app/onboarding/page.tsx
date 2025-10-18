'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Globe, X, Plus, Sparkles, RefreshCw, Edit2, Check, SkipForward } from 'lucide-react';
import { toast } from 'sonner';

type OnboardingStep = 'website' | 'description' | 'prompts' | 'competitors' | 'analysis';

interface Competitor {
  name: string;
  url: string;
  logo?: string;
}

// Topics will be dynamically generated based on company info

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('website');
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]); // Array of prompt IDs
  const [generatedPrompts, setGeneratedPrompts] = useState<Record<string, Array<{id: string; prompt: string; category: string}>>>({});
  const [allPromptsData, setAllPromptsData] = useState<Array<{id: string; prompt: string; category: string}>>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('');
  
  // Editing states
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingPromptText, setEditingPromptText] = useState('');
  const [findingCompetitors, setFindingCompetitors] = useState(false);
  const [editingCompetitorIndex, setEditingCompetitorIndex] = useState<number | null>(null);
  const [editingCompetitorUrl, setEditingCompetitorUrl] = useState('');

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/login');
    }
  }, [session, sessionLoading, router]);

  const handleContinue = async () => {
    if (currentStep === 'website') {
      if (!websiteUrl.trim()) {
        toast.error('Please enter a website URL');
        return;
      }
      
      // Auto-generate business description using Firecrawl
      setLoading(true);
      toast.loading('Analyzing your website...');
      try {
        const response = await fetch('/api/brand-monitor/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: websiteUrl }),
        });
        
        toast.dismiss();
        
        if (response.ok) {
          const data = await response.json();
          setBusinessDescription(data.company?.description || '');
          toast.success('Website analyzed successfully!');
        } else {
          throw new Error('Failed to analyze website');
        }
      } catch (error) {
        toast.dismiss();
        console.error('Error scraping website:', error);
        toast.error('Could not analyze website. You can enter the description manually.');
      } finally {
        setLoading(false);
      }
      
      setCurrentStep('description');
    } else if (currentStep === 'description') {
      if (!businessDescription.trim()) {
        toast.error('Please provide a business description');
        return;
      }
      
      // Generate prompts using Claude
      setLoading(true);
      toast.loading('Generating prompts...');
      try {
        const response = await fetch('/api/brand-monitor/generate-prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: extractCompanyName(websiteUrl),
            companyUrl: websiteUrl,
            businessContext: businessDescription.trim(), // Send full description for better prompt generation
            count: 10,
          }),
        });
        
        toast.dismiss();
        
        if (response.ok) {
          const data = await response.json();
          
          // Store all prompts data with categories
          setAllPromptsData(data.prompts);
          
          // Group prompts by category for display (store full objects, not just strings)
          const grouped: Record<string, Array<{id: string; prompt: string; category: string}>> = {};
          const categoryLabels: Record<string, string> = {
            'ranking': '📊 Ranking',
            'comparison': '⚖️ Comparison',
            'alternatives': '💡 Alternatives',
            'recommendations': '⭐ Recommendations',
          };
          data.prompts.forEach((p: any) => {
            const categoryLabel = categoryLabels[p.category as string] || 'Other';
            
            if (!grouped[categoryLabel]) {
              grouped[categoryLabel] = [];
            }
            grouped[categoryLabel].push({
              id: p.id,
              prompt: p.prompt,
              category: p.category,
            });
          });
          
          setGeneratedPrompts(grouped);
          
          // Auto-select all prompts by ID
          const allPromptIds = data.prompts.map((p: any) => p.id);
          setSelectedPrompts(allPromptIds);
          
          toast.success(`Generated ${allPromptIds.length} prompts across ${Object.keys(grouped).length} categories!`);
        } else {
          throw new Error('Failed to generate prompts');
        }
      } catch (error) {
        toast.dismiss();
        console.error('Error generating prompts:', error);
        toast.error('Could not generate prompts. Please try again.');
      } finally {
        setLoading(false);
      }
      
      setCurrentStep('prompts');
    } else if (currentStep === 'prompts') {
      if (selectedPrompts.length === 0) {
        toast.error('Please select at least one prompt');
        return;
      }
      setCurrentStep('competitors');
    } else if (currentStep === 'competitors') {
      // Complete onboarding and start analysis
      await handleCompleteOnboarding();
    }
  };

  const handleBack = () => {
    const steps: OnboardingStep[] = ['website', 'description', 'prompts', 'competitors'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    setCurrentStep('analysis');
    toast.loading('Creating your workspace...');
    
    try {
      // Filter to get only selected prompts with their full data (including category) by ID
      const selectedPromptsData = allPromptsData.filter(p => 
        selectedPrompts.includes(p.id)
      );
      
      // Step 1: Create workspace
      const response = await fetch('/api/brand-monitor/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl,
          businessDescription,
          topics: [],
          prompts: selectedPromptsData,
          competitors,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      const data = await response.json();
      toast.dismiss();
      toast.success('Workspace created!');
      
      // Step 2: Run the prompts
      toast.loading('Running prompts across AI providers...');
      
      try {
        const runResponse = await fetch('/api/brand-monitor/prompts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        });

        if (runResponse.ok) {
          toast.dismiss();
          toast.success('Analysis complete!');
        } else {
          // Don't fail onboarding if prompts fail - they can run them later
          toast.dismiss();
          toast.info('Workspace created! You can run prompts from the dashboard.');
        }
      } catch (promptError) {
        console.error('Error running prompts:', promptError);
        toast.dismiss();
        toast.info('Workspace created! You can run prompts from the dashboard.');
      }
      
      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard/prompts');
      }, 1500);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.dismiss();
      toast.error('Failed to complete onboarding. Please try again.');
      setCurrentStep('competitors');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipToStep = (step: OnboardingStep) => {
    if (step === 'analysis' || step === currentStep) return;
    
    // Validate before skipping
    if (step === 'description' && !websiteUrl.trim()) {
      toast.error('Please enter a website URL first');
      return;
    }
    if ((step === 'prompts' || step === 'competitors') && !businessDescription.trim()) {
      toast.error('Please provide a business description first');
      return;
    }
    
    setCurrentStep(step);
    toast.info(`Skipped to ${step}`);
  };

  const extractCompanyName = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain.split('.')[0];
    } catch {
      return 'Your Company';
    }
  };

  const handleRegenerateDescription = async () => {
    setLoading(true);
    toast.loading('Regenerating description...');
    try {
      const response = await fetch('/api/brand-monitor/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      });
      
      toast.dismiss();
      
      if (response.ok) {
        const data = await response.json();
        setBusinessDescription(data.company?.description || businessDescription);
        toast.success('Description regenerated!');
      } else {
        throw new Error('Failed to regenerate');
      }
    } catch (error) {
      toast.dismiss();
      console.error('Error regenerating description:', error);
      toast.error('Failed to regenerate description. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrompt = (promptId: string, promptText: string) => {
    setEditingPromptId(promptId);
    setEditingPromptText(promptText);
  };

  const handleSavePromptEdit = (topic: string, promptId: string) => {
    if (!editingPromptText.trim()) {
      toast.error('Prompt cannot be empty');
      return;
    }

    // Update in generated prompts by ID
    setGeneratedPrompts(prev => ({
      ...prev,
      [topic]: prev[topic].map(p => 
        p.id === promptId ? { ...p, prompt: editingPromptText } : p
      )
    }));

    // Update in allPromptsData as well
    setAllPromptsData(prev =>
      prev.map(p => 
        p.id === promptId ? { ...p, prompt: editingPromptText } : p
      )
    );

    setEditingPromptId(null);
    setEditingPromptText('');
    toast.success('Prompt updated!');
  };

  const handleCancelPromptEdit = () => {
    setEditingPromptId(null);
    setEditingPromptText('');
  };

  const togglePrompt = (promptId: string) => {
    setSelectedPrompts(prev =>
      prev.includes(promptId)
        ? prev.filter(id => id !== promptId)
        : [...prev, promptId]
    );
  };

  const handleAddCompetitor = () => {
    if (!newCompetitorName.trim() || !newCompetitorUrl.trim()) {
      toast.error('Please enter both competitor name and URL');
      return;
    }
    
    if (competitors.length >= 20) {
      toast.error('Maximum 20 competitors allowed');
      return;
    }

    setCompetitors(prev => [...prev, {
      name: newCompetitorName.trim(),
      url: newCompetitorUrl.trim(),
    }]);
    
    setNewCompetitorName('');
    setNewCompetitorUrl('');
    toast.success('Competitor added!');
  };

  const getCompetitorFavicon = (url: string) => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const domain = urlObj.hostname.replace('www.', '');
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } catch {
      return null;
    }
  };

  const handleRemoveCompetitor = (index: number) => {
    setCompetitors(prev => prev.filter((_, i) => i !== index));
    toast.success('Competitor removed');
  };

  const handleEditCompetitorUrl = (index: number, currentUrl: string) => {
    setEditingCompetitorIndex(index);
    setEditingCompetitorUrl(currentUrl);
  };

  const handleSaveCompetitorUrl = () => {
    if (editingCompetitorIndex !== null) {
      setCompetitors(prev => prev.map((c, i) => 
        i === editingCompetitorIndex 
          ? { ...c, url: editingCompetitorUrl }
          : c
      ));
      setEditingCompetitorIndex(null);
      setEditingCompetitorUrl('');
      toast.success('Competitor URL updated');
    }
  };

  const handleCancelEditCompetitorUrl = () => {
    setEditingCompetitorIndex(null);
    setEditingCompetitorUrl('');
  };

  const handleFindCompetitors = async () => {
    if (!businessDescription.trim()) {
      toast.error('Please provide a business description first');
      return;
    }

    setFindingCompetitors(true);
    toast.loading('Finding competitors with AI...');
    
    try {
      const response = await fetch('/api/brand-monitor/find-competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: extractCompanyName(websiteUrl),
          companyUrl: websiteUrl,
          businessDescription,
        }),
      });

      toast.dismiss();

      if (!response.ok) {
        throw new Error('Failed to find competitors');
      }

      const data = await response.json();
      
      if (data.competitors && data.competitors.length > 0) {
        // Add found competitors to the list (avoid duplicates)
        const existingNames = new Set(competitors.map(c => c.name.toLowerCase()));
        const newCompetitors = data.competitors
          .filter((c: any) => !existingNames.has(c.name.toLowerCase()))
          .map((c: any) => ({
            name: c.name,
            url: c.url || '',
          }));
        
        setCompetitors(prev => [...prev, ...newCompetitors].slice(0, 20)); // Max 20
        toast.success(`Found ${newCompetitors.length} competitors!`);
      } else {
        toast.info('No competitors found. Try adding them manually.');
      }
    } catch (error) {
      toast.dismiss();
      console.error('Error finding competitors:', error);
      toast.error('Failed to find competitors. Please try again or add them manually.');
    } finally {
      setFindingCompetitors(false);
    }
  };

  // Show loading state while session is being fetched OR if not authenticated (to prevent UI flash during redirect)
  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar with steps */}
      <div className="w-64 bg-muted/30 p-8 border-r flex flex-col min-h-screen">
        <div className="mb-12">
          <div className="h-10 w-10 bg-foreground rounded-lg flex items-center justify-center mb-2">
            <span className="text-2xl">🐻</span>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: 'website', label: 'Website' },
            { key: 'description', label: 'Description' },
            { key: 'prompts', label: 'Prompts' },
            { key: 'competitors', label: 'Competitors' },
            { key: 'analysis', label: 'Analysis' },
          ].map((step, index) => {
            const steps: OnboardingStep[] = ['website', 'description', 'prompts', 'competitors', 'analysis'];
            const currentIndex = steps.indexOf(currentStep);
            const stepIndex = steps.indexOf(step.key as OnboardingStep);
            const isCompleted = stepIndex < currentIndex;
            const isCurrent = stepIndex === currentIndex;

            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCompleted 
                    ? 'bg-green-500 text-white' 
                    : isCurrent 
                    ? 'bg-foreground text-background' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span className={`text-sm ${isCurrent ? 'font-bold' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-8">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            Exit
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          {currentStep === 'website' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Welcome to Bear</h1>
                <p className="text-muted-foreground">
                  Enter your website to start tracking your AI visibility
                </p>
              </div>

              <Card className="p-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="url"
                      placeholder="https://www.example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Button 
                    onClick={handleContinue} 
                    className="w-full"
                    disabled={loading || !websiteUrl.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {currentStep === 'description' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Tell us about your business</h1>
              </div>

              <Card className="p-6">
                <div className="space-y-4">
                  <Textarea
                    placeholder="Describe your business..."
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    rows={8}
                    maxLength={500}
                    className="resize-none"
                  />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {businessDescription.length}/500 characters
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleRegenerateDescription}
                      disabled={loading}
                      className="text-primary"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Regenerate Description
                    </Button>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={handleBack}>
                      Back
                    </Button>
                    <Button 
                      onClick={handleContinue} 
                      className="flex-1"
                      disabled={loading || !businessDescription.trim()}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {currentStep === 'prompts' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">What prompts do you want to appear on?</h1>
                <p className="text-muted-foreground">
                  You can track visibility for specific prompts within topics. You can edit them to your liking and even change them later.
                </p>
              </div>

              <Card className="p-6">
                <div className="space-y-6">
                  {Object.entries(generatedPrompts).map(([topic, prompts]) => (
                    <div key={topic} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary" />
                        <h3 className="font-semibold">{topic}</h3>
                      </div>
                      
                      <div className="space-y-2 ml-4">
                        {prompts?.map((promptObj, index) => {
                          const isEditing = editingPromptId === promptObj.id;
                          const isSelected = selectedPrompts.includes(promptObj.id);

                          return (
                            <div
                              key={promptObj.id}
                              className={`p-3 rounded-lg border transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editingPromptText}
                                    onChange={(e) => setEditingPromptText(e.target.value)}
                                    rows={2}
                                    className="text-sm resize-none"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelPromptEdit}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleSavePromptEdit(topic, promptObj.id)}
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2 group">
                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => togglePrompt(promptObj.id)}
                                  >
                                    <p className="text-sm">{promptObj.prompt}</p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditPrompt(promptObj.id, promptObj.prompt);
                                    }}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={handleBack}>
                      Back
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => handleSkipToStep('competitors')}
                    >
                      <SkipForward className="h-4 w-4 mr-2" />
                      Skip
                    </Button>
                    <Button 
                      onClick={handleContinue} 
                      className="flex-1"
                      disabled={selectedPrompts.length === 0}
                    >
                      Add & Continue
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {currentStep === 'competitors' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Add Your Competitors</h1>
                <p className="text-muted-foreground">
                  Track up to 20 competitors to monitor your relative AI visibility
                </p>
              </div>

              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Competitors</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFindCompetitors}
                      disabled={findingCompetitors || competitors.length >= 20}
                    >
                      {findingCompetitors ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Finding...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Find with AI
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Or add manually:</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Competitor name"
                        value={newCompetitorName}
                        onChange={(e) => setNewCompetitorName(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="www.example.com"
                        value={newCompetitorUrl}
                        onChange={(e) => setNewCompetitorUrl(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleAddCompetitor}
                        size="icon"
                        disabled={competitors.length >= 20}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{competitors.length}/20</p>
                  </div>

                  {competitors.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {competitors.map((competitor, index) => {
                        const favicon = getCompetitorFavicon(competitor.url);
                        const isEditing = editingCompetitorIndex === index;
                        
                        return (
                          <div
                            key={index}
                            className="relative p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                          >
                            <button
                              onClick={() => handleRemoveCompetitor(index)}
                              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </button>
                            
                            <div className="space-y-2">
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                {favicon ? (
                                  <img
                                    src={favicon}
                                    alt={competitor.name}
                                    className="h-8 w-8 object-contain"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <Globe className={`h-5 w-5 text-muted-foreground ${favicon ? 'hidden' : ''}`} />
                              </div>
                              <div>
                                <p className="font-medium text-sm truncate pr-6">{competitor.name}</p>
                                {isEditing ? (
                                  <div className="space-y-1 mt-1">
                                    <Input
                                      value={editingCompetitorUrl}
                                      onChange={(e) => setEditingCompetitorUrl(e.target.value)}
                                      placeholder="www.example.com"
                                      className="h-7 text-xs"
                                    />
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleCancelEditCompetitorUrl}
                                        className="h-6 px-2 text-xs"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={handleSaveCompetitorUrl}
                                        className="h-6 px-2 text-xs"
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <p className="text-xs text-muted-foreground truncate flex-1">
                                      {competitor.url || 'No URL'}
                                    </p>
                                    <button
                                      onClick={() => handleEditCompetitorUrl(index, competitor.url)}
                                      className="text-primary hover:text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={handleBack}>
                      Back
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => {
                        toast.success('Skipped to dashboard!');
                        router.push('/dashboard');
                      }}
                      disabled={loading}
                    >
                      <SkipForward className="h-4 w-4 mr-2" />
                      Skip & Go to Dashboard
                    </Button>
                    <Button 
                      onClick={handleContinue} 
                      className="flex-1"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Starting analysis...
                        </>
                      ) : (
                        'Complete Setup'
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {currentStep === 'analysis' && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Running Your Analysis</h1>
                <p className="text-muted-foreground">
                  We're testing your prompts across multiple AI platforms. This may take a few minutes.
                </p>
              </div>

              <div className="flex justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>

              <Card className="p-6 text-left">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-sm font-medium">Creating workspace...</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    <p className="text-sm font-medium">Running {selectedPrompts.length} prompts across AI providers</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <p className="text-sm text-muted-foreground">Analyzing competitors: {competitors.length}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                    <p className="text-sm text-muted-foreground">Testing on: ChatGPT, Claude, Gemini, Perplexity</p>
                  </div>
                </div>
              </Card>

              <p className="text-xs text-muted-foreground">
                You can navigate away - we'll notify you when it's ready
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

