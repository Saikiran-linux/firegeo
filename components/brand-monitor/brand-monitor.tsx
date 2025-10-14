'use client';

import React, { useReducer, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { Company } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { CREDITS_PER_BRAND_ANALYSIS } from '@/config/constants';
import { ClientApiError } from '@/lib/client-errors';
import { 
  brandMonitorReducer, 
  initialBrandMonitorState,
  IdentifiedCompetitor
} from '@/lib/brand-monitor-reducer';
import {
  validateUrl,
  validateCompetitorUrl,
  normalizeCompetitorName,
  assignUrlToCompetitor,
  detectServiceType,
  formatServiceTypeForPrompt,
  getIndustryCompetitors
} from '@/lib/brand-monitor-utils';

// Components
import { UrlInputSection } from './url-input-section';
import { CompanyCard } from './company-card';
import { AnalysisProgressSection } from './analysis-progress-section';
import { ResultsNavigation } from './results-navigation';
import { PromptsResponsesTab } from './prompts-responses-tab';
import { VisibilityScoreTab } from './visibility-score-tab';
import { ErrorMessage } from './error-message';
import { AddPromptModal } from './modals/add-prompt-modal';
import { AddCompetitorModal } from './modals/add-competitor-modal';
import { ProviderComparisonMatrix } from './provider-comparison-matrix';
import { ProviderRankingsTabs } from './provider-rankings-tabs';
import { useSaveBrandAnalysis } from '@/hooks/useBrandAnalyses';

// Hooks
import { useSSEHandler } from './hooks/use-sse-handler';
import { getEnabledProviders } from '@/lib/provider-config';

interface BrandMonitorProps {
  creditsAvailable?: number;
  onCreditsUpdate?: () => void;
  selectedAnalysis?: any;
  onSaveAnalysis?: (analysis: any) => void;
}

export function BrandMonitor({ 
  creditsAvailable = 0, 
  onCreditsUpdate,
  selectedAnalysis,
  onSaveAnalysis 
}: BrandMonitorProps = {}) {
  const [state, dispatch] = useReducer(brandMonitorReducer, initialBrandMonitorState);
  const [demoUrl] = useState('example.com');
  const saveAnalysis = useSaveBrandAnalysis();
  const [isLoadingExistingAnalysis, setIsLoadingExistingAnalysis] = useState(false);
  const hasSavedRef = useRef(false);
  
  const { startSSEConnection } = useSSEHandler({ 
    state, 
    dispatch, 
    onCreditsUpdate,
    onAnalysisComplete: (completedAnalysis) => {
      // Only save if this is a new analysis (not loaded from existing)
      if (!selectedAnalysis && !hasSavedRef.current) {
        hasSavedRef.current = true;
        
        const analysisData = {
          url: company?.url || url,
          companyName: company?.name,
          industry: company?.industry,
          analysisData: completedAnalysis,
          competitors: identifiedCompetitors,
          prompts: analyzingPrompts,
          creditsUsed: CREDITS_PER_BRAND_ANALYSIS
        };
        
        saveAnalysis.mutate(analysisData, {
          onSuccess: (savedAnalysis) => {
            console.log('Analysis saved successfully:', savedAnalysis);
            if (onSaveAnalysis) {
              onSaveAnalysis(savedAnalysis);
            }
          },
          onError: (error) => {
            console.error('Failed to save analysis:', error);
            hasSavedRef.current = false;
          }
        });
      }
    }
  });
  
  // Extract state for easier access
  const {
    url,
    urlValid,
    error,
    loading,
    analyzing,
    preparingAnalysis,
    company,
    showInput,
    showCompanyCard,
    showPromptsList,
    showCompetitors,
    customPrompts,
    generatedPrompts,
    removedDefaultPrompts,
    identifiedCompetitors,
    aiCompetitors,
    availableProviders,
    analysisProgress,
    promptCompletionStatus,
    analyzingPrompts,
    analysis,
    activeResultsTab,
    expandedPromptIndex,
    showAddPromptModal,
    showAddCompetitorModal,
    newPromptText,
    newCompetitorName,
    newCompetitorUrl,
    scrapingCompetitors
  } = state;

  const competitorCards = useMemo(() => identifiedCompetitors, [identifiedCompetitors]);
  
  // Remove the auto-save effect entirely - we'll save manually when analysis completes
  
  // Load selected analysis if provided or reset when null
  useEffect(() => {
    if (selectedAnalysis && selectedAnalysis.analysisData) {
      setIsLoadingExistingAnalysis(true);
      // Restore the analysis state from saved data
      dispatch({ type: 'SET_ANALYSIS', payload: selectedAnalysis.analysisData });
      if (selectedAnalysis.companyName) {
        dispatch({ type: 'SCRAPE_SUCCESS', payload: {
          name: selectedAnalysis.companyName,
          url: selectedAnalysis.url,
          industry: selectedAnalysis.industry
        } as Company });
      }
      // Reset the flag after a short delay to ensure the save effect doesn't trigger
      setTimeout(() => setIsLoadingExistingAnalysis(false), 100);
    } else if (selectedAnalysis === null) {
      // Reset state when explicitly set to null (New Analysis clicked)
      dispatch({ type: 'RESET_STATE' });
      hasSavedRef.current = false;
      setIsLoadingExistingAnalysis(false);
    }
  }, [selectedAnalysis]);
  
  // Handlers
  const handleUrlChange = useCallback((newUrl: string) => {
    dispatch({ type: 'SET_URL', payload: newUrl });
    
    // Clear any existing error when user starts typing
    if (error) {
      dispatch({ type: 'SET_ERROR', payload: null });
    }
    
    // Validate URL on change
    if (newUrl.length > 0) {
      const isValid = validateUrl(newUrl);
      dispatch({ type: 'SET_URL_VALID', payload: isValid });
    } else {
      dispatch({ type: 'SET_URL_VALID', payload: null });
    }
  }, [error]);
  
  const handleScrape = useCallback(async () => {
    if (!url) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter a URL' });
      return;
    }

    // Validate URL
    if (!validateUrl(url)) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter a valid URL (e.g., example.com or https://example.com)' });
      dispatch({ type: 'SET_URL_VALID', payload: false });
      return;
    }

    // Check if user has enough credits for initial scrape (1 credit)
    if (creditsAvailable < 1) {
      dispatch({ type: 'SET_ERROR', payload: 'Insufficient credits. You need at least 1 credit to analyze a URL.' });
      return;
    }

    console.log('Starting scrape for URL:', url);
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_URL_VALID', payload: true });
    
    try {
      const response = await fetch('/api/brand-monitor/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url,
          maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week in milliseconds
        }),
      });

      console.log('Scrape response status:', response.status);

      if (!response.ok) {
        try {
          const errorData = await response.json();
          console.error('Scrape API error:', errorData);
          if (errorData.error?.message) {
            throw new ClientApiError(errorData);
          }
          throw new Error(errorData.error || 'Failed to scrape');
        } catch (e) {
          if (e instanceof ClientApiError) throw e;
          throw new Error('Failed to scrape');
        }
      }

      const data = await response.json();
      console.log('Scrape data received:', data);
      
      if (!data.company) {
        throw new Error('No company data received');
      }
      
      // Scrape was successful - credits have been deducted, refresh the navbar
      if (onCreditsUpdate) {
        onCreditsUpdate();
      }
      
      // Start fade out transition
      dispatch({ type: 'SET_SHOW_INPUT', payload: false });
      
      // After fade out completes, set company and show card with fade in
      setTimeout(() => {
        dispatch({ type: 'SCRAPE_SUCCESS', payload: data.company });
        // Small delay to ensure DOM updates before fade in
        setTimeout(() => {
          dispatch({ type: 'SET_SHOW_COMPANY_CARD', payload: true });
          console.log('Showing company card');
        }, 50);
      }, 500);
    } catch (error: any) {
      let errorMessage = 'Failed to extract company information';
      if (error instanceof ClientApiError) {
        errorMessage = error.getUserMessage();
      } else if (error.message) {
        errorMessage = `Failed to extract company information: ${error.message}`;
      }
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('HandleScrape error:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [url, creditsAvailable, onCreditsUpdate]);
  
  const handlePrepareAnalysis = useCallback(async () => {
    if (!company) return;
    
    dispatch({ type: 'SET_PREPARING_ANALYSIS', payload: true });
    
    // Check which providers are available
    try {
      const response = await fetch('/api/brand-monitor/check-providers', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'SET_AVAILABLE_PROVIDERS', payload: data.providers || ['OpenAI', 'Anthropic', 'Google'] });
      }
    } catch (e) {
      // Default to providers with API keys if check fails
      const defaultProviders = [];
      if (process.env.NEXT_PUBLIC_HAS_OPENAI_KEY) defaultProviders.push('OpenAI');
      if (process.env.NEXT_PUBLIC_HAS_ANTHROPIC_KEY) defaultProviders.push('Anthropic');
      dispatch({ type: 'SET_AVAILABLE_PROVIDERS', payload: defaultProviders.length > 0 ? defaultProviders : ['OpenAI', 'Anthropic'] });
    }
    
    try {
      dispatch({ type: 'SET_SCRAPING_COMPETITORS', payload: true });

      let competitors: IdentifiedCompetitor[] = [];
      let aiCompetitors: string[] = [];
      let competitorsWithType: Array<{ name: string; type: 'direct' | 'regional' | 'international' }> = [];

      try {
        const response = await fetch('/api/brand-monitor/identify-competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody?.error?.message || 'Failed to identify competitors');
        }

        const data = await response.json();
        const rawCompetitors: unknown[] = Array.isArray(data?.competitors) ? data.competitors : [];

        if (!Array.isArray(data?.competitors)) {
          console.warn('[brand-monitor] Unexpected competitors payload shape', {
            receivedType: typeof data?.competitors,
            data,
          });
        }

        const validatedCompetitors: Array<{ name: string; type: 'direct' | 'regional' | 'international' }> = [];

        rawCompetitors.forEach((item, index) => {
          if (!item || typeof item !== 'object') {
            console.warn('[brand-monitor] Skipping competitor with invalid structure', { index, item });
            return;
          }

          const candidate = item as { name?: unknown; type?: unknown };
          const name = typeof candidate.name === 'string' ? candidate.name.trim() : undefined;
          const type = candidate.type;
          const isValidType = type === 'direct' || type === 'regional' || type === 'international';

          if (!name || !isValidType) {
            console.warn('[brand-monitor] Skipping competitor with invalid fields', { index, item });
            return;
          }

          validatedCompetitors.push({ name, type });
        });

        competitorsWithType = validatedCompetitors;

        aiCompetitors = competitorsWithType.map(c => c.name);
      } catch (error) {
        console.error('Failed to fetch AI competitors:', error);
      }

      if (aiCompetitors.length > 0) {
        competitors = aiCompetitors.map((name, index) => {
          const normalizedName = normalizeCompetitorName(name);
          const url = assignUrlToCompetitor(normalizedName) || assignUrlToCompetitor(name);
          const competitorData = competitorsWithType.find(c => c.name === name);
          
          return {
            name,
            url,
            type: competitorData?.type || 'direct',
          } as IdentifiedCompetitor;
        });

        dispatch({ type: 'SET_AI_COMPETITORS', payload: aiCompetitors });
      } else {
        // Only use scraped competitors as fallback, no industry defaults
        const extractedCompetitors = company.scrapedData?.competitors || [];
        
        if (extractedCompetitors.length > 0) {
          competitors = extractedCompetitors.map(name => {
            const normalizedName = normalizeCompetitorName(name);
            const url = assignUrlToCompetitor(normalizedName) || assignUrlToCompetitor(name);
            return {
              name,
              url,
            } as IdentifiedCompetitor;
          }).slice(0, 9);
          
          dispatch({ type: 'SET_AI_COMPETITORS', payload: [] });
        }
      }

      if (competitors.length === 0) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to identify competitors for this brand. Please add them manually using the "Add Competitor" button.' });
      }

      dispatch({ type: 'SET_IDENTIFIED_COMPETITORS', payload: competitors });
      dispatch({ type: 'SET_SHOW_COMPETITORS', payload: true });
    } finally {
      dispatch({ type: 'SET_PREPARING_ANALYSIS', payload: false });
      dispatch({ type: 'SET_SCRAPING_COMPETITORS', payload: false });
    }
  }, [company]);
  
  const handleProceedToPrompts = useCallback(async () => {
    if (!company) return;
    
    // Add a fade-out class to the current view
    const currentView = document.querySelector('.animate-panel-in');
    if (currentView) {
      currentView.classList.add('opacity-0');
    }
    
    setTimeout(async () => {
      dispatch({ type: 'SET_SHOW_COMPETITORS', payload: false });
      dispatch({ type: 'SET_SHOW_PROMPTS_LIST', payload: true });
      
      // Generate prompts for the company using AI
      try {
        console.log('Generating prompts for company:', company.name);
        const response = await fetch('/api/brand-monitor/generate-prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            company,
            competitors: identifiedCompetitors.map(c => c.name)
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Generated prompts:', data.prompts);
          if (data.prompts && data.prompts.length > 0) {
            dispatch({ type: 'SET_GENERATED_PROMPTS', payload: data.prompts });
          }
        } else {
          console.warn('Failed to generate prompts, using defaults');
          dispatch({ type: 'SET_GENERATED_PROMPTS', payload: [] });
        }
      } catch (error) {
        console.error('Error generating prompts:', error);
        // Fallback to defaults if generation fails
        dispatch({ type: 'SET_GENERATED_PROMPTS', payload: [] });
      }
    }, 300);
  }, [company, identifiedCompetitors]);
  
  const handleAnalyze = useCallback(async () => {
    if (!company) return;

    // Reset saved flag for new analysis
    hasSavedRef.current = false;

    // Check if user has enough credits
    if (creditsAvailable < CREDITS_PER_BRAND_ANALYSIS) {
      dispatch({ type: 'SET_ERROR', payload: `Insufficient credits. You need at least ${CREDITS_PER_BRAND_ANALYSIS} credits to run an analysis.` });
      return;
    }

    // Immediately trigger credit update to reflect deduction in navbar
    if (onCreditsUpdate) {
      onCreditsUpdate();
    }

    // Collect all prompts (default + custom)
    const serviceType = detectServiceType(company);
    const serviceTypeForPrompt = formatServiceTypeForPrompt(serviceType);
    const currentYear = new Date().getFullYear();
    
    // Create hardcoded prompts with stable IDs
    const hardcodedPrompts = [
      { id: `default-0`, prompt: `What are the best ${serviceTypeForPrompt} in ${currentYear}?` },
      { id: `default-1`, prompt: `I need a ${serviceType} for my startup, what do you recommend?` },
      { id: `default-2`, prompt: `Top ${serviceTypeForPrompt} for small businesses?` },
      { id: `default-3`, prompt: `Which ${serviceType} should I choose for my team?` }
    ];
    
    const defaultPrompts = generatedPrompts.length
      ? generatedPrompts.filter(p => !removedDefaultPrompts.includes(p.id)).map(prompt => prompt.prompt)
      : hardcodedPrompts.filter(p => !removedDefaultPrompts.includes(p.id)).map(p => p.prompt);

    const allPrompts = [...defaultPrompts, ...customPrompts];
    
    // Store the prompts for UI display - make sure they're normalized
    const normalizedPrompts = allPrompts.map(p => p.trim());
    dispatch({ type: 'SET_ANALYZING_PROMPTS', payload: normalizedPrompts });

    console.log('Starting analysis...');
    
    dispatch({ type: 'SET_ANALYZING', payload: true });
    dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: {
      stage: 'initializing',
      progress: 0,
      message: 'Starting analysis...',
      competitors: [],
      prompts: [],
      partialResults: []
    }});
    dispatch({ type: 'SET_ANALYSIS_TILES', payload: [] });
    
    // Initialize prompt completion status
    const initialStatus: any = {};
    const expectedProviders = getEnabledProviders().map(config => config.name);
    
    normalizedPrompts.forEach(prompt => {
      initialStatus[prompt] = {};
      expectedProviders.forEach(provider => {
        initialStatus[prompt][provider] = 'pending';
      });
    });
    dispatch({ type: 'SET_PROMPT_COMPLETION_STATUS', payload: initialStatus });

    try {
      await startSSEConnection('/api/brand-monitor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          company, 
          prompts: normalizedPrompts,
          competitors: identifiedCompetitors 
        }),
      });
    } finally {
      dispatch({ type: 'SET_ANALYZING', payload: false });
    }
  }, [company, generatedPrompts, removedDefaultPrompts, customPrompts, identifiedCompetitors, aiCompetitors, startSSEConnection, creditsAvailable]);
  
  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
    hasSavedRef.current = false;
    setIsLoadingExistingAnalysis(false);
  }, []);
  
  const batchScrapeAndValidateCompetitors = useCallback(async (competitors: IdentifiedCompetitor[]) => {
    const validatedCompetitors = competitors.map(comp => ({
      ...comp,
      url: comp.url ? validateCompetitorUrl(comp.url) : undefined
    })).filter(comp => comp.url);
    
    if (validatedCompetitors.length === 0) return;
    
    // Implementation for batch scraping - you can move the full implementation here
    // For now, just logging
    console.log('Batch scraping validated competitors:', validatedCompetitors);
  }, []);
  
  
  // Find brand data
  const brandData = analysis?.competitors?.find(c => c.isOwn);
  
  return (
    <div className="flex flex-col">

      {/* URL Input Section */}
      {showInput && (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            <UrlInputSection
            url={url}
            urlValid={urlValid}
            loading={loading}
            analyzing={analyzing}
            onUrlChange={handleUrlChange}
            onSubmit={handleScrape}
          />
          </div>
        </div>
      )}

      {/* Company Card Section with Competitors */}
      {!showInput && company && !showPromptsList && !analyzing && !analysis && (
        <div className="flex items-center justify-center animate-panel-in">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="w-full space-y-6">
            <div className={`transition-all duration-500 ${showCompanyCard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <CompanyCard 
                company={company}
                onAnalyze={handlePrepareAnalysis}
                analyzing={preparingAnalysis}
                showCompetitors={showCompetitors}
                identifiedCompetitors={competitorCards}
                aiCompetitors={aiCompetitors}
                scrapingCompetitors={scrapingCompetitors}
                onRemoveCompetitor={(name) => dispatch({ type: 'REMOVE_COMPETITOR', payload: { name } })}
                onAddCompetitor={() => {
                  dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addCompetitor', show: true } });
                  dispatch({ type: 'SET_NEW_COMPETITOR', payload: { name: '', url: '' } });
                }}
                onContinueToAnalysis={handleProceedToPrompts}
              />
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompts List Section */}
      {showPromptsList && company && !analysis && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <AnalysisProgressSection
          company={company}
          analyzing={analyzing}
          identifiedCompetitors={identifiedCompetitors}
          scrapingCompetitors={scrapingCompetitors}
          analysisProgress={analysisProgress}
          prompts={analyzingPrompts}
          customPrompts={customPrompts}
          removedDefaultPrompts={removedDefaultPrompts}
          promptCompletionStatus={promptCompletionStatus}
          generatedPrompts={generatedPrompts}
          onRemoveDefaultPrompt={(id) => dispatch({ type: 'REMOVE_DEFAULT_PROMPT', payload: id })}
          onRemoveCustomPrompt={(prompt) => {
            dispatch({ type: 'SET_CUSTOM_PROMPTS', payload: customPrompts.filter(p => p !== prompt) });
          }}
          onAddPromptClick={() => {
            dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addPrompt', show: true } });
            dispatch({ type: 'SET_NEW_PROMPT_TEXT', payload: '' });
          }}
          onStartAnalysis={handleAnalyze}
          detectServiceType={detectServiceType}
        />
        </div>
      )}

      {/* Analysis Results */}
      {analysis && brandData && (
        <div className="flex-1 flex justify-center animate-panel-in pt-8">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="flex gap-6 relative">
            {/* Sidebar Navigation */}
            <ResultsNavigation
              activeTab={activeResultsTab}
              onTabChange={(tab) => {
                dispatch({ type: 'SET_ACTIVE_RESULTS_TAB', payload: tab });
              }}
              onRestart={handleRestart}
            />
            
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
              <div className="w-full flex-1 flex flex-col">
                {/* Tab Content */}
                {activeResultsTab === 'visibility' && (
                  <VisibilityScoreTab
                    competitors={analysis.competitors}
                    brandData={brandData}
                    identifiedCompetitors={identifiedCompetitors}
                  />
                )}

                {activeResultsTab === 'matrix' && (
                  <Card className="p-2 bg-card text-card-foreground gap-6 rounded-xl border py-6 shadow-sm border-gray-200 h-full flex flex-col">
                    <CardHeader className="border-b">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-xl font-semibold">Comparison Matrix</CardTitle>
                          <CardDescription className="text-sm text-gray-600 mt-1">
                            Compare visibility scores across different AI providers
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-600">{brandData.visibilityScore}%</p>
                          <p className="text-xs text-gray-500 mt-1">Average Score</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1 overflow-auto">
                      {analysis.providerComparison ? (
                        <ProviderComparisonMatrix 
                          data={analysis.providerComparison} 
                          brandName={company?.name || ''} 
                          competitors={identifiedCompetitors}
                        />
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No comparison data available</p>
                          <p className="text-sm mt-2">Please ensure AI providers are configured and the analysis has completed.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {activeResultsTab === 'rankings' && analysis.providerRankings && (
                  <div id="provider-rankings" className="h-full">
                    <ProviderRankingsTabs 
                      providerRankings={analysis.providerRankings} 
                      brandName={company?.name || 'Your Brand'}
                      shareOfVoice={brandData.shareOfVoice}
                      averagePosition={Math.round(brandData.averagePosition)}
                      sentimentScore={brandData.sentimentScore}
                      weeklyChange={brandData.weeklyChange}
                    />
                  </div>
                )}

                {activeResultsTab === 'prompts' && analysis.prompts && (
                  <Card className="p-2 bg-card text-card-foreground gap-6 rounded-xl border py-6 shadow-sm border-gray-200 h-full flex flex-col">
                    <CardHeader className="border-b">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-xl font-semibold">Prompts & Responses</CardTitle>
                          <CardDescription className="text-sm text-gray-600 mt-1">
                            AI responses to your brand queries
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-600">{analysis.prompts.length}</p>
                          <p className="text-xs text-gray-500 mt-1">Total Prompts</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1 overflow-auto">
                      <PromptsResponsesTab
                        prompts={analysis.prompts}
                        responses={analysis.responses}
                        expandedPromptIndex={expandedPromptIndex}
                        onToggleExpand={(index) => dispatch({ type: 'SET_EXPANDED_PROMPT_INDEX', payload: index })}
                        brandName={analysis.company?.name || ''}
                        competitors={analysis.competitors?.map(c => c.name) || []}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <ErrorMessage
          error={error}
          onDismiss={() => dispatch({ type: 'SET_ERROR', payload: null })}
        />
      )}
      
      {/* Modals */}
      <AddPromptModal
        isOpen={showAddPromptModal}
        promptText={newPromptText}
        onPromptTextChange={(text) => dispatch({ type: 'SET_NEW_PROMPT_TEXT', payload: text })}
        onAdd={() => {
          if (newPromptText.trim()) {
            dispatch({ type: 'ADD_CUSTOM_PROMPT', payload: newPromptText.trim() });
            dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addPrompt', show: false } });
            dispatch({ type: 'SET_NEW_PROMPT_TEXT', payload: '' });
          }
        }}
        onClose={() => {
          dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addPrompt', show: false } });
          dispatch({ type: 'SET_NEW_PROMPT_TEXT', payload: '' });
        }}
      />

      <AddCompetitorModal
        isOpen={showAddCompetitorModal}
        competitorName={newCompetitorName}
        competitorUrl={newCompetitorUrl}
        onNameChange={(name) => dispatch({ type: 'SET_NEW_COMPETITOR', payload: { name } })}
        onUrlChange={(url) => dispatch({ type: 'SET_NEW_COMPETITOR', payload: { url } })}
        onAdd={async () => {
          if (newCompetitorName.trim()) {
            const rawUrl = newCompetitorUrl.trim();
            const validatedUrl = rawUrl ? validateCompetitorUrl(rawUrl) : undefined;
            
            const newCompetitor: IdentifiedCompetitor = {
              name: newCompetitorName.trim(),
              url: validatedUrl
            };
            
            dispatch({ type: 'ADD_COMPETITOR', payload: newCompetitor });
            dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addCompetitor', show: false } });
            dispatch({ type: 'SET_NEW_COMPETITOR', payload: { name: '', url: '' } });
            
            // Batch scrape and validate the new competitor if it has a URL
            if (newCompetitor.url) {
              await batchScrapeAndValidateCompetitors([newCompetitor]);
            }
          }
        }}
        onClose={() => {
          dispatch({ type: 'TOGGLE_MODAL', payload: { modal: 'addCompetitor', show: false } });
          dispatch({ type: 'SET_NEW_COMPETITOR', payload: { name: '', url: '' } });
        }}
      />
    </div>
  );
}