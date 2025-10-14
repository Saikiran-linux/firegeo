-- Migration: Add Citations and Citation Sources Tables
-- Created: 2025-10-14
-- Description: Adds tables to store citation data from brand analysis

-- Create citations table
CREATE TABLE IF NOT EXISTS citations (
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

-- Create citation_sources table (aggregated source information)
CREATE TABLE IF NOT EXISTS citation_sources (
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_citations_analysis_id ON citations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_citations_provider ON citations(provider);
CREATE INDEX IF NOT EXISTS idx_citations_url ON citations(url);
CREATE INDEX IF NOT EXISTS idx_citation_sources_analysis_id ON citation_sources(analysis_id);
CREATE INDEX IF NOT EXISTS idx_citation_sources_domain ON citation_sources(domain);
CREATE INDEX IF NOT EXISTS idx_citation_sources_url ON citation_sources(url);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_citation_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER citation_sources_updated_at
BEFORE UPDATE ON citation_sources
FOR EACH ROW
EXECUTE FUNCTION update_citation_sources_updated_at();

