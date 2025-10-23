import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { analyzePromptWithProviderEnhanced } from '@/lib/ai-utils-enhanced';
import { getConfiguredProviders } from '@/lib/provider-config';
import { 
  isLangfuseEnabled, 
  createAnalysisTrace, 
  updateTraceOutput, 
  flushLangfuse,
  addEvent
} from '@/lib/langfuse-client';
import { saveCitations, saveAggregatedSources } from '@/lib/db/citations';
import { analyzeCitations, calculateBrandVsCompetitorMetrics } from '@/lib/citation-utils';
import type { AIResponse, Citation, CitationAnalysis } from '@/lib/types';

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
    rankings?: Array<{
      position: number;
      company: string;
      reason?: string;
      sentiment?: string;
    }>;
  }[];
}

// GET /api/brand-monitor/prompts - Get all prompts from latest analysis
export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to fetch prompts');
    }

    const analyses = await db.query.brandAnalyses.findMany({
      where: eq(brandAnalyses.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalyses.createdAt),
      limit: 1,
    });

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({ prompts: [] });
    }

    const prompts = (analyses[0].analysisData as any)?.prompts || [];
    return NextResponse.json({ prompts });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/brand-monitor/prompts - Add new prompt to a topic
export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to add prompts');
    }

    const body = await request.json();
    const newPrompt: BrandPrompt = body.prompt;

    if (!newPrompt || !newPrompt.id || !newPrompt.prompt || !newPrompt.topicId) {
      throw new ValidationError('Prompt must have id, prompt, and topicId');
    }

    // Get the latest analysis
    const analyses = await db.query.brandAnalyses.findMany({
      where: eq(brandAnalyses.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalyses.createdAt),
      limit: 1,
    });

    if (!analyses || analyses.length === 0) {
      throw new ValidationError('No analysis found. Please run an analysis first.');
    }

    const analysis = analyses[0];
    const currentAnalysisData = (analysis.analysisData as any) || {};
    const topics = currentAnalysisData.topics || [];

    // Find the topic
    const topicIndex = topics.findIndex((t: any) => t.id === newPrompt.topicId);
    if (topicIndex === -1) {
      throw new ValidationError('Topic not found');
    }

    // Check if prompt already exists
    const existingPromptIds = new Set(topics[topicIndex].prompts.map((p: any) => p.id));
    if (existingPromptIds.has(newPrompt.id)) {
      return NextResponse.json({
        message: 'Prompt already exists',
        addedCount: 0,
      });
    }

    // Add prompt to topic
    topics[topicIndex].prompts.push(newPrompt);

    const updatedAnalysisData = {
      ...currentAnalysisData,
      topics,
    };

    // Update the analysis
    await db
      .update(brandAnalyses)
      .set({
        analysisData: updatedAnalysisData,
        updatedAt: new Date(),
      })
      .where(eq(brandAnalyses.id, analysis.id));

    return NextResponse.json({
      message: 'Prompt added successfully',
      addedCount: 1,
      prompt: newPrompt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/brand-monitor/prompts - Run all prompts against AI providers
export async function PUT(request: NextRequest) {
  // Create Langfuse trace for this analysis workflow
  const trace = createAnalysisTrace('Brand Prompts Analysis', {
    brandName: 'unknown', // Will be updated below
    useWebSearch: true,
    feature: 'prompts-analysis',
  });

  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to run prompts');
    }

    // Parse request body for optional filtering
    const body = await request.json().catch(() => ({}));
    const requestedPromptIds = body.promptIds as string[] | undefined;

    // Get the latest analysis
    const analyses = await db.query.brandAnalyses.findMany({
      where: eq(brandAnalyses.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalyses.createdAt),
      limit: 1,
    });

    if (!analyses || analyses.length === 0) {
      throw new ValidationError('No analysis found. Please run an analysis first.');
    }

    const analysis = analyses[0];
    const topics = (analysis.analysisData as any)?.topics || [];
    
    // Collect all prompts from all topics
    let allPrompts: any[] = [];
    topics.forEach((topic: any) => {
      if (topic.prompts && Array.isArray(topic.prompts)) {
        allPrompts.push(...topic.prompts);
      }
    });
    
    // Filter prompts if specific IDs were requested
    let prompts = allPrompts;
    if (requestedPromptIds && Array.isArray(requestedPromptIds) && requestedPromptIds.length > 0) {
      const promptIdSet = new Set(requestedPromptIds);
      prompts = prompts.filter((p: any) => promptIdSet.has(p.id));
    }

    if (prompts.length === 0) {
      throw new ValidationError('No prompts found to run');
    }

    const companyName = String(analysis.companyName || 'your company').trim();
    const competitors = Array.isArray((analysis.analysisData as any)?.competitors) 
      ? (analysis.analysisData as any).competitors.map((c: any) => String(c).trim()).filter((c: any) => c.length > 0)
      : [];

    // Update trace with actual brand name
    if (trace) {
      addEvent(trace, 'analysis_started', {
        companyName,
        competitorsCount: competitors.length,
        promptsCount: prompts.length,
        userId: sessionResponse.user.id,
      });
    }

    // Get configured providers
    const providers = getConfiguredProviders();

    if (providers.length === 0) {
      throw new ValidationError('No AI providers configured');
    }

    console.log(`[Langfuse] Starting analysis for ${companyName} with ${prompts.length} prompts across ${providers.length} providers`);

    // Process prompts in batches of 10 with parallel provider execution
    // Reduced from 20 to better manage rate limits
    const BATCH_SIZE = 10;
    const results: PromptResult[] = [];

    // Helper function to add delay between API calls (rate limiting)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Helper function to process provider response into unified result format
    const processProviderResponse = (response: any, providerName: string) => {
      // Extract sources and citations from response
      const sources = response?.sources?.map((s: any) => ({
        url: s.url || s.uri || '',
        title: s.title || '',
        snippet: s.snippet || s.text || '',
      })) || [];

      const citations = response?.citations?.map((c: any) => ({
        url: c.url || '',
        title: c.title || '',
        source: c.source || c.domain || '',
        mentionedCompanies: c.mentionedCompanies || [],
      })) || [];

      // Extract competitors from response
      const extractedCompetitors = response?.competitors?.map((comp: any) => {
        if (typeof comp === 'string') {
          return { name: comp };
        }
        return {
          name: comp.name || comp.company || comp,
          position: comp.position,
          sentimentScore: comp.sentimentScore || comp.sentiment,
        };
      }) || [];

      // Calculate sentiment score from sentiment string if needed
      let sentimentScore = response?.sentimentScore;
      if (!sentimentScore && response?.sentiment) {
        const sentimentMap: Record<string, number> = {
          'positive': 80,
          'neutral': 50,
          'negative': 20,
          'mixed': 50,
        };
        sentimentScore = sentimentMap[response.sentiment.toLowerCase()] || 50;
      }

      return {
        provider: providerName,
        response: response?.response || response?.text || '',
        sources: sources.length > 0 ? sources : undefined,
        citations: citations.length > 0 ? citations : undefined,
        brandMentioned: response?.brandMentioned,
        brandPosition: response?.brandPosition,
        sentiment: response?.sentiment,
        sentimentScore: sentimentScore,
        confidence: response?.confidence,
        competitors: extractedCompetitors.length > 0 ? extractedCompetitors : undefined,
        rankings: response?.rankings,
        timestamp: new Date().toISOString(),
      };
    };
    
    // Helper function to process a single prompt across all providers in parallel
    async function processPromptAcrossProviders(prompt: BrandPrompt): Promise<PromptResult> {
      const promptResults: PromptResult = {
        promptId: prompt.id,
        prompt: prompt.prompt,
        topicId: prompt.topicId,
        results: [],
      };

      console.log(`[prompts] Running prompt "${prompt.prompt.substring(0, 50)}..." across ${providers.length} providers in parallel...`);

      // Run all providers in parallel for this prompt
      const providerPromises = providers.map(async (provider) => {
        try {
          // Add stagger delay to avoid hitting rate limits simultaneously
          // Anthropic: 50k tokens/min, OpenAI: high, Google: 60 req/min, Perplexity: 20 req/min
          const staggerDelay = providers.indexOf(provider) * 1500; // 1.5s between each provider start
          await delay(staggerDelay);

          const response = await analyzePromptWithProviderEnhanced(
            prompt.prompt,
            provider.id,
            companyName,
            competitors,
            false, // not mock mode
            true, // use web search
            trace // Pass Langfuse trace for cost tracking
          );

          console.log(`[prompts] ${provider.name} response received with ${response?.citations?.length || 0} citations`);

          return processProviderResponse(response, provider.name);
        } catch (error: any) {
          console.error(`[prompts] Error running prompt with ${provider.name}:`, error);
          
          // Check if it's a rate limit error
          const errorObj = error as any;
          const isRateLimitError = error instanceof Error && 
            (error.message.includes('rate limit') || 
             error.message.includes('429') ||
             errorObj.statusCode === 429 ||
             errorObj.lastError?.statusCode === 429);
          
          if (isRateLimitError) {
            // Extract retry-after from response headers or error message
            let retryAfter = 60; // Default to 60 seconds
            
            // Try to get from response headers (Anthropic provides this)
            if (errorObj.responseHeaders?.['retry-after']) {
              retryAfter = parseInt(errorObj.responseHeaders['retry-after']);
            } else if (errorObj.lastError?.responseHeaders?.['retry-after']) {
              retryAfter = parseInt(errorObj.lastError.responseHeaders['retry-after']);
            } else {
              // Try to extract from error message
              const retryAfterMatch = error.message.match(/retry[- ]after[:\s]+(\d+)/i);
              if (retryAfterMatch) {
                retryAfter = parseInt(retryAfterMatch[1]);
              }
            }
            
            // Check rate limit reset time from Anthropic headers
            if (errorObj.responseHeaders?.['anthropic-ratelimit-input-tokens-reset']) {
              const resetTime = new Date(errorObj.responseHeaders['anthropic-ratelimit-input-tokens-reset']);
              const now = new Date();
              const secondsUntilReset = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);
              if (secondsUntilReset > 0) {
                retryAfter = Math.max(retryAfter, secondsUntilReset);
              }
            } else if (errorObj.lastError?.responseHeaders?.['anthropic-ratelimit-input-tokens-reset']) {
              const resetTime = new Date(errorObj.lastError.responseHeaders['anthropic-ratelimit-input-tokens-reset']);
              const now = new Date();
              const secondsUntilReset = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);
              if (secondsUntilReset > 0) {
                retryAfter = Math.max(retryAfter, secondsUntilReset);
              }
            }
            
            console.log(`[prompts] Rate limit hit for ${provider.name}, waiting ${retryAfter}s before retry`);
            await delay(retryAfter * 1000);
            
            // Retry once after rate limit
            try {
              const response = await analyzePromptWithProviderEnhanced(
                prompt.prompt,
                provider.id,
                companyName,
                competitors,
                false,
                true
              );

              return processProviderResponse(response, provider.name);
            } catch (retryError) {
              console.error(`[prompts] Retry failed for ${provider.name}:`, retryError);
              return {
                provider: provider.name,
                response: '',
                error: retryError instanceof Error ? retryError.message : 'Unknown error',
                timestamp: new Date().toISOString(),
              };
            }
          }
          
          return {
            provider: provider.name,
            response: '',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          };
        }
      });

      // Wait for all providers to complete for this prompt
      promptResults.results = await Promise.all(providerPromises);
      console.log(`[prompts] Completed prompt "${prompt.prompt.substring(0, 50)}..." across all providers`);
      
      return promptResults;
    }

    // Process prompts in batches
    for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
      const batch = prompts.slice(i, i + BATCH_SIZE);
      console.log(`[prompts] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} prompts`);
      
      // Process all prompts in the batch in parallel
      const batchResults = await Promise.all(
        batch.map((prompt: any) => processPromptAcrossProviders(prompt))
      );
      
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + BATCH_SIZE < prompts.length) {
        console.log(`[prompts] Waiting 10 seconds before next batch to respect rate limits...`);
        await delay(10000); // 10 seconds between batches
      }
    }

    console.log(`[prompts] All prompts completed. Total results: ${results.length}`);

    // ==================================================================
    // Extract and save citations from all provider responses
    // ==================================================================
    console.log(`[prompts] Extracting citations from results...`);
    
    // Convert promptResults to AIResponse format for citation analysis
    const aiResponses: AIResponse[] = [];
    let totalCitations = 0;
    
    for (const promptResult of results) {
      for (const result of promptResult.results) {
        if (!result.error && result.citations && result.citations.length > 0) {
          aiResponses.push({
            provider: result.provider,
            prompt: promptResult.prompt,
            response: result.response,
            citations: result.citations as Citation[],
            competitors: result.competitors?.map(c => c.name) || competitors,
            brandMentioned: result.brandMentioned || false,
            brandPosition: result.brandPosition,
            sentiment: result.sentiment || 'neutral',
            confidence: result.confidence || 0.5,
            timestamp: new Date(result.timestamp),
          });
          totalCitations += result.citations.length;
        }
      }
    }

    console.log(`[prompts] Found ${totalCitations} citations from ${aiResponses.length} responses`);

    // Save individual citations to database
    if (aiResponses.length > 0) {
      console.log(`[prompts] Saving citations to database...`);
      
      for (const response of aiResponses) {
        if (response.citations && response.citations.length > 0) {
          try {
            await saveCitations(
              analysis.id,
              response.provider,
              response.prompt,
              response.citations
            );
            console.log(`[prompts] Saved ${response.citations.length} citations for ${response.provider}`);
          } catch (error) {
            console.error(`[prompts] Error saving citations for ${response.provider}:`, error);
          }
        }
      }

      // Analyze citations to build competitive metrics
      console.log(`[prompts] Analyzing citations for competitive metrics...`);
      const citationAnalysis: CitationAnalysis = analyzeCitations(
        aiResponses,
        companyName,
        competitors
      );

      // Calculate brand vs competitor metrics
      const competitiveMetrics = calculateBrandVsCompetitorMetrics(
        aiResponses,
        companyName,
        competitors
      );

      console.log(`[prompts] Citation Analysis Summary:`);
      console.log(`  - Total sources: ${citationAnalysis.totalSources}`);
      console.log(`  - Brand citations: ${citationAnalysis.brandCitations.totalCitations}`);
      console.log(`  - Brand share of voice: ${competitiveMetrics.shareOfVoice.brand.toFixed(1)}%`);
      if (competitiveMetrics.citationGap.leadingCompetitor) {
        console.log(`  - Leading competitor: ${competitiveMetrics.citationGap.leadingCompetitor} (+${competitiveMetrics.citationGap.gap} citations)`);
      }

      // Save aggregated citation sources
      try {
        await saveAggregatedSources(analysis.id, citationAnalysis);
        console.log(`[prompts] Saved aggregated citation sources`);
      } catch (error) {
        console.error(`[prompts] Error saving aggregated sources:`, error);
      }

      // Add citation analysis to analysis data
      const updatedAnalysisData = {
        ...(analysis.analysisData as any || {}),
        promptResults: results,
        citationAnalysis,
        competitiveMetrics,
        lastRunAt: new Date().toISOString(),
      };

      await db
        .update(brandAnalyses)
        .set({
          analysisData: updatedAnalysisData,
          updatedAt: new Date(),
        })
        .where(eq(brandAnalyses.id, analysis.id));
    } else {
      // No citations found, just save the results
      console.log(`[prompts] No citations found in responses`);
      
      const updatedAnalysisData = {
        ...(analysis.analysisData as any || {}),
        promptResults: results,
        lastRunAt: new Date().toISOString(),
      };

      await db
        .update(brandAnalyses)
        .set({
          analysisData: updatedAnalysisData,
          updatedAt: new Date(),
        })
        .where(eq(brandAnalyses.id, analysis.id));
    }

    // Update trace with final results and flush to Langfuse
    if (trace) {
      updateTraceOutput(trace, {
        totalPrompts: prompts.length,
        totalProviders: providers.length,
        totalResults: results.length,
        successfulResults: results.reduce((sum, r) => sum + r.results.filter(res => !res.error).length, 0),
        failedResults: results.reduce((sum, r) => sum + r.results.filter(res => res.error).length, 0),
      }, {
        companyName,
        competitors,
        promptsCount: prompts.length,
        providersCount: providers.length,
      });
      
      // Flush traces to Langfuse
      await flushLangfuse();
      console.log('[Langfuse] Trace completed and flushed');
    }

    return NextResponse.json({
      message: 'Prompts executed successfully',
      results,
    });
  } catch (error) {
    // Log error to trace if available
    if (trace) {
      addEvent(trace, 'analysis_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      await flushLangfuse();
    }
    return handleApiError(error);
  }
}

