/**
 * Langfuse Client Wrapper
 * Provides observability for all AI model interactions with cost tracking
 * Self-hosted Langfuse instance running on http://localhost:3001
 */

import { Langfuse } from 'langfuse';
import { calculateCostBreakdown, formatCost } from './model-pricing';

// Initialize Langfuse client
let langfuseClient: Langfuse | null = null;
let isEnabled = false;

try {
  // Debug environment variables
  console.log('[Langfuse] Environment check:', {
    LANGFUSE_ENABLED: process.env.LANGFUSE_ENABLED,
    LANGFUSE_URL: process.env.LANGFUSE_URL,
    hasPublicKey: !!process.env.LANGFUSE_PUBLIC_KEY,
    hasSecretKey: !!process.env.LANGFUSE_SECRET_KEY,
  });

  // Check if Langfuse is enabled via environment variables
  isEnabled = process.env.LANGFUSE_ENABLED === 'true' && 
              !!process.env.LANGFUSE_PUBLIC_KEY && 
              !!process.env.LANGFUSE_SECRET_KEY;
  
  if (isEnabled) {
    langfuseClient = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_URL || 'http://localhost:3001',
      flushAt: 1, // Flush immediately for development
      flushInterval: 1000, // Flush every second
      requestTimeout: 10000, // 10 second timeout
    });
    console.log('✅ Langfuse tracing enabled:', process.env.LANGFUSE_URL || 'http://localhost:3001');
    console.log('[Langfuse] Client initialized successfully');
  } else {
    console.log('ℹ️ Langfuse tracing disabled - missing configuration:');
    if (process.env.LANGFUSE_ENABLED !== 'true') {
      console.log('  - LANGFUSE_ENABLED is not "true":', process.env.LANGFUSE_ENABLED);
    }
    if (!process.env.LANGFUSE_PUBLIC_KEY) {
      console.log('  - LANGFUSE_PUBLIC_KEY is missing');
    }
    if (!process.env.LANGFUSE_SECRET_KEY) {
      console.log('  - LANGFUSE_SECRET_KEY is missing');
    }
  }
} catch (error) {
  console.error('❌ Failed to initialize Langfuse client:', error);
  isEnabled = false;
}

/**
 * Check if Langfuse is enabled
 */
export function isLangfuseEnabled(): boolean {
  return isEnabled && langfuseClient !== null;
}

/**
 * Get the Langfuse client instance
 */
export function getLangfuseClient(): Langfuse | null {
  return langfuseClient;
}

/**
 * Flush all pending traces (call before process exit)
 */
export async function flushLangfuse(): Promise<void> {
  if (!isEnabled || !langfuseClient) {
    console.log('[Langfuse] Flush skipped - not enabled');
    return;
  }
  
  try {
    console.log('[Langfuse] Flushing traces to cloud...');
    await langfuseClient.flushAsync();
    console.log('[Langfuse] ✅ Traces flushed successfully');
  } catch (error) {
    console.error('[Langfuse] ❌ Failed to flush traces:', error);
  }
}

/**
 * Shutdown Langfuse client gracefully
 */
export async function shutdownLangfuse(): Promise<void> {
  if (!isEnabled || !langfuseClient) return;
  
  try {
    await langfuseClient.shutdownAsync();
  } catch (error) {
    console.error('Failed to shutdown Langfuse:', error);
  }
}

/**
 * Brand monitoring metadata
 */
export interface BrandMonitoringMetadata {
  brandName: string;
  competitors?: string[];
  useWebSearch?: boolean;
  promptCategory?: string;
  feature?: string;
}

/**
 * Provider metadata
 */
