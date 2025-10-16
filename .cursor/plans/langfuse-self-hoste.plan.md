<!-- a7eda357-22a6-4386-a77e-bd27a050a284 c5717463-5008-4ca5-a991-42c959b502b7 -->
# Langfuse Self-Hosted AI Observability Setup

## Overview

Implement self-hosted Langfuse to observe and analyze all AI model interactions across OpenAI, Anthropic, Google, and Perplexity providers with rich metadata tracking.

## Implementation Steps

### 1. Docker Compose Setup for Langfuse

Create `docker-compose.langfuse.yml` in project root:

- Langfuse web service (port 3001)
- PostgreSQL database for Langfuse
- Redis for caching (optional but recommended)
- Volume mounts for data persistence
- Environment variables for configuration

Add `.env` variables:

- `LANGFUSE_URL=http://localhost:3001`
- `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` (generated on first run)

### 2. Install Langfuse Dependencies

Add to `package.json`:

- `langfuse` - Core Langfuse SDK
- `langfuse-vercel` - Vercel AI SDK integration

### 3. Create Langfuse Client Wrapper

Create `lib/langfuse-client.ts`:

- Initialize Langfuse client with environment config
- Export singleton instance for reuse
- Add helper functions for creating traces/observations
- Handle graceful degradation if Langfuse unavailable

### 4. Integrate with AI Utility Functions

Modify `lib/ai-utils.ts`:

- Wrap `generatePromptsForCompany()` - Track prompt generation with metadata (company, competitors)
- Wrap `identifyCompetitors()` - Track competitor discovery with Perplexity usage
- Wrap `analyzePromptWithProvider()` - Track each provider response

Modify `lib/ai-utils-enhanced.ts`:

- Add Langfuse tracing to the main analysis function
- Track web search tool usage
- Capture citations as metadata
- Log structured output attempts and retries

### 5. Add Rich Metadata Tracking

For each AI call, capture:

- **Input metadata**: brandName, competitors array, useWebSearch flag, prompt category
- **Provider metadata**: provider name, model ID, temperature, max tokens
- **Output metadata**: brandMentioned, brandPosition, sentiment, confidence
- **Citations**: URLs, titles, mentioned companies
- **Visibility scores**: per competitor, provider-specific rankings
- **Performance**: latency, token usage, cost estimates

### 6. Trace Analysis Workflow

In `lib/analyze-common.ts`:

- Create parent trace for entire analysis
- Nested spans for each stage:
- Competitor identification
- Prompt generation  
- Multi-provider analysis (parallel calls)
- Score calculation
- Citation analysis
- Link all AI calls to parent trace
- Store final results as trace output

### 7. Add Langfuse UI Access

Create simple admin route or document access:

- Langfuse UI available at `http://localhost:3001`
- Document default credentials in README
- Add link in app navbar (dev mode only)

### 8. Documentation & Startup

Create `LANGFUSE_SETUP.md`:

- Docker startup commands
- Environment variable configuration
- How to view traces and sessions
- Example queries and dashboards
- Troubleshooting guide

Update `package.json` scripts:

- `langfuse:start` - Start Langfuse containers
- `langfuse:stop` - Stop containers
- `dev:with-langfuse` - Start both app and Langfuse

## Key Files to Modify

- **New**: `docker-compose.langfuse.yml`, `lib/langfuse-client.ts`, `LANGFUSE_SETUP.md`
- **Modify**: `lib/ai-utils.ts`, `lib/ai-utils-enhanced.ts`, `lib/analyze-common.ts`
- **Update**: `package.json`, `.env.example`

## Benefits

- **Multi-provider comparison**: See how GPT-5, Claude 4.5, Gemini 2.5, Perplexity differ
- **Cost tracking**: Monitor spend per provider and model
- **Debug web search**: See which providers actually used citations
- **Brand visibility trends**: Track mention rates over time
- **Performance optimization**: Identify slow providers/models
- **Quality analysis**: Compare accuracy of brand detection across providers

### To-dos

- [ ] Create docker-compose.langfuse.yml with Langfuse, PostgreSQL, and Redis services
- [ ] Install langfuse and langfuse-vercel npm packages
- [ ] Add Langfuse environment variables to .env.example (LANGFUSE_URL, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY)
- [ ] Create lib/langfuse-client.ts with initialization and helper functions
- [ ] Add Langfuse tracing to generatePromptsForCompany, identifyCompetitors in lib/ai-utils.ts
- [ ] Integrate Langfuse tracing in lib/ai-utils-enhanced.ts with web search and citation tracking
- [ ] Add parent trace and nested spans to lib/analyze-common.ts for full analysis workflow
- [ ] Add rich metadata tracking (brand, competitors, citations, scores, web search) to all traces
- [ ] Create LANGFUSE_SETUP.md with setup instructions, usage guide, and troubleshooting
- [ ] Update package.json with langfuse:start, langfuse:stop, dev:with-langfuse scripts
- [ ] Run brand analysis and verify traces appear in Langfuse dashboard at http://localhost:3001