// DELETE /api/brand-monitor/prompts - Delete a specific prompt
export async function DELETE(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to delete prompts');
    }

    const body = await request.json();
    const promptId = body.promptId;

    if (!promptId) {
      throw new ValidationError('Prompt ID is required');
    }

    // Get the latest analysis
    const analyses = await db.query.brandAnalyses.findMany({
      where: eq(brandAnalyses.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalyses.createdAt),
      limit: 1,
    });

    if (!analyses || analyses.length === 0) {
      throw new ValidationError('No analysis found');
    }

    const analysis = analyses[0];
    const currentAnalysisData = (analysis.analysisData as any) || {};
    const topics = currentAnalysisData.topics || [];

    // Find and remove the prompt from its topic
    let found = false;
    for (const topic of topics) {
      if (topic.prompts && Array.isArray(topic.prompts)) {
        const initialLength = topic.prompts.length;
        topic.prompts = topic.prompts.filter((p: any) => p.id !== promptId);
        if (topic.prompts.length < initialLength) {
          found = true;
          break;
        }
      }
    }

    if (!found) {
      throw new ValidationError('Prompt not found');
    }

    // Also remove any results for this prompt
    const promptResults = currentAnalysisData.promptResults || [];
    const updatedResults = promptResults.filter((r: any) => r.promptId !== promptId);

    // Update the analysis
    const updatedAnalysisData = {
      ...currentAnalysisData,
      topics,
      promptResults: updatedResults,
    };

    await db
      .update(brandAnalyses)
      .set({
        analysisData: updatedAnalysisData,
        updatedAt: new Date(),
      })
      .where(eq(brandAnalyses.id, analysis.id));

    return NextResponse.json({
      message: 'Prompt deleted successfully',
      promptId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
