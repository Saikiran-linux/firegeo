# Prompts Feature Documentation

## Overview

The Prompts feature allows users to manage and test prompts that track brand visibility across multiple AI providers. Users can create custom prompts, generate prompts using AI, and run them against configured AI providers to see how different platforms respond.

## Key Features

### 1. Prompt Management
- **Add Custom Prompts**: Create prompts with specific categories (Ranking, Comparison, Alternatives, Recommendations)
- **Generate Prompts**: Use AI to automatically generate relevant prompts based on company information
- **Edit/Delete Prompts**: Manage existing prompts with full CRUD operations
- **Search & Filter**: Find prompts by keyword and filter by category

### 2. Prompt Execution
- **Run Individual Prompts**: Click on a prompt's accordion item and use "Run This Prompt" button to execute it against all configured AI providers
- **Run All Prompts**: Use the "Run All" button in the header to execute all prompts simultaneously
- **Real-time Status**: Visual loading indicators show when prompts are running

### 3. Results Display

#### Accordion Layout
- Each prompt is displayed as an accordion item
- Click to expand/collapse prompt details and results
- Category badge shows prompt classification
- Provider badge shows number of providers that have returned results

#### Tabbed Results
When a prompt has been run, results from different AI providers are organized in tabs:
- Each AI provider gets its own tab (OpenAI, Anthropic, Google, Perplexity, etc.)
- Tab layout adapts to show up to 4 provider tabs, then wraps if needed
- Clicking a provider tab shows that provider's response

#### Result Display
For each provider response:
- Full response text is displayed with proper formatting
- Timestamp shows when the response was generated
- Copy button allows users to copy the response
- Error messages are clearly displayed if a provider fails

## API Endpoint

### POST /api/brand-monitor/prompts
Adds new prompts to the latest analysis.

**Request Body:**
```json
{
  "prompts": [
    {
      "id": "string",
      "prompt": "string",
      "category": "ranking" | "comparison" | "alternatives" | "recommendations"
    }
  ]
}
```

### PUT /api/brand-monitor/prompts
Runs prompts against configured AI providers (ChatGPT, Claude, Gemini, Perplexity).

**Request Body (optional):**
```json
{
  "promptIds": ["string"] // Optional: Array of prompt IDs to run. If omitted or empty, runs all prompts.
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `promptIds` | `string[]` | No | Array of prompt IDs to execute. If omitted, empty, or not an array, all prompts from the latest analysis are executed. |

**Validation Rules:**
- Authentication required (valid session token)
- At least one analysis must exist for the user
- If `promptIds` is provided, it must be an array of strings
- After filtering, at least one prompt must exist to run
- At least one AI provider must be configured

**Default Behavior:**
- Runs **all prompts** from the latest analysis if no `promptIds` specified
- Processes prompts in batches of 10 with parallel provider execution
- Adds 1.5s stagger delay between provider starts to avoid rate limits
- Implements automatic retry logic for rate limit errors
- Saves all results to the analysis data upon completion

**Query/Path Parameters:**
None. All filtering is done via request body.

**Example 1 - Run all prompts:**
```bash
curl -X PUT https://api.example.com/api/brand-monitor/prompts \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-session=..." \
  -d '{}'
```

**Example 2 - Run specific prompts:**
```bash
curl -X PUT https://api.example.com/api/brand-monitor/prompts \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-session=..." \
  -d '{
    "promptIds": ["prompt-123", "prompt-456", "custom-789"]
  }'
```

**Response:**
```json
{
  "message": "Prompts executed successfully",
  "results": [
    {
      "promptId": "string",
      "prompt": "string",
      "category": "string",
      "results": [
        {
          "provider": "OpenAI",
          "response": "...",
          "timestamp": "ISO8601",
          "error": "optional error message"
        }
      ]
    }
  ]
}
```

## Component Structure

### Main Component: `/app/dashboard/prompts/page.tsx`
- **State Management**:
  - `prompts`: Array of all prompts from latest analysis
  - `promptResults`: Cached results organized by promptId
  - `runningPrompts`: Set of prompt IDs currently being executed
  - `runAllLoading`: Boolean for "Run All" operation status

- **Key Functions**:
  - `handleRunPrompt(promptId)`: Execute single prompt
  - `handleRunAllPrompts()`: Execute all filtered prompts
  - Accordion component for expandable prompt display
  - Tabs component for provider-specific results

### UI Components Used
- `Accordion`: Expandable prompt items
- `Tabs`: Provider result organization
- `Badge`: Category and status indicators
- `Button`: Run buttons and action controls
- `Card`: Statistics and section containers
- `Alert`: Error message display
- `Input/Select`: Search and filter controls

## Data Flow

1. **Initial Load**:
   - Fetch latest analysis with prompts
   - Load saved results from `analysisData.promptResults`
   - Display prompts in accordion view

2. **Running Prompts**:
   - User clicks "Run This Prompt" or "Run All"
   - Frontend calls PUT `/api/brand-monitor/prompts`
   - API fetches prompts from database
   - API calls `analyzePromptWithProviderEnhanced()` for each prompt + provider combination
   - Results are saved to `analysisData.promptResults`
   - Frontend updates UI with new results

3. **Displaying Results**:
   - Results are organized by prompt ID
   - Within each prompt, results are organized by provider in tabs
   - User can switch between provider tabs to compare responses

## Supported AI Providers

The system works with any configured providers in `/lib/provider-config.ts`:
- OpenAI (GPT-5, GPT-4, etc.)
- Anthropic (Claude Sonnet, Claude Opus, etc.)
- Google (Gemini 2.5, Gemini 1.5, etc.)
- Perplexity (Sonar, Sonar Pro, etc.)

Only providers that are:
1. Enabled in `PROVIDER_ENABLED_CONFIG`
2. Have valid API keys configured

## User Experience Highlights

### Visual Feedback
- Loading spinners during prompt execution
- Disabled buttons while operations are in progress
- Clear error messages if providers fail
- Timestamps for result tracking

### Responsive Design
- Grid-based tab layout adapts to number of providers
- Search and filter maintain state during navigation
- Accordion provides compact view with expandable details

### Performance
- Results are cached in component state
- Only re-run necessary (individual or all)
- Lazy loading of results on accordion expand

## Future Enhancements

Potential improvements:
- Batch operations for faster multi-prompt execution
- Result comparison view showing side-by-side provider responses
- Result history and versioning
- Export results to CSV/PDF
- Scheduled/recurring prompt runs
- Prompt templates library
- Custom prompt suggestions based on competitors
