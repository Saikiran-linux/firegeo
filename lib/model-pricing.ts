/**
 * Model Pricing Configuration
 * Prices are in USD per 1 million tokens
 * Updated as of October 2024
 */

export interface ModelPricing {
  input: number;  // Price per 1M input tokens
  output: number; // Price per 1M output tokens
}

/**
 * Pricing data for different AI models
 * Source: Official provider pricing pages (as of Oct 2024)
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  'gpt-4o': {
    input: 2.50,
    output: 10.00,
  },
  'gpt-4o-mini': {
    input: 0.150,
    output: 0.600,
  },
  'gpt-4-turbo': {
    input: 10.00,
    output: 30.00,
  },
  'gpt-4': {
    input: 30.00,
    output: 60.00,
  },
  'gpt-3.5-turbo': {
    input: 0.50,
    output: 1.50,
  },
  'o1-preview': {
    input: 15.00,
    output: 60.00,
  },
  'o1-mini': {
    input: 3.00,
    output: 12.00,
  },
  'gpt-5-chat-latest': {
    input: 2.50,  // Assumed similar to gpt-4o
    output: 10.00,
  },

  // Anthropic Models
  'claude-3-5-sonnet-20241022': {
    input: 3.00,
    output: 15.00,
  },
  'claude-3-5-sonnet-latest': {
    input: 3.00,
    output: 15.00,
  },
  'claude-3-5-haiku-20241022': {
    input: 0.80,
    output: 4.00,
  },
  'claude-3-opus-20240229': {
    input: 15.00,
    output: 75.00,
  },
  'claude-3-sonnet-20240229': {
    input: 3.00,
    output: 15.00,
  },
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
  },

  // Google Models
  'gemini-2.0-flash-exp': {
    input: 0.00,   // Free during preview
    output: 0.00,
  },
  'gemini-2.5-flash': {
    input: 0.075,  // Assumed pricing
    output: 0.30,
  },
  'gemini-1.5-pro': {
    input: 1.25,
    output: 5.00,
  },
  'gemini-1.5-flash': {
    input: 0.075,
    output: 0.30,
  },
  'gemini-1.0-pro': {
    input: 0.50,
    output: 1.50,
  },

  // Perplexity Models
  'sonar': {
    input: 1.00,   // Perplexity Sonar pricing
    output: 1.00,
  },
  'sonar-pro': {
    input: 3.00,
    output: 15.00,
  },
  'llama-3.1-sonar-small-128k-online': {
    input: 0.20,
    output: 0.20,
  },
  'llama-3.1-sonar-large-128k-online': {
    input: 1.00,
    output: 1.00,
  },
  'llama-3.1-sonar-huge-128k-online': {
    input: 5.00,
    output: 5.00,
  },
};

/**
 * Calculate cost for a model based on token usage
 * @param modelId - The model identifier
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateModelCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Normalize model ID to match pricing keys
  const normalizedModelId = normalizeModelId(modelId);
  
  // Get pricing for the model
  const pricing = MODEL_PRICING[normalizedModelId];
  
  if (!pricing) {
    console.warn(`[Cost Tracking] No pricing data for model: ${modelId} (normalized: ${normalizedModelId})`);
    return 0;
  }

  // Calculate cost (pricing is per 1M tokens, so divide by 1,000,000)
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return totalCost;
}

/**
 * Normalize model ID to match pricing keys
 * Handles various model ID formats from different providers
 */
function normalizeModelId(modelId: string): string {
  // Remove provider prefixes
  let normalized = modelId
    .replace(/^openai:/, '')
    .replace(/^anthropic:/, '')
    .replace(/^google:/, '')
    .replace(/^perplexity:/, '');

  // Handle specific model variations
  if (normalized.includes('gpt-4o') && !normalized.includes('mini')) {
    return 'gpt-4o';
  }
  if (normalized.includes('gpt-4o-mini')) {
    return 'gpt-4o-mini';
  }
  if (normalized.includes('claude-3-5-sonnet')) {
    return 'claude-3-5-sonnet-latest';
  }
  if (normalized.includes('claude-3-5-haiku')) {
    return 'claude-3-5-haiku-20241022';
  }
  if (normalized.includes('gemini-2.5-flash')) {
    return 'gemini-2.5-flash';
  }
  if (normalized.includes('gemini-2.0-flash')) {
    return 'gemini-2.0-flash-exp';
  }
  if (normalized.includes('gemini-1.5-pro')) {
    return 'gemini-1.5-pro';
  }
  if (normalized.includes('gemini-1.5-flash')) {
    return 'gemini-1.5-flash';
  }

  return normalized;
}

/**
 * Get pricing information for a model
 */
export function getModelPricing(modelId: string): ModelPricing | null {
  const normalized = normalizeModelId(modelId);
  return MODEL_PRICING[normalized] || null;
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.0001) return `$${cost.toFixed(6)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(4)}`;
}

/**
 * Calculate cost breakdown
 */
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  modelId: string;
  pricing: ModelPricing | null;
}

export function calculateCostBreakdown(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): CostBreakdown {
  const pricing = getModelPricing(modelId);
  
  if (!pricing) {
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      totalTokens: promptTokens + completionTokens,
      modelId,
      pricing: null,
    };
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    totalTokens: promptTokens + completionTokens,
    modelId,
    pricing,
  };
}

