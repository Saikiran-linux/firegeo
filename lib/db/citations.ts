/**
 * Database operations for citations and citation sources
 */

import { db } from '@/lib/db';
import { citations, citationSources, NewCitation, NewCitationSource, Citation as DBCitation, CitationSource } from './schema';
import { eq, and, desc } from 'drizzle-orm';
import { Citation, AIResponse, CitationAnalysis, SourceFrequency } from '@/lib/types';

/**
 * Save citations from an AI response to the database
 */
export async function saveCitations(
  analysisId: string,
  provider: string,
  promptId: string | undefined,
  citationList: Citation[]
): Promise<void> {
  if (!citationList || citationList.length === 0) {
    console.log(`[saveCitations] No citations to save for provider ${provider}`);
    return;
  }

  try {
    const citationsToInsert: NewCitation[] = citationList.map(citation => ({
      analysisId,
      provider,
      promptId,
      url: citation.url,
      title: citation.title || null,
      snippet: citation.snippet || null,
      source: citation.source || null,
      date: citation.date || null,
      position: citation.position || null,
      mentionedCompanies: citation.mentionedCompanies || [],
    }));

    await db.insert(citations).values(citationsToInsert);
    console.log(`[saveCitations] Saved ${citationsToInsert.length} citations for provider ${provider}`);
  } catch (error) {
    console.error(`[saveCitations] Error saving citations:`, error);
    throw error;
  }
}

/**
 * Build and save aggregated citation sources for an analysis
 */
export async function saveAggregatedSources(
  analysisId: string,
  citationAnalysis: CitationAnalysis
): Promise<void> {
  if (!citationAnalysis || !citationAnalysis.topSources || citationAnalysis.topSources.length === 0) {
    console.log(`[saveAggregatedSources] No sources to save for analysis ${analysisId}`);
    return;
  }

  try {
    const sourcesToInsert: NewCitationSource[] = citationAnalysis.topSources.map(source => ({
      analysisId,
      url: source.url,
      domain: source.domain,
      title: source.title || null,
      frequency: source.frequency,
      providers: source.providers,
      mentionedCompanies: source.mentionedCompanies || [],
    }));

    await db.insert(citationSources).values(sourcesToInsert);
    console.log(`[saveAggregatedSources] Saved ${sourcesToInsert.length} aggregated sources`);
  } catch (error) {
    console.error(`[saveAggregatedSources] Error saving aggregated sources:`, error);
    throw error;
  }
}

/**
 * Get all citations for a specific analysis
 */
export async function getCitationsByAnalysisId(analysisId: string): Promise<DBCitation[]> {
  try {
    const result = await db
      .select()
      .from(citations)
      .where(eq(citations.analysisId, analysisId))
      .orderBy(desc(citations.createdAt));

    console.log(`[getCitationsByAnalysisId] Found ${result.length} citations for analysis ${analysisId}`);
    return result;
  } catch (error) {
    console.error(`[getCitationsByAnalysisId] Error fetching citations:`, error);
    throw error;
  }
}

/**
 * Get aggregated citation sources for a specific analysis
 */
export async function getCitationSourcesByAnalysisId(analysisId: string): Promise<CitationSource[]> {
  try {
    const result = await db
      .select()
      .from(citationSources)
      .where(eq(citationSources.analysisId, analysisId))
      .orderBy(desc(citationSources.frequency));

    console.log(`[getCitationSourcesByAnalysisId] Found ${result.length} sources for analysis ${analysisId}`);
    return result;
  } catch (error) {
    console.error(`[getCitationSourcesByAnalysisId] Error fetching sources:`, error);
    throw error;
  }
}

/**
 * Delete all citations for a specific analysis
 * (Cascade delete should handle this, but this function is here for manual cleanup)
 */
export async function deleteCitationsByAnalysisId(analysisId: string): Promise<void> {
  try {
    await db.delete(citations).where(eq(citations.analysisId, analysisId));
    await db.delete(citationSources).where(eq(citationSources.analysisId, analysisId));
    console.log(`[deleteCitationsByAnalysisId] Deleted citations for analysis ${analysisId}`);
  } catch (error) {
    console.error(`[deleteCitationsByAnalysisId] Error deleting citations:`, error);
    throw error;
  }
}

