import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { saveCitations, saveAggregatedSources } from '@/lib/db/citations';
import { AIResponse, CitationAnalysis } from '@/lib/types';

// GET /api/brand-monitor/analyses - Get user's brand analyses
export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view your analyses');
    }

    const analyses = await db.query.brandAnalyses.findMany({
      where: eq(brandAnalyses.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalyses.createdAt),
    });

    return NextResponse.json(analyses);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/brand-monitor/analyses - Save a new brand analysis
export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to save analyses');
    }

    const body = await request.json();
    
    if (!body.url || !body.analysisData) {
      throw new ValidationError('Invalid request', {
        url: body.url ? undefined : 'URL is required',
        analysisData: body.analysisData ? undefined : 'Analysis data is required',
      });
    }

    const [analysis] = await db.insert(brandAnalyses).values({
      userId: sessionResponse.user.id,
      url: body.url,
      companyName: body.companyName,
      industry: body.industry,
      analysisData: body.analysisData,
      competitors: body.competitors,
      prompts: body.prompts,
      creditsUsed: body.creditsUsed || 10,
    }).returning();

    // Save citations if available
    if (body.responses && Array.isArray(body.responses)) {
      console.log(`[SaveAnalysis] Processing ${body.responses.length} responses for citations`);
      
      for (const response of body.responses as AIResponse[]) {
        if (response.citations && response.citations.length > 0) {
          try {
            await saveCitations(
              analysis.id,
              response.provider,
              response.prompt, // Use prompt as promptId
              response.citations
            );
            console.log(`[SaveAnalysis] Saved ${response.citations.length} citations for provider ${response.provider}`);
          } catch (error) {
            console.error(`[SaveAnalysis] Error saving citations for provider ${response.provider}:`, error);
            // Don't fail the entire save if citations fail
          }
        }
      }
    }

    // Save aggregated citation sources if available
    if (body.citationAnalysis) {
      try {
        await saveAggregatedSources(analysis.id, body.citationAnalysis as CitationAnalysis);
        console.log(`[SaveAnalysis] Saved aggregated citation sources`);
      } catch (error) {
        console.error(`[SaveAnalysis] Error saving aggregated sources:`, error);
        // Don't fail the entire save if aggregated sources fail
      }
    }

    return NextResponse.json(analysis);
  } catch (error) {
    return handleApiError(error);
  }
}