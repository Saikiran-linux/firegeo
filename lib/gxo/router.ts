/**
 * GXO Model Router
 * Intelligent model routing across multiple AI providers for brand analysis and chat
 */

import { LanguageModel } from "ai";
import { PROVIDER_CONFIGS, getAvailableProviders } from "@/lib/provider-config";

export type TaskType =
  | "brand-analysis"
  | "competitive-analysis"
  | "chat"
  | "quick-query"
  | "long-document"
  | "web-search";

export interface RouteConfig {
  providerId: string;
  modelId: string;
  model: LanguageModel;
  reasoning: string;
}

/**
 * Task-based routing priorities
 * Defines which providers and models are best suited for each task type
 */
const TASK_ROUTING_PRIORITIES: Record<
  TaskType,
  Array<{ providerId: string; modelId: string; reasoning: string }>
> = {
  "brand-analysis": [
    {
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      reasoning: "Claude Sonnet excels at detailed analysis and structured reasoning",
    },
    {
      providerId: "openai",
      modelId: "gpt-5-2025-08-07",
      reasoning: "GPT-5 provides comprehensive analysis with strong context understanding",
    },
    {
      providerId: "google",
      modelId: "gemini-1.5-pro-latest",
      reasoning: "Gemini Pro offers extensive context window for thorough analysis",
    },
  ],
  "competitive-analysis": [
    {
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      reasoning: "Claude excels at comparative analysis and nuanced differentiation",
    },
    {
      providerId: "openai",
      modelId: "gpt-5-2025-08-07",
      reasoning: "GPT-5 provides balanced competitive insights",
    },
    {
      providerId: "google",
      modelId: "gemini-1.5-pro-latest",
      reasoning: "Gemini Pro handles multi-dimensional comparisons well",
    },
  ],
  chat: [
    {
      providerId: "openai",
      modelId: "gpt-5-chat-latest",
      reasoning: "GPT-5 Chat optimized for conversational interactions",
    },
    {
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      reasoning: "Claude provides natural, helpful conversation",
    },
    {
      providerId: "google",
      modelId: "gemini-1.5-flash-latest",
      reasoning: "Gemini Flash offers fast, efficient chat responses",
    },
  ],
  "quick-query": [
    {
      providerId: "google",
      modelId: "gemini-1.5-flash-latest",
      reasoning: "Gemini Flash optimized for speed and efficiency",
    },
    {
      providerId: "openai",
      modelId: "gpt-5-nano",
      reasoning: "GPT-5 Nano provides fast, cost-effective responses",
    },
    {
      providerId: "anthropic",
      modelId: "claude-3-haiku-20240307",
      reasoning: "Claude Haiku offers quick, concise answers",
    },
  ],
  "long-document": [
    {
      providerId: "google",
      modelId: "gemini-1.5-pro-latest",
      reasoning: "Gemini Pro supports up to 2M tokens for extensive documents",
    },
    {
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      reasoning: "Claude Sonnet handles 200K tokens with excellent comprehension",
    },
    {
      providerId: "openai",
      modelId: "gpt-5-2025-08-07",
      reasoning: "GPT-5 supports 200K tokens with strong analytical capabilities",
    },
  ],
  "web-search": [
    {
      providerId: "perplexity",
      modelId: "sonar-pro",
      reasoning: "Perplexity Sonar Pro specialized for web search and real-time information",
    },
    {
      providerId: "perplexity",
      modelId: "sonar",
      reasoning: "Perplexity Sonar provides efficient web-enhanced responses",
    },
    {
      providerId: "openai",
      modelId: "gpt-5-2025-08-07",
      reasoning: "GPT-5 with web search capabilities",
    },
  ],
};

/**
 * Route to the best available model for a given task
 * Falls back through priority list until an available provider is found
 */