/**
 * Reconstruct CitationAnalysis from database records
 */
export async function reconstructCitationAnalysis(
  analysisId: string,
  brandName: string,
  competitors: string[]
): Promise<CitationAnalysis | null> {
  try {
    const [dbCitations, dbSources] = await Promise.all([
      getCitationsByAnalysisId(analysisId),
      getCitationSourcesByAnalysisId(analysisId)
    ]);

    if (dbSources.length === 0) {
      console.log(`[reconstructCitationAnalysis] No sources found for analysis ${analysisId}`);
      return null;
    }

    // Convert database sources to SourceFrequency format
    const topSources: SourceFrequency[] = dbSources.map(source => ({
      url: source.url,
      domain: source.domain,
      title: source.title || undefined,
      frequency: source.frequency,
      providers: source.providers as string[],
      mentionedCompanies: (source.mentionedCompanies as string[]) || []
    }));

    // Categorize citations by brand and competitors
    const brandCitations: Citation[] = [];
    const competitorCitationsMap = new Map<string, Citation[]>();
    
    // Initialize competitor maps
    competitors.forEach(comp => {
      competitorCitationsMap.set(comp, []);
    });

    dbCitations.forEach(dbCitation => {
      const citation: Citation = {
        url: dbCitation.url,
        title: dbCitation.title || undefined,
        snippet: dbCitation.snippet || undefined,
        source: dbCitation.source || undefined,
        date: dbCitation.date || undefined,
        position: dbCitation.position || undefined,
        mentionedCompanies: (dbCitation.mentionedCompanies as string[]) || []
      };

      const mentionedCompanies = citation.mentionedCompanies || [];

      // Categorize by mentioned companies
      if (mentionedCompanies.includes(brandName)) {
        brandCitations.push(citation);
      }

      competitors.forEach(comp => {
        if (mentionedCompanies.includes(comp)) {
          competitorCitationsMap.get(comp)!.push(citation);
        }
      });
    });

    // Build brand citations data
    const brandDomainMap = new Map<string, number>();
    brandCitations.forEach(citation => {
      const domain = extractDomain(citation.url);
      brandDomainMap.set(domain, (brandDomainMap.get(domain) || 0) + 1);
    });
    const brandTopDomains = Array.from(brandDomainMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain]) => domain);

    // Build competitor citations data
    const competitorCitations: Record<string, {
      totalCitations: number;
      sources: Citation[];
      topDomains: string[];
    }> = {};

    competitors.forEach(comp => {
      const citations = competitorCitationsMap.get(comp) || [];
      const domainMap = new Map<string, number>();
      
      citations.forEach(citation => {
        const domain = extractDomain(citation.url);
        domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
      });

      const topDomains = Array.from(domainMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([domain]) => domain);

      competitorCitations[comp] = {
        totalCitations: citations.length,
        sources: citations,
        topDomains
      };
    });

    // Build provider breakdown
    const providerBreakdown: Record<string, SourceFrequency[]> = {};
    dbCitations.forEach(dbCitation => {
      const provider = dbCitation.provider;
      
      if (!providerBreakdown[provider]) {
        providerBreakdown[provider] = [];
      }

      const domain = extractDomain(dbCitation.url);
      const existing = providerBreakdown[provider].find(s => s.url === dbCitation.url);
      
      if (existing) {
        existing.frequency++;
      } else {
        providerBreakdown[provider].push({
          url: dbCitation.url,
          domain,
          title: dbCitation.title || undefined,
          frequency: 1,
          providers: [provider],
          mentionedCompanies: (dbCitation.mentionedCompanies as string[]) || []
        });
      }
    });

    return {
      totalSources: dbSources.length,
      topSources,
      brandCitations: {
        totalCitations: brandCitations.length,
        sources: brandCitations,
        topDomains: brandTopDomains
      },
      competitorCitations,
      providerBreakdown
    };
  } catch (error) {
    console.error(`[reconstructCitationAnalysis] Error:`, error);
    return null;
  }
}

/**
 * Helper function to extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

