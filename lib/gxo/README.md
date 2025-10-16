# GXO (Generative Experience Optimization) Layer

The GXO layer provides a comprehensive system for optimizing user experiences through event tracking, A/B testing, dynamic prompt generation, feature flags, and intelligent model routing.

## Architecture

```
lib/gxo/
├── events.ts              # Event schemas and queue management
├── instrumentation.tsx    # React hooks and providers for tracking
├── prompts.ts            # Dynamic prompt templates
├── experiments.ts        # A/B testing and feature flags
├── router.ts             # Intelligent model routing
└── index.ts              # Public API exports
```

## Features

### 1. Event Tracking (`events.ts`)

Track user interactions and conversion events:

```typescript
import { GXOEventType } from "@/lib/gxo/events";

// Event types
GXOEventType.PAGE_VIEW
GXOEventType.BUTTON_CLICK
GXOEventType.BRAND_ANALYSIS_START
GXOEventType.CHAT_MESSAGE_SENT
GXOEventType.SUBSCRIPTION_COMPLETED
```

**Event Queue**: Automatically batches and sends events to reduce network overhead.

### 2. Instrumentation (`instrumentation.tsx`)

React hooks and components for tracking:

```typescript
import { useGXO } from "@/lib/gxo/instrumentation";

function MyComponent() {
  const { trackEvent, trackButtonClick, trackPageView } = useGXO();
  
  const handleClick = () => {
    trackButtonClick("Sign Up", "primary", "/pricing");
  };
  
  return <button onClick={handleClick}>Sign Up</button>;
}
```

**Automatic Page View Tracking**: `<GXOPageViewTracker />` component automatically tracks navigation.

### 3. Prompt Templates (`prompts.ts`)

Dynamic prompt generation with variable interpolation:

```typescript
import { generatePrompt, getPromptsByCategory } from "@/lib/gxo/prompts";

// Generate a prompt with variables
const prompt = generatePrompt("brand-intro-friendly", {
  brandName: "Acme Corp",
  brandUrl: "https://acme.com"
});
// Result: "Let's explore Acme Corp together! I'll help you understand..."

// Get all prompts for a category
const chatPrompts = getPromptsByCategory("chat");
```

**Prompt Categories**:
- `onboarding`: Welcome messages and first-time user prompts
- `brand-analysis`: Brand analysis and competitive prompts
- `chat`: Conversational prompts
- `conversion`: CTAs and upgrade messages

### 4. A/B Testing & Feature Flags (`experiments.ts`)

**Experiments**:

```typescript
import { useExperiment, useExperimentConfig } from "@/hooks/useExperiment";

function PricingPage() {
  const variant = useExperiment("pricingCTA");
  const ctaText = useExperimentConfig("pricingCTA", "ctaText", "Start Free Trial");
  
  return <button>{ctaText}</button>;
}
```

**Feature Flags**:

```typescript
import { useFeatureFlag } from "@/hooks/useExperiment";

function AnalyticsDashboard() {
  const hasAdvancedAnalytics = useFeatureFlag("advancedBrandAnalytics");
  
  if (!hasAdvancedAnalytics) {
    return <BasicDashboard />;
  }
  
  return <AdvancedDashboard />;
}
```

### 5. Intelligent Model Routing (`router.ts`)

Automatically routes requests to the best available AI model based on task type:

```typescript
import { getBrandAnalysisModel, getChatModel } from "@/lib/gxo/router";

// Get the best model for brand analysis
const { model, providerId, modelId, reasoning } = getBrandAnalysisModel({
  contentLength: 50000,
  preferredProvider: "anthropic"
});

// Use the model with AI SDK
const result = await generateText({
  model,
  prompt: "Analyze this brand..."
});
```

**Task Types**:
- `brand-analysis`: Complex brand analysis (Anthropic Claude Sonnet preferred)
- `competitive-analysis`: Comparative analysis (Claude Sonnet preferred)
- `chat`: Conversational interactions (OpenAI GPT-5 Chat preferred)
- `quick-query`: Fast responses (Google Gemini Flash preferred)
- `long-document`: Large context analysis (Google Gemini Pro preferred)
- `web-search`: Real-time web information (Perplexity Sonar preferred)

**Routing Features**:
- Automatic fallback to available providers
- Content-length aware routing
- User preference support
- Web search requirement detection
- Detailed reasoning for model selection

## Setup

### 1. Add GXO Provider to your app

```tsx
// app/layout.tsx or components/providers.tsx
import { GXOProvider, GXOPageViewTracker } from "@/lib/gxo/instrumentation";

export function Providers({ children }) {
  return (
    <GXOProvider>
      <GXOPageViewTracker />
      {children}
    </GXOProvider>
  );
}
```

