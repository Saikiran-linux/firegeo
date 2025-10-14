# Database Migrations

This directory contains SQL migration files for the database schema.

## Migration History

1. **001_create_app_schema.sql** - Initial schema with user profiles, conversations, messages, settings, and brand analyses
2. **002_add_citations_tables.sql** - Added citations and citation_sources tables for tracking AI citation data

## Running Migrations

Migrations are run manually using your PostgreSQL client:

```bash
# Connect to your database
psql $DATABASE_URL

# Run a specific migration
\i migrations/002_add_citations_tables.sql
```

Or use a migration runner tool like:
- Drizzle Kit: `npx drizzle-kit push`
- node-pg-migrate
- Flyway

## Creating New Migrations

1. Create a new `.sql` file with a descriptive name and sequential number
2. Include clear comments explaining what the migration does
3. Use `IF NOT EXISTS` clauses to make migrations idempotent
4. Add appropriate indexes for performance
5. Update this README with the migration description

## Citation Tables Schema

The citation tracking system uses two tables:

### `citations`
Stores individual citation records from AI responses.

- `id` - UUID primary key
- `analysis_id` - References the brand analysis
- `provider` - AI provider that returned this citation
- `prompt_id` - Optional prompt identifier
- `url` - Citation URL
- `title` - Citation title
- `snippet` - Text snippet from the citation
- `source` - Source domain or name
- `date` - Publication date (if available)
- `position` - Position in search results
- `mentioned_companies` - JSONB array of company names mentioned
- `created_at` - Timestamp

### `citation_sources`
Aggregated view of citation sources across all providers.

- `id` - UUID primary key
- `analysis_id` - References the brand analysis
- `url` - Source URL
- `domain` - Extracted domain name
- `title` - Source title
- `frequency` - How many times this source was cited
- `providers` - JSONB array of providers that cited this source
- `mentioned_companies` - JSONB array of all companies mentioned
- `created_at` - Timestamp
- `updated_at` - Auto-updated timestamp

## Indexes

The following indexes are created for optimal query performance:

- `idx_citations_analysis_id` - Find all citations for an analysis
- `idx_citations_provider` - Filter citations by provider
- `idx_citations_url` - Look up specific citation URLs
- `idx_citation_sources_analysis_id` - Find all sources for an analysis
- `idx_citation_sources_domain` - Filter sources by domain
- `idx_citation_sources_url` - Look up specific source URLs
