"use client";

import { useMemo } from "react";
import { useSession } from "@/lib/auth-client";
import { 
  getExperiment, 
  getExperimentVariant, 
  getFeatureFlag,
  isFeatureEnabled,
  type Experiment,
  type ExperimentVariant,
  type FeatureFlag,
} from "@/lib/gxo/experiments";

/**
 * Hook to get the current variant for an experiment
 */
export function useExperiment(experimentId: string): ExperimentVariant | null {
  const { data: session } = useSession();
  
  const variant = useMemo(() => {
    const experiment = getExperiment(experimentId);
    if (!experiment) return null;
    
    const userId = session?.user?.id || `anon_${Date.now()}`;
    return getExperimentVariant(experiment, userId);
  }, [experimentId, session?.user?.id]);
  
  return variant;
}

/**
 * Hook to check if a feature flag is enabled
 */
export function useFeatureFlag(flagId: string, userSegment?: string): boolean {
  const { data: session } = useSession();
  
  const enabled = useMemo(() => {
    const flag = getFeatureFlag(flagId);
    if (!flag) return false;
    
    const userId = session?.user?.id;
    return isFeatureEnabled(flag, userId, userSegment);
  }, [flagId, session?.user?.id, userSegment]);
  
  return enabled;
}

/**
 * Hook to get experiment config value
 */
export function useExperimentConfig<T = any>(
  experimentId: string,
  configKey: string,
  defaultValue: T
): T {
  const variant = useExperiment(experimentId);
  
  if (!variant || !(configKey in variant.config)) {
    return defaultValue;
  }
  
  return variant.config[configKey] as T;
}

