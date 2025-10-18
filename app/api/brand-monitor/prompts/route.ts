import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { analyzePromptWithProviderEnhanced } from '@/lib/ai-utils-enhanced';
import { getConfiguredProviders } from '@/lib/provider-config';

interface BrandPrompt {
  id: string;
  prompt: string;
  category: 'ranking' | 'comparison' | 'alternatives' | 'recommendations';
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

// POST /api/brand-monitor/prompts - Add new prompts to latest analysis
export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to add prompts');
    }

    const body = await request.json();
    const newPrompts: BrandPrompt[] = body.prompts || [];

    if (!Array.isArray(newPrompts) || newPrompts.length === 0) {
      throw new ValidationError('Prompts array is required and must not be empty');
    }

    // Validate each prompt
    for (const prompt of newPrompts) {
      if (!prompt.id || !prompt.prompt || !prompt.category) {
        throw new ValidationError('Each prompt must have id, prompt, and category');
      }
      if (!['ranking', 'comparison', 'alternatives', 'recommendations'].includes(prompt.category)) {
        throw new ValidationError(`Invalid category: ${prompt.category}`);
      }
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
    const existingPrompts = currentAnalysisData.prompts || [];

    // Merge new prompts with existing ones (avoid duplicates)
    const existingIds = new Set(existingPrompts.map((p: any) => p.id));
    const promptsToAdd = newPrompts.filter((p) => !existingIds.has(p.id));

    if (promptsToAdd.length === 0) {
      return NextResponse.json({
        message: 'All prompts already exist',
        addedCount: 0,
        totalPrompts: existingPrompts.length,
      });
    }

    const updatedPrompts = [...existingPrompts, ...promptsToAdd];
    const updatedAnalysisData = {
      ...currentAnalysisData,
      prompts: updatedPrompts,
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
      message: 'Prompts added successfully',
      addedCount: promptsToAdd.length,
      totalPrompts: updatedPrompts.length,
      prompts: updatedPrompts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/brand-monitor/prompts - Run all prompts against AI providers
export async function PUT(request: NextRequest) {
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
    let prompts = (analysis.analysisData as any)?.prompts || [];
    
    // Filter prompts if specific IDs were requested
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

    // Get configured providers
    const providers = getConfiguredProviders();

    if (providers.length === 0) {
      throw new ValidationError('No AI providers configured');
    }

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
        category: prompt.category,
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
            true // use web search
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

    // Save results to analysis data
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

    return NextResponse.json({
      message: 'Prompts executed successfully',
      results,
    });
  } catch (error) {
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
    const prompts = currentAnalysisData.prompts || [];

    // Filter out the prompt to delete
    const updatedPrompts = prompts.filter((p: any) => p.id !== promptId);

    // Also remove any results for this prompt
    const promptResults = currentAnalysisData.promptResults || [];
    const updatedResults = promptResults.filter((r: any) => r.promptId !== promptId);

    // Update the analysis
    const updatedAnalysisData = {
      ...currentAnalysisData,
      prompts: updatedPrompts,
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