export function routeToModel(
  taskType: TaskType,
  options?: {
    contentLength?: number;
    preferredProvider?: string;
    requireWebSearch?: boolean;
  }
): RouteConfig | null {
  const { contentLength, preferredProvider, requireWebSearch } = options || {};
  const availableProviders = getAvailableProviders();
  
  // If a specific provider is preferred and available, try it first
  if (preferredProvider && availableProviders.some((p) => p.id === preferredProvider)) {
    const provider = PROVIDER_CONFIGS[preferredProvider];
    const priorities = TASK_ROUTING_PRIORITIES[taskType];
    const match = priorities.find((p) => p.providerId === preferredProvider);
    
    if (match) {
      const model = provider.getModel(match.modelId);
      if (model) {
        return {
          providerId: match.providerId,
          modelId: match.modelId,
          model,
          reasoning: `${match.reasoning} (user preference)`,
        };
      }
    }
  }

  // For long documents, override with appropriate models
  if (contentLength && contentLength > 100000) {
    const longDocPriorities = TASK_ROUTING_PRIORITIES["long-document"];
    for (const priority of longDocPriorities) {
      if (availableProviders.some((p) => p.id === priority.providerId)) {
        const provider = PROVIDER_CONFIGS[priority.providerId];
        const model = provider.getModel(priority.modelId);
        if (model) {
          return {
            providerId: priority.providerId,
            modelId: priority.modelId,
            model,
            reasoning: `${priority.reasoning} (long document detected: ${contentLength} chars)`,
          };
        }
      }
    }
  }

  // If web search is required, use web-search priorities
  if (requireWebSearch) {
    const webSearchPriorities = TASK_ROUTING_PRIORITIES["web-search"];
    for (const priority of webSearchPriorities) {
      if (availableProviders.some((p) => p.id === priority.providerId)) {
        const provider = PROVIDER_CONFIGS[priority.providerId];
        const model = provider.getModel(priority.modelId);
        if (model) {
          return {
            providerId: priority.providerId,
            modelId: priority.modelId,
            model,
            reasoning: `${priority.reasoning} (web search required)`,
          };
        }
      }
    }
  }

  // Standard routing through priority list
  const priorities = TASK_ROUTING_PRIORITIES[taskType];
  for (const priority of priorities) {
    if (availableProviders.some((p) => p.id === priority.providerId)) {
      const provider = PROVIDER_CONFIGS[priority.providerId];
      const model = provider.getModel(priority.modelId);
      if (model) {
        return {
          providerId: priority.providerId,
          modelId: priority.modelId,
          model,
          reasoning: priority.reasoning,
        };
      }
    }
  }

  // Fallback: use any available provider's default model
  if (availableProviders.length > 0) {
    const fallbackProvider = availableProviders[0];
    const model = fallbackProvider.getModel();
    if (model) {
      return {
        providerId: fallbackProvider.id,
        modelId: fallbackProvider.defaultModel,
        model,
        reasoning: `Fallback to ${fallbackProvider.name} (first available provider)`,
      };
    }
  }

  return null;
}

/**
 * Get model for brand analysis
 */
export function getBrandAnalysisModel(options?: {
  contentLength?: number;
  preferredProvider?: string;
}) {
  return routeToModel("brand-analysis", options);
}

/**
 * Get model for chat
 */
export function getChatModel(options?: { preferredProvider?: string }) {
  return routeToModel("chat", options);
}

/**
 * Get model for competitive analysis
 */
export function getCompetitiveAnalysisModel(options?: {
  contentLength?: number;
  preferredProvider?: string;
}) {
  return routeToModel("competitive-analysis", options);
}

/**
 * Get model for web search tasks
 */
export function getWebSearchModel(options?: { preferredProvider?: string }) {
  return routeToModel("web-search", options);
}

/**
 * Get model for quick queries
 */
export function getQuickQueryModel(options?: { preferredProvider?: string }) {
  return routeToModel("quick-query", options);
}

/**
 * Get all available models for a task type
 */
export function getAvailableModelsForTask(taskType: TaskType): RouteConfig[] {
  const availableProviders = getAvailableProviders();
  const priorities = TASK_ROUTING_PRIORITIES[taskType];
  const configs: RouteConfig[] = [];

  for (const priority of priorities) {
    if (availableProviders.some((p) => p.id === priority.providerId)) {
      const provider = PROVIDER_CONFIGS[priority.providerId];
      const model = provider.getModel(priority.modelId);
      if (model) {
        configs.push({
          providerId: priority.providerId,
          modelId: priority.modelId,
          model,
          reasoning: priority.reasoning,
        });
      }
    }
  }

  return configs;
}

