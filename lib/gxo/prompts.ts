/**
 * GXO Prompt Templates
 * Dynamic prompt generation with variables for personalization and A/B testing
 */

export interface PromptVariable {
  name: string;
  value: string | number | boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  category: "onboarding" | "brand-analysis" | "chat" | "conversion";
  variant?: string;
}

/**
 * Replace variables in a template
 */
export function interpolatePrompt(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName]?.toString() || match;
  });
}

/**
 * Brand Analysis Prompt Templates
 */
export const brandAnalysisPrompts: PromptTemplate[] = [
  {
    id: "brand-intro-default",
    name: "Brand Introduction - Default",
    template:
      "Analyze the brand {{brandName}} ({{brandUrl}}). Provide insights on their positioning, value proposition, and key differentiators.",
    variables: ["brandName", "brandUrl"],
    category: "brand-analysis",
    variant: "default",
  },
  {
    id: "brand-intro-friendly",
    name: "Brand Introduction - Friendly",
    template:
      "Let's explore {{brandName}} together! I'll help you understand what makes them unique at {{brandUrl}}. We'll look at their positioning, value proposition, and what sets them apart.",
    variables: ["brandName", "brandUrl"],
    category: "brand-analysis",
    variant: "friendly",
  },
  {
    id: "competitor-comparison",
    name: "Competitor Comparison",
    template:
      "Compare {{brandName}} with {{competitorName}}. Focus on {{comparisonAspect}} and identify key differences in their approach.",
    variables: ["brandName", "competitorName", "comparisonAspect"],
    category: "brand-analysis",
    variant: "default",
  },
  {
    id: "visibility-analysis",
    name: "Visibility Analysis",
    template:
      "Analyze the online visibility of {{brandName}} across different AI platforms. Focus on how they appear in response to queries about {{industry}}.",
    variables: ["brandName", "industry"],
    category: "brand-analysis",
    variant: "default",
  },
];

/**
 * Chat Prompt Templates
 */
export const chatPrompts: PromptTemplate[] = [
  {
    id: "chat-greeting-default",
    name: "Chat Greeting - Default",
    template: "Hello! How can I assist you with your brand analysis today?",
    variables: [],
    category: "chat",
    variant: "default",
  },
  {
    id: "chat-greeting-personalized",
    name: "Chat Greeting - Personalized",
    template: "Hi {{userName}}! Ready to dive into some brand insights? What would you like to explore?",
    variables: ["userName"],
    category: "chat",
    variant: "personalized",
  },
  {
    id: "chat-context-aware",
    name: "Chat Context Aware",
    template:
      "I see you're working on {{brandName}}. Would you like me to help with competitor analysis, visibility tracking, or something else?",
    variables: ["brandName"],
    category: "chat",
    variant: "contextual",
  },
];

/**
 * Onboarding Prompt Templates
 */
export const onboardingPrompts: PromptTemplate[] = [
  {
    id: "welcome-default",
    name: "Welcome Message - Default",
    template: "Welcome to Geomization! Let's get started with your brand analysis journey.",
    variables: [],
    category: "onboarding",
    variant: "default",
  },
  {
    id: "welcome-enthusiastic",
    name: "Welcome Message - Enthusiastic",
    template:
      "🎉 Welcome aboard, {{userName}}! We're excited to help you optimize your brand's visibility in the AI-powered world!",
    variables: ["userName"],
    category: "onboarding",
    variant: "enthusiastic",
  },
  {
    id: "first-analysis-prompt",
    name: "First Analysis Prompt",
    template:
      "Ready to analyze your first brand? Enter your website URL below and we'll generate comprehensive insights using AI.",
    variables: [],
    category: "onboarding",
    variant: "default",
  },
];

/**
 * Conversion Prompt Templates
 */
export const conversionPrompts: PromptTemplate[] = [
  {
    id: "upgrade-cta-default",
    name: "Upgrade CTA - Default",
    template: "Unlock unlimited brand analyses with our Pro plan. Start your free trial today!",
    variables: [],
    category: "conversion",
    variant: "default",
  },
  {
    id: "upgrade-cta-value",
    name: "Upgrade CTA - Value Focused",
    template:
      "You've analyzed {{analysisCount}} brands. Upgrade to Pro for unlimited analyses and advanced features at just {{planPrice}}/month.",
    variables: ["analysisCount", "planPrice"],
    category: "conversion",
    variant: "value-focused",
  },
  {
    id: "upgrade-cta-urgency",
    name: "Upgrade CTA - Urgency",
    template:
      "Limited time offer! Upgrade now and get {{discount}}% off your first 3 months. Transform your brand visibility today!",
    variables: ["discount"],
    category: "conversion",
    variant: "urgency",
  },
];

/**
 * Get prompt by ID
 */
export function getPromptTemplate(id: string): PromptTemplate | undefined {
  const allPrompts = [
    ...brandAnalysisPrompts,
    ...chatPrompts,
    ...onboardingPrompts,
    ...conversionPrompts,
  ];
  return allPrompts.find((p) => p.id === id);
}

/**
 * Get prompts by category
 */
export function getPromptsByCategory(category: PromptTemplate["category"]): PromptTemplate[] {
  const allPrompts = [
    ...brandAnalysisPrompts,
    ...chatPrompts,
    ...onboardingPrompts,
    ...conversionPrompts,
  ];
  return allPrompts.filter((p) => p.category === category);
}

/**
 * Generate prompt with variables
 */
export function generatePrompt(
  templateId: string,
  variables: Record<string, any>
): string | null {
  const template = getPromptTemplate(templateId);
  if (!template) return null;

  return interpolatePrompt(template.template, variables);
}

