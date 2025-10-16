# GXO Quick Start Guide

Get started with the Generative Experience Optimization (GXO) layer in 5 minutes.

## 1. Track Events

```typescript
import { useGXO } from "@/lib/gxo/instrumentation";
import { GXOEventType } from "@/lib/gxo/events";

function MyComponent() {
  const { trackButtonClick, trackEvent } = useGXO();

  return (
    <button onClick={() => trackButtonClick("Sign Up", "primary", "/pricing")}>
      Sign Up
    </button>
  );
}
```

## 2. Use A/B Tests

```typescript
import { useExperimentConfig } from "@/hooks/useExperiment";

function PricingPage() {
  // Get the CTA text from the pricing experiment
  const ctaText = useExperimentConfig(
    "pricingCTA", 
    "ctaText", 
    "Start Free Trial" // default
  );

  return <button>{ctaText}</button>;
}
```

## 3. Check Feature Flags

```typescript
import { useFeatureFlag } from "@/hooks/useExperiment";

function Dashboard() {
  const hasAdvancedAnalytics = useFeatureFlag("advancedBrandAnalytics");

  return (
    <div>
      {hasAdvancedAnalytics ? (
        <AdvancedDashboard />
      ) : (
        <BasicDashboard />
      )}
    </div>
  );
}
```

## 4. Use Dynamic Prompts

```typescript
import { generatePrompt } from "@/lib/gxo/prompts";

const prompt = generatePrompt("brand-intro-friendly", {
  brandName: "Acme Corp",
  brandUrl: "https://acme.com"
});
// Returns: "Let's explore Acme Corp together! I'll help you..."
```

## 5. Route to Best Model

```typescript
import { getBrandAnalysisModel } from "@/lib/gxo/router";
import { generateText } from "ai";

async function analyzeBrand(url: string) {
  // Get the best available model for brand analysis
  const route = getBrandAnalysisModel({
    contentLength: 50000,
    preferredProvider: "anthropic" // optional
  });

  if (!route) {
    throw new Error("No AI provider available");
  }

  console.log(`Using ${route.providerId}/${route.modelId}`);
  console.log(`Reason: ${route.reasoning}`);

  const result = await generateText({
    model: route.model,
    prompt: "Analyze this brand..."
  });

  return result.text;
}
```

## 6. Complete Example: Brand Analysis with Tracking

```typescript
import { useGXO } from "@/lib/gxo/instrumentation";
import { getBrandAnalysisModel } from "@/lib/gxo/router";
import { generatePrompt, useExperiment } from "@/lib/gxo";
import { GXOEventType } from "@/lib/gxo/events";
import { generateText } from "ai";

function BrandAnalyzer() {
  const { trackBrandAnalysis } = useGXO();
  const variant = useExperiment("brandAnalysisPromptStyle");

  async function analyze(brandUrl: string) {
    const startTime = Date.now();

    // Get the best model
    const route = getBrandAnalysisModel();
    if (!route) throw new Error("No provider available");

    // Generate prompt based on experiment variant
    const promptId = variant?.config.promptVariant === "friendly"
      ? "brand-intro-friendly"
      : "brand-intro-default";

    const prompt = generatePrompt(promptId, {
      brandName: "Example",
      brandUrl
    });

    // Track start
    trackBrandAnalysis(GXOEventType.BRAND_ANALYSIS_START, {
      brandUrl,
      provider: route.providerId,
      model: route.modelId
    });

    try {
      // Analyze
      const result = await generateText({
        model: route.model,
        prompt
      });

      // Track success
      trackBrandAnalysis(GXOEventType.BRAND_ANALYSIS_COMPLETE, {
        brandUrl,
        duration: Date.now() - startTime,
        provider: route.providerId
      });

      return result.text;
    } catch (error) {
      // Track error
      trackBrandAnalysis(GXOEventType.BRAND_ANALYSIS_ERROR, {
        brandUrl,
        errorMessage: error.message
      });
      throw error;
    }
  }

  return (
    <div>
      {/* Your UI */}
    </div>
  );
}
```

## Available Functions

### Event Tracking
```typescript
const { 
  trackEvent,
  trackPageView,
  trackButtonClick,
  trackBrandAnalysis,
  trackChatEvent,
  trackConversion 
} = useGXO();
```

### Experiments
```typescript
const variant = useExperiment("experimentId");
const config = useExperimentConfig("experimentId", "key", "default");
```

### Feature Flags
```typescript
const enabled = useFeatureFlag("flagId", "userSegment");
```

### Prompts
```typescript
generatePrompt(templateId, variables)
getPromptsByCategory("chat")
getPromptTemplate("brand-intro-default")
```

### Model Routing
```typescript
getBrandAnalysisModel(options)
getChatModel(options)
getCompetitiveAnalysisModel(options)
getWebSearchModel(options)
getQuickQueryModel(options)
routeToModel("task-type", options)
```

## Event Types

```typescript
// UI Events
GXOEventType.PAGE_VIEW
GXOEventType.BUTTON_CLICK
GXOEventType.FORM_SUBMIT

// Brand Monitor
GXOEventType.BRAND_ANALYSIS_START
GXOEventType.BRAND_ANALYSIS_COMPLETE
GXOEventType.PROMPT_GENERATED

// Chat
GXOEventType.CHAT_MESSAGE_SENT
GXOEventType.CHAT_FEEDBACK

// Conversion
GXOEventType.SIGNUP_COMPLETED
GXOEventType.PLAN_SELECTED
GXOEventType.SUBSCRIPTION_COMPLETED
```

## Experiments

### Active Experiments
1. `brandAnalysisPromptStyle` - Test prompt tones
2. `chatGreeting` - Test greeting styles
3. `pricingCTA` - Test CTA variations

### Feature Flags
1. `advancedBrandAnalytics` - Advanced dashboard (50%)
2. `aiChatSuggestions` - Chat suggestions (100%)
3. `multiModelComparison` - Multi-model compare (75%)
4. `batchBrandAnalysis` - Batch analysis (10%)

## Task Types for Model Routing

```typescript
"brand-analysis"       // → Anthropic Claude Sonnet
"competitive-analysis" // → Anthropic Claude Sonnet
"chat"                // → OpenAI GPT-5 Chat
"quick-query"         // → Google Gemini Flash
"long-document"       // → Google Gemini Pro (2M tokens)
"web-search"          // → Perplexity Sonar Pro
```

## Tips

1. **Events are batched**: Up to 10 events or 5 seconds before sending
2. **User bucketing is consistent**: Same user always gets same variant
3. **Model routing has fallbacks**: Falls back through priority list
4. **Prompts support variables**: Use `{{variableName}}` syntax
5. **Feature flags can target segments**: Pass segment to `useFeatureFlag`

## Next Steps

- Read the [full documentation](./README.md)
- Explore [prompt templates](./prompts.ts)
- Check [experiment definitions](./experiments.ts)
- Review [model routing logic](./router.ts)

