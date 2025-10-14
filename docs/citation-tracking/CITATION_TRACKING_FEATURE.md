# Citation Tracking Feature

## Overview
The Citation Tracking feature provides insights into which sources AI chatbots are referencing when mentioning your brand and competitors. This helps understand where AI models get their information and which domains are most influential.

## Features

### 1. **Citations Tab**
A new tab in the brand monitor results that shows:
- **Overview**: High-level statistics about citation distribution
- **Your Brand**: Sources that cite your brand
- **Competitors**: Sources that cite your competitors
- **Top Sources**: Most frequently cited domains by AI chatbots

### 2. **Citation Analysis**
Automatically analyzes:
- Total number of unique sources cited
- Citation frequency per source
- Which companies are mentioned in each source
- Provider-specific citation patterns
- Top domains by frequency

### 3. **Provider Support**
Citation extraction works with:
- **Anthropic Claude**: Extracts citations from text blocks with citation metadata
- **Google Gemini**: Extracts grounding metadata with web chunks
- **OpenAI GPT**: Extracts URL citations from annotations
- **Perplexity**: Extracts search results

## Technical Implementation

### New Types (`lib/types.ts`)
```typescript
interface Citation {
  url: string;
  title?: string;
  snippet?: string;
  source?: string;
  date?: string;
  position?: number;
  mentionedCompanies?: string[];
}

interface CitationAnalysis {
  totalSources: number;
  topSources: SourceFrequency[];
  brandCitations: CitationsByCompany;
  competitorCitations: Record<string, CitationsByCompany>;
  providerBreakdown: Record<string, SourceFrequency[]>;
}
```

### Core Components

#### 1. **CitationsTab Component** (`components/brand-monitor/citations-tab.tsx`)
- Displays citation data in a user-friendly format
- Shows distribution charts and statistics
- Provides clickable links to sources
- Organized into 4 sub-tabs: Overview, Brand, Competitors, Sources

#### 2. **Citation Utils** (`lib/citation-utils.ts`)
- `analyzeCitations()`: Processes all citations and builds analysis
- `extractCitationsFromResponse()`: Provider-specific citation extraction
- `enhanceCitationsWithMentions()`: Enhances citations with company mention detection

#### 3. **Analysis Integration** (`lib/analyze-common.ts`, `lib/ai-utils.ts`)
- Citations are extracted during AI response processing
- Raw response objects are captured from each provider
- Citation analysis runs after all responses are collected
- Results are included in the final analysis output

### Data Flow

1. **Analysis Phase**
   - User initiates brand analysis
   - AI providers generate responses with web search
   - Raw responses are captured along with text

2. **Citation Extraction**
   - For each provider response:
     - Extract citations based on provider-specific format
     - Detect which companies are mentioned
     - Store citation metadata

3. **Citation Analysis**
   - Aggregate all citations across providers
   - Calculate source frequencies
   - Group by company mentions
   - Generate provider-specific breakdowns

4. **Display**
   - User navigates to Citations tab
   - View citation statistics and distributions
   - Explore sources by category
   - Click through to original sources

## Provider-Specific Citation Formats

### Anthropic Claude
```json
{
  "content": [{
    "type": "text",
    "citations": [{
      "url": "https://example.com",
      "title": "Source Title",
      "cited_text": "Quoted text"
    }]
  }]
}
```

### Google Gemini
```json
{
  "groundingMetadata": {
    "groundingChunks": [{
      "web": {
        "uri": "https://example.com",
        "title": "Source Title"
      }
    }]
  }
}
```

### OpenAI
```json
{
  "choices": [{
    "message": {
      "content": [{
        "type": "output_text",
        "annotations": [{
          "type": "url_citation",
          "url": "https://example.com",
          "title": "Source Title"
        }]
      }]
    }
  }]
}
```

### Perplexity
```json
{
  "search_results": [{
    "url": "https://example.com",
    "title": "Source Title",
    "date": "2025-01-01"
  }]
}
```

## Usage

### For Users
1. Run a brand analysis as normal
2. Wait for analysis to complete
3. Click on "Citations & Sources" tab
4. Explore citation data across 4 views:
   - **Overview**: See overall statistics
   - **Your Brand**: View sources citing your brand
   - **Competitors**: Compare competitor citations
   - **Top Sources**: Identify most influential domains

### For Developers

#### Accessing Citation Data
```typescript
// In analysis results
const citationAnalysis = analysis.citationAnalysis;

// Check if citations are available
if (citationAnalysis) {
  console.log(`Total sources: ${citationAnalysis.totalSources}`);
  console.log(`Brand citations: ${citationAnalysis.brandCitations.totalCitations}`);
}
```

#### Customizing Citation Display
The `CitationsTab` component accepts:
```typescript
<CitationsTab
  citationAnalysis={analysis.citationAnalysis}
  brandName={company.name}
  competitors={identifiedCompetitors.map(c => c.name)}
/>
```

## Benefits

1. **Understand AI Source Selection**
   - See which websites AI models trust and cite
   - Identify opportunities for content placement
   - Track changes in citation patterns over time

2. **Competitive Intelligence**
   - Compare citation frequency with competitors
   - Identify domains favoring competitors
   - Find opportunities for improved visibility

3. **SEO & Content Strategy**
   - Focus content efforts on frequently-cited domains
   - Build relationships with influential sources
   - Optimize for AI-friendly content formats

4. **Transparency**
   - Verify AI responses with original sources
   - Build trust through citation visibility
   - Comply with citation requirements

## Future Enhancements

Potential improvements:
- Historical citation tracking over time
- Citation sentiment analysis
- Source authority scoring
- Citation network visualization
- Export citation data
- Alert on new citation sources
- Integration with content management systems

## Notes

- Citations are only available when web search is enabled
- Not all providers support citations (depends on model/API)
- Citation extraction is best-effort and may miss some sources
- Empty citation data doesn't indicate an error - just that providers didn't return citation metadata

