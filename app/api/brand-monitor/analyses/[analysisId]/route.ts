import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/api-errors';
import { reconstructCitationAnalysis } from '@/lib/db/citations';

// GET /api/brand-monitor/analyses/[analysisId] - Get a specific analysis
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view this analysis');
    }

    const { analysisId } = await params;

    const analysis = await db.query.brandAnalyses.findFirst({
      where: and(
        eq(brandAnalyses.id, analysisId),
        eq(brandAnalyses.userId, sessionResponse.user.id)
      ),
    });

    if (!analysis) {
      throw new NotFoundError('Analysis not found');
    }

    // Reconstruct citation analysis from database if not already in the analysis data
    let citationAnalysis = null;
    
    // Check if we need to reconstruct citation analysis
    // This will be the case if we have citations in the database but not in the stored analysisData
    const analysisData = analysis.analysisData as any;
    const hasStoredCitations = analysisData?.citationAnalysis && 
                               Object.keys(analysisData.citationAnalysis).length > 0;
    
    if (!hasStoredCitations) {
      console.log(`[GetAnalysis] No stored citations, attempting to reconstruct from database`);
      const brandName = analysis.companyName || (analysisData?.company?.name);
      const competitors = analysisData?.knownCompetitors || 
                         (Array.isArray(analysis.competitors) ? analysis.competitors : []);
      
      if (brandName && competitors) {
        try {
          citationAnalysis = await reconstructCitationAnalysis(
            analysisId,
            brandName,
            competitors
          );
          
          if (citationAnalysis) {
            console.log(`[GetAnalysis] Successfully reconstructed citation analysis with ${citationAnalysis.totalSources} sources`);
          }
        } catch (error) {
          console.error(`[GetAnalysis] Error reconstructing citation analysis:`, error);
          // Don't fail the request if citation reconstruction fails
        }
      }
    } else {
      console.log(`[GetAnalysis] Using stored citation analysis`);
      citationAnalysis = analysisData.citationAnalysis;
    }

    // Return the analysis with citation analysis (either from storage or reconstructed)
    const response = {
      ...analysis,
      analysisData: {
        ...analysisData,
        citationAnalysis: citationAnalysis || analysisData?.citationAnalysis
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/brand-monitor/analyses/[analysisId] - Delete an analysis
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to delete this analysis');
    }

    const { analysisId } = await params;

    const result = await db.delete(brandAnalyses)
      .where(and(
        eq(brandAnalyses.id, analysisId),
        eq(brandAnalyses.userId, sessionResponse.user.id)
      ))
      .returning();

    if (result.length === 0) {
      throw new NotFoundError('Analysis not found');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}