import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { Company } from '@/lib/types';
import { fetchCompetitorsWithWebSearch } from '@/lib/perplexity';
import { identifyCompetitors } from '@/lib/ai-utils';

export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to use brand monitor');
    }

    const { company } = await request.json();

    if (!company || !company.name) {
      throw new ValidationError('Invalid company data provided', {
        company: 'Company name is required',
      });
    }

    let competitors: string[] = [];

    try {
      competitors = await fetchCompetitorsWithWebSearch(company as Company);
    } catch (webSearchError) {
      console.error('[identify-competitors] Web search competitor fetch failed, falling back to identifyCompetitors:', webSearchError);
    }

    if (!competitors.length) {
      competitors = await identifyCompetitors(company as Company);
    }

    return NextResponse.json({ competitors });
  } catch (error) {
    return handleApiError(error);
  }
}
