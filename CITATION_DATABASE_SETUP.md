# Citation Database Setup Guide

## Quick Start

This guide will help you set up the citation database storage for your brand monitoring application.

## Prerequisites

- PostgreSQL database running
- Database connection configured in `.env.local`
- Node.js and npm/pnpm installed

## Step 1: Run the Database Migration

### Option A: Using psql (Recommended)

```bash
# Connect to your database
psql $DATABASE_URL

# Or if you have credentials in .env.local
psql $(grep DATABASE_URL .env.local | cut -d '=' -f2)

# Run the migration
\i migrations/002_add_citations_tables.sql

# Verify tables were created
\dt citations*

# Exit psql
\q
```

### Option B: Using Drizzle Kit

```bash
# Push schema changes
npx drizzle-kit push

# Or generate migration
npx drizzle-kit generate
```

### Option C: Manual SQL Execution

Copy the contents of `migrations/002_add_citations_tables.sql` and execute it in your PostgreSQL client of choice (pgAdmin, DBeaver, etc.)

## Step 2: Verify the Setup

Run this SQL query to verify tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('citations', 'citation_sources');
```

You should see both tables listed.

## Step 3: Test the Implementation

### Run a New Analysis

1. Start your development server:
```bash
npm run dev
# or
pnpm dev
```

2. Navigate to the Brand Monitor page
3. Enter a company URL and run an analysis
4. **Important:** Enable "Use Web Search" toggle to get citations
5. Wait for the analysis to complete
6. Click "Save Analysis"

### Verify Citations in Database

```sql
-- Check if citations were saved
SELECT COUNT(*) as citation_count FROM citations;

-- View some citations
SELECT 
  provider,
  url,
  title,
  array_length(mentioned_companies, 1) as companies_mentioned
FROM citations
LIMIT 5;

-- Check aggregated sources
SELECT 
  domain,
  frequency,
  providers,
  mentioned_companies
FROM citation_sources
ORDER BY frequency DESC
LIMIT 10;
```

### Load a Saved Analysis

1. Go to the dashboard
2. Click on a saved analysis
3. Navigate to the "Citations" tab
4. Verify that citation data is displayed

## Troubleshooting

### Citations Not Showing Up

**Check 1: Web Search Enabled?**
- Citations only work with providers that support web search
- Make sure the "Use Web Search" toggle is ON

**Check 2: Check Backend Logs**
```bash
# Look for these log messages:
[saveCitations] Saved X citations for provider Y
[saveAggregatedSources] Saved X aggregated sources
```

**Check 3: Verify Database Records**
```sql
-- Check the most recent analysis
SELECT 
  id,
  company_name,
  created_at,
  (SELECT COUNT(*) FROM citations WHERE analysis_id = brand_analyses.id) as citation_count
FROM brand_analyses
ORDER BY created_at DESC
LIMIT 5;
```

### Migration Failed

**Error: relation already exists**
- The tables may already exist
- Check with: `\dt citations*` in psql
- If tables exist but are outdated, you may need to drop and recreate them

**Error: permission denied**
- Ensure your database user has CREATE TABLE permissions
- Grant permissions: `GRANT CREATE ON SCHEMA public TO your_user;`

### Citations Not Saving

**Check Frontend Console**
```javascript
// Look for this log message:
[BrandMonitor] Saving analysis with citations: {
  hasResponses: true,
  responsesCount: 15,
  hasCitationAnalysis: true,
  totalSources: 8
}
```

**Check Backend Logs**
```bash
# Look for:
[SaveAnalysis] Processing X responses for citations
[SaveAnalysis] Saved X citations for provider Y
[SaveAnalysis] Saved aggregated citation sources
```

### Reconstructing Missing Citations

If an old analysis doesn't have citations in the stored data, the system will try to reconstruct from the database:

```sql
-- Manually check if reconstruction would work
SELECT 
  a.id,
  a.company_name,
  (SELECT COUNT(*) FROM citations WHERE analysis_id = a.id) as citation_count,
  (SELECT COUNT(*) FROM citation_sources WHERE analysis_id = a.id) as source_count
FROM brand_analyses a
WHERE a.id = 'your-analysis-id';
```

## Understanding the Data Structure

### Individual Citations

Each citation record represents one source cited by one AI provider for one prompt:

```typescript
{
  id: "uuid",
  analysisId: "analysis-uuid",
  provider: "anthropic",
  promptId: "What are the best...",
  url: "https://techcrunch.com/article",
  title: "Best SaaS Tools",
  snippet: "According to experts...",
  source: "techcrunch.com",
  mentionedCompanies: ["YourBrand", "Competitor1"]
}
```

### Aggregated Sources

Citation sources aggregate data across all providers:

```typescript
{
  id: "uuid",
  analysisId: "analysis-uuid",
  url: "https://techcrunch.com/article",
  domain: "techcrunch.com",
  frequency: 3,  // Cited by 3 different provider/prompt combinations
  providers: ["anthropic", "google", "openai"],
  mentionedCompanies: ["YourBrand", "Competitor1", "Competitor2"]
}
```

## Performance Tips

1. **Enable Web Search Only When Needed**
   - Citations require web search, which uses more credits
   - Disable for quick sentiment checks

2. **Database Indexes**
   - The migration automatically creates indexes
   - Monitor query performance with EXPLAIN ANALYZE

3. **Cascade Deletes**
   - Deleting an analysis automatically deletes citations
   - No need for manual cleanup

## Next Steps

After successful setup:

1. ✅ Citations are automatically saved with each analysis
2. ✅ Old analyses without citations will reconstruct from database
3. ✅ Citation tab shows comprehensive source analysis
4. ✅ Data persists across sessions

## Additional Resources

- **Full Documentation:** `docs/citation-tracking/DATABASE_IMPLEMENTATION.md`
- **Migration File:** `migrations/002_add_citations_tables.sql`
- **Database Operations:** `lib/db/citations.ts`
- **API Implementation:** `app/api/brand-monitor/analyses/route.ts`

## Support

If you encounter issues:

1. Check the console logs (browser and server)
2. Verify database connection
3. Check that migrations ran successfully
4. Review the troubleshooting section above
5. Check existing documentation in `docs/citation-tracking/`

## Sample Queries for Monitoring

```sql
-- Citation stats by provider
SELECT 
  provider,
  COUNT(*) as total_citations,
  COUNT(DISTINCT analysis_id) as analyses_with_citations
FROM citations
GROUP BY provider;

-- Most frequently cited domains
SELECT 
  domain,
  SUM(frequency) as total_mentions,
  COUNT(DISTINCT analysis_id) as analyses_citing
FROM citation_sources
GROUP BY domain
ORDER BY total_mentions DESC
LIMIT 20;

-- Recent citation activity
SELECT 
  c.provider,
  c.url,
  c.title,
  c.mentioned_companies,
  c.created_at,
  a.company_name
FROM citations c
JOIN brand_analyses a ON c.analysis_id = a.id
ORDER BY c.created_at DESC
LIMIT 10;
```