export interface ProviderMetadata {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Output metadata for analysis results
 */
export interface AnalysisOutputMetadata {
  brandMentioned?: boolean;
  brandPosition?: number;
  sentiment?: string;
  confidence?: number;
  citationsCount?: number;
  competitorsMentioned?: string[];
  visibilityScore?: number;
}

// Track cumulative costs per trace
const traceCosts = new Map<string, number>();

/**
 * Create a parent trace for an entire analysis workflow
 */
export function createAnalysisTrace(
  name: string,
  metadata: BrandMonitoringMetadata
) {
  if (!isEnabled || !langfuseClient) {
    console.log('[Langfuse] Trace creation skipped - not enabled');
    return null;
  }

  try {
    console.log('[Langfuse] Creating trace:', name);
    const trace = langfuseClient.trace({
      name,
      userId: 'system',
      metadata: {
        brandName: metadata.brandName,
        competitors: metadata.competitors,
        useWebSearch: metadata.useWebSearch,
        feature: metadata.feature || 'brand-analysis',
        timestamp: new Date().toISOString(),
      },
      tags: [
        'brand-monitoring',
        metadata.useWebSearch ? 'web-search' : 'no-web-search',
        metadata.feature || 'analysis',
      ],
    });

    // Initialize cost tracking for this trace
    if (trace && trace.id) {
      traceCosts.set(trace.id, 0);
    }

    console.log('[Langfuse] ✅ Trace created successfully:', name);
    return trace;
  } catch (error) {
    console.error('[Langfuse] ❌ Failed to create trace:', error);
    return null;
  }
}

/**
 * Create a generation (LLM call) within a trace
 */
export function createGeneration(
  trace: any,
  name: string,
  metadata: {
    provider: ProviderMetadata;
    brand?: BrandMonitoringMetadata;
    prompt: string;
  }
) {
  if (!isEnabled || !trace) {
    console.log('[Langfuse] Generation creation skipped - not enabled or no trace');
    return null;
  }

  try {
    console.log('[Langfuse] Creating generation:', name, 'Provider:', metadata.provider.provider);
    const generation = trace.generation({
      name,
      model: metadata.provider.model,
      modelParameters: {
        temperature: metadata.provider.temperature,
        maxTokens: metadata.provider.maxTokens,
      },
      input: metadata.prompt,
      metadata: {
        provider: metadata.provider.provider,
        brandName: metadata.brand?.brandName,
        competitors: metadata.brand?.competitors,
        useWebSearch: metadata.brand?.useWebSearch,
      },
    });

    console.log('[Langfuse] ✅ Generation created:', name);
    return generation;
  } catch (error) {
    console.error('[Langfuse] ❌ Failed to create generation:', error);
    return null;
  }
}

/**
 * Update generation with completion data and cost tracking
 */
export function completeGeneration(
  generation: any,
  output: string,
  metadata?: {
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    analysis?: AnalysisOutputMetadata;
    modelId?: string;
    providerMetadata?: any;
    traceId?: string;
  }
) {
  if (!isEnabled || !generation) return;

  try {
    let costData: any = {};
    
    // First, try to extract cost from provider metadata
    let extractedCost = extractCostFromProviderMetadata(metadata?.providerMetadata);
    
    // If provider doesn't return cost, calculate it ourselves
    if (extractedCost === null && metadata?.usage && metadata?.modelId) {
      const { promptTokens = 0, completionTokens = 0 } = metadata.usage;
      const costBreakdown = calculateCostBreakdown(
        metadata.modelId,
        promptTokens,
        completionTokens
      );

      console.log('[Langfuse Cost] Calculated from pricing table:', {
        model: metadata.modelId,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        cost: formatCost(costBreakdown.totalCost),
      });

      extractedCost = costBreakdown.totalCost;
      costData = {
        costDetails: {
          totalCost: costBreakdown.totalCost,
          inputCost: costBreakdown.inputCost,
          outputCost: costBreakdown.outputCost,
          formattedCost: formatCost(costBreakdown.totalCost),
          pricing: costBreakdown.pricing,
          source: 'calculated',
        },
      };
    } else if (extractedCost !== null) {
      console.log('[Langfuse Cost] Extracted from provider:', {
        model: metadata?.modelId,
        cost: formatCost(extractedCost),
      });

      costData = {
        costDetails: {
          totalCost: extractedCost,
          formattedCost: formatCost(extractedCost),
          source: 'provider',
        },
      };
    }

    // Add to cumulative trace cost
    if (metadata?.traceId && extractedCost !== null) {
      const currentCost = traceCosts.get(metadata.traceId) || 0;
      traceCosts.set(metadata.traceId, currentCost + extractedCost);
    }

    generation.end({
      output,
      usage: metadata?.usage,
      metadata: {
        ...metadata?.analysis,
        ...costData,
        providerMetadata: metadata?.providerMetadata,
      },
    });
  } catch (error) {
    console.error('Failed to complete Langfuse generation:', error);
  }
}

/**
 * Extract cost from provider metadata
 * Different providers return cost in different formats
 */
function extractCostFromProviderMetadata(providerMetadata: any): number | null {
  if (!providerMetadata) return null;

  try {
    // OpenAI format (if they provide it)
    if (providerMetadata.openai?.cost) {
      return providerMetadata.openai.cost;
    }

    // Anthropic format (if they provide it)
    if (providerMetadata.anthropic?.cost) {
      return providerMetadata.anthropic.cost;
    }

    // Google format (if they provide it)  
    if (providerMetadata.google?.cost) {
      return providerMetadata.google.cost;
    }

    // Perplexity format (if they provide it)
    if (providerMetadata.perplexity?.cost) {
      return providerMetadata.perplexity.cost;
    }

    // Generic cost field
    if (typeof providerMetadata.cost === 'number') {
      return providerMetadata.cost;
    }

    // Check for usage_metadata with pricing (common in some APIs)
    if (providerMetadata.usage_metadata?.total_cost) {
      return providerMetadata.usage_metadata.total_cost;
    }
  } catch (error) {
    console.warn('[Cost Extraction] Error extracting cost from provider metadata:', error);
  }

  return null;
}

/**
 * Create a span for non-LLM operations
 */
export function createSpan(
  trace: any,
  name: string,
  metadata?: Record<string, any>
) {
  if (!isEnabled || !trace) return null;

  try {
    const span = trace.span({
      name,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });

    return span;
  } catch (error) {
    console.error('Failed to create Langfuse span:', error);
    return null;
  }
}

/**
 * Update span with results
 */
export function completeSpan(
  span: any,
  output?: any,
  metadata?: Record<string, any>
) {
  if (!isEnabled || !span) return;

  try {
    span.end({
      output,
      metadata,
    });
  } catch (error) {
    console.error('Failed to complete Langfuse span:', error);
  }
}

/**
 * Add an event to a trace
 */
export function addEvent(
  trace: any,
  name: string,
  metadata?: Record<string, any>
) {
  if (!isEnabled || !trace) return;

  try {
    trace.event({
      name,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to add Langfuse event:', error);
  }
}

/**
 * Update trace with final results including cumulative cost
 */
export function updateTraceOutput(
  trace: any,
  output: any,
  metadata?: Record<string, any>
) {
  if (!isEnabled || !trace) return;

  try {
    // Get cumulative cost for this trace
    const totalCost = trace.id ? traceCosts.get(trace.id) || 0 : 0;
    
    const enrichedMetadata = {
      ...metadata,
      totalCost,
      formattedTotalCost: formatCost(totalCost),
    };

    if (totalCost > 0) {
      console.log('[Langfuse] Trace total cost:', formatCost(totalCost));
    }

    trace.update({
      output,
      metadata: enrichedMetadata,
    });

    // Clean up cost tracking
    if (trace.id) {
      traceCosts.delete(trace.id);
    }
  } catch (error) {
    console.error('Failed to update Langfuse trace:', error);
  }
}

/**
 * Wrapper for generateText with Langfuse tracing
 */
export async function traceGenerateText<T>(
  trace: any,
  name: string,
  fn: () => Promise<T>,
  metadata: {
    provider: ProviderMetadata;
    brand?: BrandMonitoringMetadata;
    prompt: string;
  }
): Promise<T> {
  const generation = createGeneration(trace, name, metadata);
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    // Extract text and usage from AI SDK response
    const responseText = typeof result === 'object' && result !== null && 'text' in result
      ? (result as any).text
      : String(result);

    const usage = typeof result === 'object' && result !== null && 'usage' in result
      ? (result as any).usage
      : undefined;
    
    const providerMetadata = typeof result === 'object' && result !== null && 'providerMetadata' in result
      ? (result as any).providerMetadata
      : undefined;

    // Log full usage structure to see what's available
    if (usage) {
      console.log('[Langfuse] Full usage object:', JSON.stringify(usage, null, 2));
    }
    if (providerMetadata) {
      console.log('[Langfuse] Full providerMetadata:', JSON.stringify(providerMetadata, null, 2));
    }

    if (generation) {
      completeGeneration(generation, responseText, {
        usage: usage ? {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        } : undefined,
        modelId: metadata.provider.model,
        providerMetadata,
        traceId: trace?.id,
      });
    }

    return result;
  } catch (error) {
    if (generation) {
      generation.end({
        statusMessage: error instanceof Error ? error.message : String(error),
        level: 'ERROR',
      });
    }
    throw error;
  }
}

/**
 * Wrapper for generateObject with Langfuse tracing
 */
export async function traceGenerateObject<T>(
  trace: any,
  name: string,
  fn: () => Promise<T>,
  metadata: {
    provider: ProviderMetadata;
    brand?: BrandMonitoringMetadata;
    prompt: string;
    schema?: string;
  }
): Promise<T> {
  const generation = createGeneration(trace, name, {
    ...metadata,
    prompt: metadata.prompt + (metadata.schema ? `\n\nSchema: ${metadata.schema}` : ''),
  });

  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    // Extract object and usage from AI SDK response
    const resultObject = typeof result === 'object' && result !== null && 'object' in result
      ? (result as any).object
      : result;

    const usage = typeof result === 'object' && result !== null && 'usage' in result
      ? (result as any).usage
      : undefined;
    
    const providerMetadata = typeof result === 'object' && result !== null && 'providerMetadata' in result
      ? (result as any).providerMetadata
      : undefined;

    if (generation) {
      completeGeneration(generation, JSON.stringify(resultObject), {
        usage: usage ? {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        } : undefined,
        modelId: metadata.provider.model,
        providerMetadata,
        traceId: trace?.id,
      });
    }

    return result;
  } catch (error) {
    if (generation) {
      generation.end({
        statusMessage: error instanceof Error ? error.message : String(error),
        level: 'ERROR',
      });
    }
    throw error;
  }
}

/**
 * Wrapper for any async function with span tracing
 */
export async function withSpan<T>(
  trace: any,
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const span = createSpan(trace, name, metadata);
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    if (span) {
      completeSpan(span, result, {
        ...metadata,
        duration_ms: duration,
        success: true,
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (span) {
      span.end({
        statusMessage: error instanceof Error ? error.message : String(error),
        level: 'ERROR',
        metadata: {
          ...metadata,
          duration_ms: duration,
          success: false,
        },
      });
    }

    throw error;
  }
}

// Export the client for direct access if needed
export { langfuseClient };

