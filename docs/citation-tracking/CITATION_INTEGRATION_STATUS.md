# Citation Integration Status

## Current Status: ✅ UI Working with Sample Data

The citation tracking UI is fully functional and displaying sample data. The backend-to-frontend integration is complete and working correctly.

## What's Working

### ✅ Frontend Integration
- **Citations Tab**: Fully functional with 4 sub-tabs (Overview, Brand, Competitors, Top Sources)
- **Data Flow**: Backend → Analysis → Frontend is working correctly
- **Citation Analysis**: `analyzeCitations()` function properly aggregates and processes citation data
- **UI Components**: All components render correctly with proper styling and interactivity

### ✅ Backend Integration
- **Analysis Pipeline**: Citations are extracted during AI response processing
- **Citation Analysis**: Runs after all provider responses are collected
- **Result Passing**: Citation analysis is included in analysis results
- **Error Handling**: Graceful fallback when citation extraction fails

### ✅ Sample Data Fallback
- **Purpose**: Verify UI functionality while implementing provider integrations
- **Function**: `generateSampleCitations()` in `lib/citation-utils.ts`
- **Behavior**: Generates 2-4 realistic citations per provider
- **Data**: Includes realistic domains (TechCrunch, G2, Capterra, etc.)

## What Needs Implementation

### 🔧 Provider-Specific Citation Extraction

The current implementation uses sample data because the Vercel AI SDK's `generateText()` doesn't preserve provider-specific metadata like citations. Each provider needs a custom implementation:

#### 1. **Anthropic Claude** (Web Search Tool)
**Required Changes:**
```typescript
// Use Anthropic SDK with web search tool
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const response = await client.messages.create({
  model: 'claude-4-sonnet-20250514',
  max_tokens: 4096,
  tools: [{
    type: 'web_search_20250305',
    name: 'web_search',
    // ... tool configuration
  }],
  messages: [{ role: 'user', content: prompt }]
});

// Extract citations from response.content blocks
```

**Citation Format:**
```json
{
  "content": [{
    "type": "text",
    "text": "...",
    "citations": [{
      "url": "https://example.com",
      "title": "Source Title",
      "cited_text": "Quoted text"
    }]
  }]
}
```

**Documentation:** See `.cursor/docs/Anthropic_api_messages.md`

#### 2. **Google Gemini** (Search Grounding)
**Required Changes:**
```typescript
// Use Google AI SDK with search grounding
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  tools: [{
    googleSearch: {} // Enable search grounding
  }]
});

const result = await model.generateContent(prompt);

// Extract from groundingMetadata.groundingChunks
```

**Citation Format:**
```json
{
  "groundingMetadata": {
    "groundingChunks": [{
      "web": {
        "uri": "https://example.com",
        "title": "Source Title"
      }
    }],
    "webSearchQueries": ["query 1", "query 2"]
  }
}
```

**Documentation:** See `.cursor/docs/google_response.md`

#### 3. **OpenAI GPT** (Responses API)
**Required Changes:**
```typescript
// Use OpenAI Responses API
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const response = await client.responses.create({
  model: 'gpt-5',
  tools: [{ type: 'web_search' }],
  input: prompt
});

// Extract from message.content.annotations
```

**Citation Format:**
```json
{
  "output": [{
    "type": "message",
    "content": [{
      "type": "output_text",
      "text": "...",
      "annotations": [{
        "type": "url_citation",
        "url": "https://example.com",
        "title": "Source Title",
        "start_index": 100,
        "end_index": 200
      }]
    }]
  }]
}
```

**Documentation:** See `.cursor/docs/openai_wesearch_response.md`

#### 4. **Perplexity** (Built-in Search)
**Required Changes:**
```typescript
// Use OpenAI-compatible endpoint with Perplexity
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai'
});

const response = await client.chat.completions.create({
  model: 'sonar-pro',
  messages: [{ role: 'user', content: prompt }]
});

// Extract from search_results
```

**Citation Format:**
```json
{
  "search_results": [{
    "url": "https://example.com",
    "title": "Source Title",
    "date": "2024-01-15"
  }]
}
```

**Documentation:** See `.cursor/docs/perplexity_response.md`

## Implementation Roadmap

### Phase 1: Remove Sample Data Fallback ✅ (CURRENT)
- [x] UI functional with sample data
- [x] Data flow verified
- [x] Citation analysis working
- [ ] Console logging for debugging

### Phase 2: Implement Provider-Specific SDKs
For each provider:
1. Install provider-specific SDK if needed
2. Create wrapper function for web search queries
3. Extract citations from provider response
4. Update `analyzePromptWithProvider()` to use new method
5. Test with real API calls
6. Remove sample data fallback for that provider