### 2. Configure Event Endpoint

Create an API endpoint to receive events:

```typescript
// app/api/gxo/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BaseEventSchema } from "@/lib/gxo/events";

export async function POST(req: NextRequest) {
  const { events } = await req.json();
  
  // Store events in your database
  // Send to analytics platforms
  // Process for dashboards
  
  return NextResponse.json({ success: true });
}
```

### 3. Track Events

```typescript
import { useGXO } from "@/lib/gxo/instrumentation";

function BrandAnalysisPage() {
  const { trackBrandAnalysis } = useGXO();
  
  const handleAnalysis = async () => {
    trackBrandAnalysis(GXOEventType.BRAND_ANALYSIS_START, {
      brandUrl: "https://example.com",
      promptsCount: 5
    });
    
    // Perform analysis...
    
    trackBrandAnalysis(GXOEventType.BRAND_ANALYSIS_COMPLETE, {
      brandUrl: "https://example.com",
      duration: 30000
    });
  };
}
```

## Predefined Experiments

### Brand Analysis Prompt Style
Tests different prompt tones for brand analysis:
- `control`: Professional tone
- `variant-a`: Friendly conversational tone

### Chat Greeting
Tests personalized vs. generic greetings:
- `control`: Generic greeting
- `variant-a`: Personalized with user name

### Pricing CTA
Tests different call-to-action messages:
- `control`: "Start Free Trial"
- `variant-a`: "Get Started Free"
- `variant-b`: "Try Pro Free"

## Predefined Feature Flags

- `advancedBrandAnalytics`: Advanced analytics dashboard (50% rollout)
- `aiChatSuggestions`: AI-powered chat suggestions (100% enabled)
- `multiModelComparison`: Compare results across models (75% rollout)
- `batchBrandAnalysis`: Analyze multiple brands at once (10% rollout)

## Best Practices

### Event Tracking
1. Track key user interactions (button clicks, form submissions)
2. Track conversion events (signups, subscriptions, upgrades)
3. Include context (page, user ID, session ID)
4. Keep event names consistent

### Prompt Templates
1. Use variables for personalization
2. Create variants for A/B testing
3. Keep templates focused and clear
4. Test prompts with real data

### Experiments
1. Run one experiment per page/feature
2. Set clear success metrics
3. Give experiments enough time (at least 1 week)
4. Document learnings

### Feature Flags
1. Use for gradual rollouts
2. Target specific user segments
3. Clean up after full rollout
4. Monitor error rates

### Model Routing
1. Let the router choose the best model
2. Provide content length for better routing
3. Use task-specific functions
4. Handle fallback cases (null returns)

## Integration Examples

### Brand Analysis with Tracking

```typescript
import { useGXO } from "@/lib/gxo/instrumentation";
import { getBrandAnalysisModel } from "@/lib/gxo/router";
import { generatePrompt } from "@/lib/gxo/prompts";
import { generateText } from "ai";

async function analyzeBrand(brandUrl: string) {
  const { trackBrandAnalysis } = useGXO();
  const startTime = Date.now();
  
  // Get the best model
  const route = getBrandAnalysisModel();
  if (!route) {
    throw new Error("No AI provider available");
  }
  
  // Generate prompt
  const prompt = generatePrompt("brand-intro-default", {
    brandName: "Example Brand",
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
      errorMessage: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}
```

### Chat with Experiments

```typescript
import { useExperimentConfig } from "@/hooks/useExperiment";
import { getChatModel } from "@/lib/gxo/router";
import { generatePrompt } from "@/lib/gxo/prompts";

function ChatInterface() {
  const greetingType = useExperimentConfig("chatGreeting", "greetingType", "default");
  const route = getChatModel();
  
  const greeting = generatePrompt(
    greetingType === "personalized" 
      ? "chat-greeting-personalized" 
      : "chat-greeting-default",
    { userName: user.name }
  );
  
  return <div>{greeting}</div>;
}
```

## Performance Considerations

- Events are batched (max 10 per batch or 5s interval)
- Automatic queue flushing on page unload
- Lazy provider loading
- Model routing caching

## Security

- Events are validated with Zod schemas
- User data is anonymized in events
- Session IDs are client-generated
- No PII in event payloads

## Monitoring

Track GXO performance:
1. Event delivery rate
2. Experiment distribution
3. Model routing decisions
4. Feature flag rollout percentages

## Contributing

When adding new features to GXO:

1. **Events**: Add to `GXOEventType` and create schema
2. **Prompts**: Add to category-specific arrays with variants
3. **Experiments**: Define in `experiments` object with variants
4. **Feature Flags**: Add to `featureFlags` with rollout percentage
5. **Routing**: Update `TASK_ROUTING_PRIORITIES` for new task types

