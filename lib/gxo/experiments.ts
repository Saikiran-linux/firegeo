/**
 * GXO Experiments & Feature Flags
 * A/B testing and feature flag utilities for optimization
 */

export interface Experiment {
  id: string;
  name: string;
  description: string;
  variants: ExperimentVariant[];
  status: "draft" | "running" | "paused" | "completed";
  trafficAllocation: number; // Percentage of users in experiment (0-100)
  startDate?: Date;
  endDate?: Date;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // Percentage of experiment traffic (should sum to 100 across variants)
  config: Record<string, any>;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  targetUserIds?: string[];
  targetSegments?: string[];
}

/**
 * Hash function for consistent variant assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get variant for a user in an experiment
 */
export function getExperimentVariant(
  experiment: Experiment,
  userId: string
): ExperimentVariant | null {
  if (experiment.status !== "running") {
    return experiment.variants[0]; // Return control variant
  }

  // Check if user should be in experiment
  const userHash = hashString(userId + experiment.id);
  const inExperiment = (userHash % 100) < experiment.trafficAllocation;

  if (!inExperiment) {
    return null; // User not in experiment
  }

  // Assign variant based on weights
  const variantHash = hashString(userId + experiment.id + "variant");
  const variantPercentile = variantHash % 100;

  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (variantPercentile < cumulative) {
      return variant;
    }
  }

  // Fallback to first variant
  return experiment.variants[0];
}

/**
 * Check if a feature flag is enabled for a user
 */
export function isFeatureEnabled(
  flag: FeatureFlag,
  userId?: string,
  userSegment?: string
): boolean {
  if (!flag.enabled) {
    return false;
  }

  // Check target user IDs
  if (flag.targetUserIds && userId && flag.targetUserIds.includes(userId)) {
    return true;
  }

  // Check target segments
  if (flag.targetSegments && userSegment && flag.targetSegments.includes(userSegment)) {
    return true;
  }

  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined && userId) {
    const userHash = hashString(userId + flag.id);
    const userPercentile = userHash % 100;
    return userPercentile < flag.rolloutPercentage;
  }

  return flag.enabled;
}

/**
 * Predefined experiments
 */
export const experiments: Record<string, Experiment> = {
  brandAnalysisPromptStyle: {
    id: "brand-analysis-prompt-style",
    name: "Brand Analysis Prompt Style",
    description: "Test different prompt styles for brand analysis",
    status: "running",
    trafficAllocation: 100,
    variants: [
      {
        id: "control",
        name: "Default Professional",
        weight: 50,
        config: {
          promptVariant: "default",
          tone: "professional",
        },
      },
      {
        id: "variant-a",
        name: "Friendly Conversational",
        weight: 50,
        config: {
          promptVariant: "friendly",
          tone: "conversational",
        },
      },
    ],
  },
  
  chatGreeting: {
    id: "chat-greeting",
    name: "Chat Greeting Message",
    description: "Test personalized vs. generic chat greetings",
    status: "running",
    trafficAllocation: 100,
    variants: [
      {
        id: "control",
        name: "Generic Greeting",
        weight: 50,
        config: {
          greetingType: "default",
        },
      },
      {
        id: "variant-a",
        name: "Personalized Greeting",
        weight: 50,
        config: {
          greetingType: "personalized",
        },
      },
    ],
  },

  pricingCTA: {
    id: "pricing-cta",
    name: "Pricing Page CTA",
    description: "Test different CTAs on pricing page",
    status: "running",
    trafficAllocation: 100,
    variants: [
      {
        id: "control",
        name: "Start Free Trial",
        weight: 33,
        config: {
          ctaText: "Start Free Trial",
          ctaVariant: "default",
        },
      },
      {
        id: "variant-a",
        name: "Get Started Free",
        weight: 33,
        config: {
          ctaText: "Get Started Free",
          ctaVariant: "friendly",
        },
      },
      {
        id: "variant-b",
        name: "Try Pro Free",
        weight: 34,
        config: {
          ctaText: "Try Pro Free",
          ctaVariant: "value-focused",
        },
      },
    ],
  },
};

/**
 * Predefined feature flags
 */
export const featureFlags: Record<string, FeatureFlag> = {
  advancedBrandAnalytics: {
    id: "advanced-brand-analytics",
    name: "Advanced Brand Analytics",
    description: "Enable advanced analytics dashboard for brand monitoring",
    enabled: true,
    rolloutPercentage: 50,
  },

  aiChatSuggestions: {
    id: "ai-chat-suggestions",
    name: "AI Chat Suggestions",
    description: "Show AI-powered suggestions in chat interface",
    enabled: true,
    rolloutPercentage: 100,
  },

  multiModelComparison: {
    id: "multi-model-comparison",
    name: "Multi-Model Comparison",
    description: "Allow users to compare results from multiple AI models",
    enabled: true,
    rolloutPercentage: 75,
  },

  batchBrandAnalysis: {
    id: "batch-brand-analysis",
    name: "Batch Brand Analysis",
    description: "Enable analysis of multiple brands at once",
    enabled: false,
    rolloutPercentage: 10,
  },
};

/**
 * Get experiment by ID
 */
export function getExperiment(experimentId: string): Experiment | undefined {
  return experiments[experimentId];
}

/**
 * Get feature flag by ID
 */
export function getFeatureFlag(flagId: string): FeatureFlag | undefined {
  return featureFlags[flagId];
}