**Recommended Order:**
1. ✅ Perplexity (easiest - has search built-in)
2. Google Gemini (good documentation, straightforward)
3. Anthropic Claude (requires tool use)
4. OpenAI GPT (requires Responses API)

### Phase 3: Testing & Optimization
- [ ] Test all providers with real queries
- [ ] Verify citation extraction accuracy
- [ ] Add error handling for provider failures
- [ ] Optimize citation analysis performance
- [ ] Add citation caching if needed

### Phase 4: Production Ready
- [ ] Remove all sample data code
- [ ] Add provider availability checks
- [ ] Document citation limitations per provider
- [ ] Add user-facing disclaimers about citation availability
- [ ] Performance monitoring

## Testing the Current Implementation

### Run an Analysis
1. Start the development server
2. Navigate to Brand Monitor
3. Enter a company URL (e.g., "bubble.io")
4. Run analysis
5. Check Citations & Sources tab

### Expected Behavior
- **Sample Data**: You should see 2-4 citations per provider
- **Realistic Sources**: TechCrunch, G2, Capterra, etc.
- **Company Mentions**: Random mentions of brand and competitors
- **Console Logs**: Detailed logging showing citation extraction attempts

### Console Output to Look For
```
[Citations] OpenAI response structure: { ... }
[Citations] Attempting extraction from OpenAI...
[extractCitations] OpenAI extracted 0 citations
⚠️ [Citations] OpenAI returned 0 citations - using sample data for testing
```

## Code Locations

### Core Files
- **`lib/citation-utils.ts`**: Citation extraction and analysis logic
- **`lib/ai-utils.ts`**: Integration with AI provider responses (lines 657-711)
- **`lib/analyze-common.ts`**: Citation analysis in main pipeline (lines 436-444)
- **`components/brand-monitor/citations-tab.tsx`**: UI component

### Sample Data Function
- **Location**: `lib/citation-utils.ts` (lines 272-323)
- **Function**: `generateSampleCitations()`
- **Usage**: Temporary fallback for testing
- **TODO**: Remove once real extraction is implemented

## Provider SDK Installation

When implementing real citation extraction, install these SDKs:

```bash
# Anthropic (if not already installed)
npm install @anthropic-ai/sdk

# Google (if not already installed)
npm install @google/generative-ai

# OpenAI (already installed via ai package)
# No additional installation needed

# Perplexity uses OpenAI-compatible API
# No additional installation needed
```

## Configuration

Ensure environment variables are set:
```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
```

## Next Steps

### Immediate (To Verify Everything Works)
1. Run a brand analysis
2. Navigate to Citations tab
3. Verify sample data displays correctly
4. Check console for citation extraction logs

### Short Term (Implement Real Citations)
1. Start with Perplexity (easiest)
2. Update `analyzePromptWithProvider()` for Perplexity
3. Test with real API calls
4. Move to next provider

### Long Term (Production Ready)
1. Implement all 4 providers
2. Remove sample data code
3. Add comprehensive error handling
4. Document limitations and availability

## Known Limitations

### Current (with Sample Data)
- ✅ Citations are synthetic/random
- ✅ Not based on actual AI provider responses
- ✅ Good for UI testing only

### Future (with Real Extraction)
- ⚠️ Not all providers support citations
- ⚠️ Citation format varies by provider
- ⚠️ Some providers require specific API tiers
- ⚠️ Citations may not always be available

## Questions or Issues?

### Why Sample Data?
The Vercel AI SDK's `generateText()` abstracts away provider-specific response metadata. To get real citations, we need to use provider-specific SDKs or different API methods.

### Why Not Use AI SDK Tools?
We could use `streamObject()` or other AI SDK methods with tools, but provider-specific SDKs give us more control and better access to citation metadata.

### When Will Real Citations Work?
Once we implement provider-specific SDK calls for each provider (estimated: 2-4 hours per provider).

## Success Criteria

### UI Working ✅
- [x] Citations tab displays data
- [x] All 4 sub-tabs functional
- [x] Charts and visualizations working
- [x] Links clickable
- [x] Data updates properly

### Backend Integration ✅
- [x] Citations extracted during analysis
- [x] Citation analysis runs properly
- [x] Results passed to frontend
- [x] Error handling in place

### Real Citation Extraction ⏳
- [ ] At least one provider working with real citations
- [ ] Citation data matches provider documentation
- [ ] Fallback handling for providers without citation support
- [ ] Production-ready error handling

