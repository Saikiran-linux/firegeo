import { AIResponse, AnalysisProgressData, Company, PartialResultData, ProgressData, PromptGeneratedData, ScoringProgressData, SSEEvent } from './types';
import { generatePromptsForCompany, analyzePromptWithProvider, calculateBrandScores, analyzeCompetitors, identifyCompetitors, analyzeCompetitorsByProvider } from './ai-utils';
import { analyzePromptWithProvider as analyzePromptWithProviderEnhanced } from './ai-utils-enhanced';
import { getConfiguredProviders } from './provider-config';

const verboseLogging = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

export interface AnalysisConfig {
  company: Company;
  customPrompts?: string[];
  userSelectedCompetitors?: { name: string }[];
  useWebSearch?: boolean;
  sendEvent: (event: SSEEvent) => Promise<void>;
}

export interface AnalysisResult {
  company: Company;
  knownCompetitors: string[];
  prompts: any[];
  responses: AIResponse[];
  scores: any;
  competitors: any[];
  providerRankings: any;
  providerComparison: any;
  errors?: string[];
  webSearchUsed?: boolean;
}

/**
 * Common analysis logic extracted from both API routes
 */
export async function performAnalysis({
  company,
  customPrompts,
  userSelectedCompetitors,
  useWebSearch = true,
  sendEvent
}: AnalysisConfig): Promise<AnalysisResult> {
  // Send start event
  await sendEvent({
    type: 'start',
    stage: 'initializing',
    data: { 
      message: `Starting analysis for ${company.name}${useWebSearch ? ' with web search' : ''}` 
    } as ProgressData,
    timestamp: new Date()
  });

  // Stage 1: Identify competitors
  await sendEvent({
    type: 'stage',
    stage: 'identifying-competitors',
    data: { 
      stage: 'identifying-competitors',
      progress: 0,
      message: 'Identifying competitors...'
    } as ProgressData,
    timestamp: new Date()
  });

  // Use user-selected competitors if provided, otherwise identify them
  let competitors: string[];
  if (userSelectedCompetitors && userSelectedCompetitors.length > 0) {
    competitors = userSelectedCompetitors.map(c => c.name);
    console.log('Using user-selected competitors:', competitors);
    
    // Send competitor events for UI
    for (let i = 0; i < competitors.length; i++) {
      await sendEvent({
        type: 'competitor-found',
        stage: 'identifying-competitors',
        data: { 
          competitor: competitors[i],
          index: i + 1,
          total: competitors.length
        },
        timestamp: new Date()
      });
    }
  } else {
    competitors = await identifyCompetitors(company, sendEvent);
  }

  // Stage 2: Generate prompts
  // Skip the 100% progress for competitors and go straight to the next stage
  await sendEvent({
    type: 'stage',
    stage: 'generating-prompts',
    data: {
      stage: 'generating-prompts',
      progress: 0,
      message: 'Generating analysis prompts...'
    } as ProgressData,
    timestamp: new Date()
  });

  // Use custom prompts if provided, otherwise generate them
  let analysisPrompts;
  if (customPrompts && customPrompts.length > 0) {
    // Convert string prompts to BrandPrompt objects
    analysisPrompts = customPrompts.map((prompt: string, index: number) => ({
      id: `custom-${index}`,
      prompt,
      category: 'custom' as const
    }));
  } else {
    const prompts = await generatePromptsForCompany(company, competitors);
    // Note: Changed from 8 to 4 to match UI - this should be configurable
    analysisPrompts = prompts.slice(0, 4);
  }

  // Send prompt generated events
  for (let i = 0; i < analysisPrompts.length; i++) {
    await sendEvent({
      type: 'prompt-generated',
      stage: 'generating-prompts',
      data: {
        prompt: analysisPrompts[i].prompt,
        category: analysisPrompts[i].category,
        index: i + 1,
        total: analysisPrompts.length
      } as PromptGeneratedData,
      timestamp: new Date()
    });
  }

  // Stage 3: Analyze with AI providers
  // Skip the 100% progress for prompts and go straight to the next stage
  await sendEvent({
    type: 'stage',
    stage: 'analyzing-prompts',
    data: {
      stage: 'analyzing-prompts',
      progress: 0,
      message: `Starting AI analysis${useWebSearch ? ' with web search' : ''}...`
    } as ProgressData,
    timestamp: new Date()
  });

  const responses: AIResponse[] = [];
  const errors: string[] = [];
  
  // Filter providers based on available API keys
  const availableProviders = getAvailableProviders();
  
  console.log('\n' + '═'.repeat(80));
  console.log('🔬 ANALYSIS PHASE - PROVIDER CONFIGURATION');
  console.log('═'.repeat(80));
  console.log('📊 Available Providers:', availableProviders.length);
  availableProviders.forEach((p, idx) => {
    console.log(`   ${idx + 1}. ${p.name} - Model: ${p.model}`);
  });
  const shouldLogApiKeys = process.env.NODE_ENV !== 'production' || process.env.DEBUG?.toLowerCase() === 'true';
  if (shouldLogApiKeys) {
    console.log('\n🔑 API Keys Status:');
    console.log(`   ${process.env.OPENAI_API_KEY ? '✅' : '❌'} OpenAI`);
    console.log(`   ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌'} Anthropic`);
    console.log(`   ${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? '✅' : '❌'} Google`);
    console.log(`   ${process.env.PERPLEXITY_API_KEY ? '✅' : '❌'} Perplexity`);
  }
  console.log(`\n🌐 Web Search: ${useWebSearch ? '✅ ENABLED' : '❌ DISABLED'}`);
  if (useWebSearch) {
    console.log(`   🔍 OpenAI (gpt-5-chat-latest): Web search enabled via enhanced prompts`);
    console.log(`   🔍 Perplexity (sonar): Built-in web search`);
    console.log(`   🔍 Google (gemini-2.5-flash): Native search grounding`);
  }
  console.log(`\n📝 Prompts to analyze: ${analysisPrompts.length}`);
  analysisPrompts.forEach((p, idx) => {
    console.log(`   ${idx + 1}. [${p.category}] ${p.prompt.substring(0, 60)}...`);
  });
  
  const totalAnalyses = analysisPrompts.length * availableProviders.length;
  let completedAnalyses = 0;
  console.log(`\n📈 Total analyses to perform: ${totalAnalyses} (${analysisPrompts.length} prompts × ${availableProviders.length} providers)`);
  console.log('═'.repeat(80));

  // Check if we should use mock mode (no API keys configured)
  const useMockMode = process.env.USE_MOCK_MODE === 'true' || availableProviders.length === 0;

  if (useMockMode) {
    console.log('\n⚠️  MOCK MODE: No real API calls will be made\n');
  }

  // Process prompts in parallel batches of 3
  const BATCH_SIZE = 3;
  console.log(`\n🔄 Processing in batches of ${BATCH_SIZE} prompts...\n`);
  
  for (let batchStart = 0; batchStart < analysisPrompts.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, analysisPrompts.length);
    const batchPrompts = analysisPrompts.slice(batchStart, batchEnd);
    
    // Create all analysis promises for this batch
    const batchPromises = batchPrompts.flatMap((prompt, batchIndex) => 
      availableProviders.map(async (provider) => {
        const promptIndex = batchStart + batchIndex;
        
        // Send analysis start event
        await sendEvent({
          type: 'analysis-start',
          stage: 'analyzing-prompts',
          data: {
            provider: provider.name,
            prompt: prompt.prompt,
            promptIndex: promptIndex + 1,
            totalPrompts: analysisPrompts.length,
            providerIndex: 0,
            totalProviders: availableProviders.length,
            status: 'started'
          } as AnalysisProgressData,
          timestamp: new Date()
        });

        try {
          if (verboseLogging) {
            console.log(`\n🎯 [${provider.name}] Starting analysis...`);
            console.log(`   📝 Prompt: "${prompt.prompt.substring(0, 70)}..."`);
            console.log(`   🤖 Model: ${provider.model}`);
            console.log(`   🌐 Web Search: ${useWebSearch ? 'Enabled' : 'Disabled'}`);
          }
          
          const analysisStartTime = Date.now();
          
          // Use enhanced version when web search is enabled, otherwise use regular version
          // Both versions now support the useWebSearch parameter
          const analyzeFunction = useWebSearch ? analyzePromptWithProviderEnhanced : analyzePromptWithProvider;
          
          const response = await analyzeFunction(
            prompt.prompt, 
            provider.name, 
            company.name, 
            competitors,
            useMockMode,
            useWebSearch // Pass web search flag to both versions
          );
          
          const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(2);
          
          if (verboseLogging) {
            if (response) {
              console.log(`   ✅ Completed in ${analysisDuration}s`);
              console.log(`   🎯 Brand mentioned: ${response.brandMentioned ? 'YES' : 'NO'}${response.brandPosition ? ` (Position: #${response.brandPosition})` : ''}`);
              console.log(`   💭 Sentiment: ${response.sentiment}`);
              console.log(`   👥 Competitors in response: ${response.competitors.length}`);
            } else {
              console.log(`   ⏭️  Skipped in ${analysisDuration}s`);
            }
          }
          
          // Skip if provider returned null (not configured)
          if (response === null) {
            
            // Send analysis complete event with skipped status
            await sendEvent({
              type: 'analysis-complete',
              stage: 'analyzing-prompts',
              data: {
                provider: provider.name,
                prompt: prompt.prompt,
                promptIndex: promptIndex + 1,
                totalPrompts: analysisPrompts.length,
                providerIndex: 0,
                totalProviders: availableProviders.length,
                status: 'failed'
              } as AnalysisProgressData,
              timestamp: new Date()
            });
            
            return; // Return early instead of continue
          }
          
          // If using mock mode, add a small delay for visual effect
          if (useMockMode) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
          }
          
          responses.push(response);

          // Send partial result
          await sendEvent({
            type: 'partial-result',
            stage: 'analyzing-prompts',
            data: {
              provider: provider.name,
              prompt: prompt.prompt,
              response: {
                provider: response.provider,
                brandMentioned: response.brandMentioned,
                brandPosition: response.brandPosition,
                sentiment: response.sentiment
              }
            } as PartialResultData,
            timestamp: new Date()
          });

          // Send analysis complete event
          await sendEvent({
            type: 'analysis-complete',
            stage: 'analyzing-prompts',
            data: {
              provider: provider.name,
              prompt: prompt.prompt,
              promptIndex: promptIndex + 1,
              totalPrompts: analysisPrompts.length,
              providerIndex: 0,
              totalProviders: availableProviders.length,
              status: 'completed'
            } as AnalysisProgressData,
            timestamp: new Date()
          });

        } catch (error) {
          console.error(`\n❌ [${provider.name}] Analysis failed:`, error instanceof Error ? error.message : error);
          errors.push(`${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          // Send analysis failed event
          await sendEvent({
            type: 'analysis-complete',
            stage: 'analyzing-prompts',
            data: {
              provider: provider.name,
              prompt: prompt.prompt,
              promptIndex: promptIndex + 1,
              totalPrompts: analysisPrompts.length,
              providerIndex: 0,
              totalProviders: availableProviders.length,
              status: 'failed'
            } as AnalysisProgressData,
            timestamp: new Date()
          });
        }

        completedAnalyses++;
        const progress = Math.round((completedAnalyses / totalAnalyses) * 100);
        
        await sendEvent({
          type: 'progress',
          stage: 'analyzing-prompts',
          data: {
            stage: 'analyzing-prompts',
            progress,
            message: `Completed ${completedAnalyses} of ${totalAnalyses} analyses`
          } as ProgressData,
          timestamp: new Date()
        });
      })
    );
    
    // Wait for all promises in this batch to complete
    await Promise.all(batchPromises);
    
    if (verboseLogging) {
      console.log(`\n✅ Batch ${Math.floor(batchStart / BATCH_SIZE) + 1} complete (${completedAnalyses}/${totalAnalyses} total analyses done)`);
    }
  }

  if (verboseLogging) {
    console.log('\n' + '═'.repeat(80));
    console.log(`🎉 ALL ANALYSES COMPLETE: ${completedAnalyses}/${totalAnalyses} successful`);
    console.log(`📊 Responses collected: ${responses.length}`);
    if (errors.length > 0) {
      console.log(`⚠️  Errors encountered: ${errors.length}`);
    }
    console.log('═'.repeat(80));
  }

  // Stage 4: Calculate scores
  if (verboseLogging) {
    console.log('\n💯 Starting score calculation phase...');
  }
  await sendEvent({
    type: 'stage',
    stage: 'calculating-scores',
    data: {
      stage: 'calculating-scores',
      progress: 0,
      message: 'Calculating brand visibility scores...'
    } as ProgressData,
    timestamp: new Date()
  });

  // Analyze competitors from all responses
  console.log('📊 Analyzing competitor rankings from all responses...');
  const competitorRankings = await analyzeCompetitors(company, responses, competitors);
  console.log(`✅ Analyzed ${competitorRankings.length} competitors`);

  // Send scoring progress for each competitor
  for (let i = 0; i < competitorRankings.length; i++) {
    await sendEvent({
      type: 'scoring-start',
      stage: 'calculating-scores',
      data: {
        competitor: competitorRankings[i].name,
        score: competitorRankings[i].visibilityScore,
        index: i + 1,
        total: competitorRankings.length
      } as ScoringProgressData,
      timestamp: new Date()
    });
  }

  // Analyze competitors by provider
  const { providerRankings, providerComparison } = await analyzeCompetitorsByProvider(
    company, 
    responses, 
    competitors
  );

  // Calculate final scores
  const scores = calculateBrandScores(responses, company.name, competitorRankings);

  await sendEvent({
    type: 'progress',
    stage: 'calculating-scores',
    data: {
      stage: 'calculating-scores',
      progress: 100,
      message: 'Scoring complete'
    } as ProgressData,
    timestamp: new Date()
  });

  // Stage 5: Finalize
  await sendEvent({
    type: 'stage',
    stage: 'finalizing',
    data: {
      stage: 'finalizing',
      progress: 100,
      message: 'Analysis complete!'
    } as ProgressData,
    timestamp: new Date()
  });

  return {
    company,
    knownCompetitors: competitors,
    prompts: analysisPrompts,
    responses,
    scores,
    competitors: competitorRankings,
    providerRankings,
    providerComparison,
    errors: errors.length > 0 ? errors : undefined,
    webSearchUsed: useWebSearch,
  };
}

/**
 * Get available providers based on configured API keys
 */
export function getAvailableProviders() {
  const configuredProviders = getConfiguredProviders();
  // Map to the format expected by the rest of the code
  return configuredProviders.map(provider => ({
    name: provider.name,
    model: provider.defaultModel,
    icon: provider.icon,
  }));
}

/**
 * Create SSE message with proper format
 */
export function createSSEMessage(event: SSEEvent): string {
  // Ensure proper SSE format with event type
  const lines: string[] = [];
  if (event.type) {
    lines.push(`event: ${event.type}`);
  }
  lines.push(`data: ${JSON.stringify(event)}`);
  lines.push(''); // Empty line to signal end of event
  lines.push(''); // Extra newline for proper SSE format
  return lines.join('\n');
}