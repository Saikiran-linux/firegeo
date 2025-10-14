# Citation Database Implementation

## Overview

This document describes the complete database implementation for storing and retrieving citation data from brand analysis. The system now persists all citations and sources to the database, allowing for reliable data storage and retrieval.

## Architecture

### Database Schema

Two new tables have been added to store citation data:

#### 1. `citations` Table
Stores individual citation records from AI provider responses.

```sql
CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES brand_analyses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  prompt_id TEXT,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  source TEXT,
  date TEXT,
  position INTEGER,
  mentioned_companies JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Fields:**
- `analysis_id` - Links to the parent brand analysis
- `provider` - Which AI provider returned this citation (e.g., "anthropic", "google")
- `prompt_id` - Optional identifier for which prompt generated this citation
- `url` - The citation URL
- `title` - Citation title
- `snippet` - Text excerpt from the citation
- `source` - Domain or source name
- `date` - Publication date if available
- `position` - Position in search results
- `mentioned_companies` - JSON array of company names mentioned in the citation

#### 2. `citation_sources` Table
Stores aggregated source information across all citations and providers.

```sql
CREATE TABLE citation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES brand_analyses(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  frequency INTEGER NOT NULL DEFAULT 1,
  providers JSONB NOT NULL,
  mentioned_companies JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Fields:**
- `analysis_id` - Links to the parent brand analysis
- `url` - Aggregated source URL
- `domain` - Extracted domain name for grouping
- `frequency` - How many times this source was cited across all providers
- `providers` - JSON array of providers that cited this source
- `mentioned_companies` - JSON array of all companies mentioned across all citations from this source

### Database Operations

The `lib/db/citations.ts` module provides the following operations:

#### Save Operations

```typescript
// Save citations from a single AI response
await saveCitations(
  analysisId: string,
  provider: string,
  promptId: string | undefined,
  citationList: Citation[]
);

// Save aggregated citation sources
await saveAggregatedSources(
  analysisId: string,
  citationAnalysis: CitationAnalysis
);
```

#### Retrieve Operations

```typescript
// Get all citations for an analysis
const citations = await getCitationsByAnalysisId(analysisId: string);

// Get aggregated sources for an analysis
const sources = await getCitationSourcesByAnalysisId(analysisId: string);

// Reconstruct full citation analysis from database
const citationAnalysis = await reconstructCitationAnalysis(
  analysisId: string,
  brandName: string,
  competitors: string[]
);
```

#### Delete Operations

```typescript
// Delete all citations for an analysis (cascade delete handles this automatically)
await deleteCitationsByAnalysisId(analysisId: string);
```

## Data Flow

### 1. Analysis Creation & Citation Storage

```
User initiates analysis
    ↓
API performs analysis with AI providers
    ↓
AI providers return responses with citations
    ↓
Analysis completes, returns to frontend
    ↓
Frontend saves analysis via POST /api/brand-monitor/analyses
    ↓
Backend extracts citations from responses
    ↓
Backend saves individual citations to `citations` table
    ↓
Backend saves aggregated sources to `citation_sources` table
    ↓
Analysis saved with ID returned to frontend
```

### 2. Analysis Retrieval & Citation Loading

```
User loads saved analysis
    ↓
Frontend calls GET /api/brand-monitor/analyses/:id
    ↓
Backend fetches analysis from database
    ↓
Backend checks if citationAnalysis exists in stored data
    ↓
If not, reconstructs from database using reconstructCitationAnalysis()
    ↓
Backend returns analysis with citation data
    ↓
Frontend displays citations in CitationsTab component
```

## API Endpoints

### POST /api/brand-monitor/analyses

Saves a brand analysis including citation data.

**Request Body:**
```typescript
{
  url: string;
  companyName: string;
  industry?: string;
  analysisData: any;
  competitors: any[];
  prompts: any[];
  creditsUsed: number;
  responses: AIResponse[];        // NEW: For citation extraction
  citationAnalysis: CitationAnalysis;  // NEW: For aggregated sources
}
```

**Process:**
1. Creates brand analysis record
2. Extracts citations from each response
3. Saves individual citations with provider/prompt context
4. Saves aggregated citation sources
5. Returns saved analysis

### GET /api/brand-monitor/analyses/:id

Retrieves a brand analysis including citation data.

**Response:**
```typescript
{
  id: string;
  userId: string;
  url: string;
  companyName: string;
  industry?: string;
  analysisData: {
    // ... other analysis data
    citationAnalysis: CitationAnalysis; // Included or reconstructed
  };
  // ... other fields
}
```

**Process:**
1. Fetches analysis from database
2. Checks if citationAnalysis exists in stored data
3. If missing, reconstructs from database tables
4. Returns complete analysis with citations

## Frontend Integration

### Saving Analysis

The `BrandMonitor` component automatically saves analysis data including citations:

```typescript
const analysisData = {
  url: company?.url || url,
  companyName: company?.name,
  industry: company?.industry,
  analysisData: completedAnalysis,
  competitors: identifiedCompetitors,
  prompts: analyzingPrompts,
  creditsUsed: CREDITS_PER_BRAND_ANALYSIS,
  responses: completedAnalysis.responses,           // For citation extraction
  citationAnalysis: completedAnalysis.citationAnalysis  // For aggregated data
};

saveAnalysis.mutate(analysisData);
```

### Loading Analysis

The `useBrandAnalysis` hook automatically fetches analysis with citations:

```typescript
const { data: analysis } = useBrandAnalysis(analysisId);

// Citation analysis is available at:
const citationAnalysis = analysis?.analysisData?.citationAnalysis;
```

### Displaying Citations

The `CitationsTab` component automatically displays citation data:

```typescript
<CitationsTab
  citationAnalysis={analysis?.citationAnalysis}
  brandName={brandName}
  competitors={competitors}
/>
```

## Migration Guide

### Running the Migration

1. Connect to your PostgreSQL database:
```bash
psql $DATABASE_URL
```

2. Run the migration:
```sql
\i migrations/002_add_citations_tables.sql
```

Or using Drizzle Kit:
```bash
npx drizzle-kit push
```

### Verifying the Migration

Check that tables were created:
```sql
\dt citations*
```

Verify indexes:
```sql
\di citations*
```

## Performance Considerations

### Indexes

The migration creates the following indexes for optimal performance:

- `idx_citations_analysis_id` - Fast lookup of all citations for an analysis
- `idx_citations_provider` - Filter citations by AI provider
- `idx_citations_url` - Look up specific citation URLs
- `idx_citation_sources_analysis_id` - Fast lookup of sources for an analysis
- `idx_citation_sources_domain` - Group sources by domain
- `idx_citation_sources_url` - Look up specific source URLs

### Cascade Deletes

When a brand analysis is deleted, all associated citations and citation sources are automatically deleted via cascade delete constraints. This ensures data consistency and prevents orphaned records.

## Data Integrity

### Error Handling

The system is designed to be resilient:

1. **Citation save failures don't fail the entire analysis save**
   - Citations are saved in a try-catch block
   - Errors are logged but don't propagate

2. **Missing citations don't break analysis retrieval**
   - If citationAnalysis is missing, it's reconstructed from the database
   - If reconstruction fails, the analysis is still returned without citations

3. **Graceful degradation**
   - The frontend checks for citation data before displaying
   - Missing citation data shows a helpful message instead of crashing

### Data Validation

- All required fields are enforced at the database level
- JSONB fields use TypeScript types for type safety
- Foreign key constraints ensure referential integrity

## Monitoring & Debugging

### Console Logging

The implementation includes comprehensive logging:

```typescript
console.log('[saveCitations] Saved 5 citations for provider anthropic');
console.log('[getCitationsByAnalysisId] Found 20 citations for analysis xyz');
console.log('[reconstructCitationAnalysis] Successfully reconstructed with 8 sources');
```

### Common Issues

1. **Citations not showing up**
   - Check backend logs for save errors
   - Verify the responses contain citations
   - Check database for citation records

2. **Reconstruction failing**
   - Ensure brandName and competitors are available
   - Check for database connection issues
   - Verify foreign key references

3. **Duplicate citations**
   - Check that the same analysis isn't being saved multiple times
   - Verify hasSavedRef logic in frontend

## Future Enhancements

Possible future improvements:

1. **Deduplication** - Detect and merge duplicate citations across different analyses
2. **Citation quality scoring** - Rank citations by authority and relevance
3. **Historical tracking** - Track how citation patterns change over time
4. **Batch operations** - Optimize for bulk citation operations
5. **Full-text search** - Enable searching within citation snippets
6. **Citation analytics** - Aggregate statistics across multiple analyses

## Testing

### Manual Testing Checklist

- [ ] Run a new analysis with web search enabled
- [ ] Verify citations appear in the UI
- [ ] Save the analysis
- [ ] Check database for citation records
- [ ] Reload the saved analysis
- [ ] Verify citations still appear correctly
- [ ] Delete an analysis
- [ ] Verify citations are cascade deleted

### Database Queries for Testing

```sql
-- Check citation counts by provider
SELECT provider, COUNT(*) 
FROM citations 
GROUP BY provider;

-- View citation sources by frequency
SELECT domain, frequency, providers 
FROM citation_sources 
ORDER BY frequency DESC 
LIMIT 10;

-- Check citations for a specific analysis
SELECT * FROM citations 
WHERE analysis_id = 'your-analysis-id';
```

## Support

For issues or questions about the citation database implementation:

1. Check the console logs for error messages
2. Verify the migration ran successfully
3. Review the code in `lib/db/citations.ts`
4. Check API endpoint logs for save/retrieve operations

