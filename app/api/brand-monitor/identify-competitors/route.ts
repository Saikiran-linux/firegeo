import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { CompanyInput } from '@/lib/types';
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

    if (!isCompanyInput(company)) {
      throw new ValidationError('Invalid company data provided', {
        company: 'Company name is required',
      });
    }

    const sanitizedCompany: CompanyInput = {
      ...company,
      name: company.name.trim(),
    };

    let competitors: string[] = [];

    try {
      competitors = await fetchCompetitorsWithWebSearch(sanitizedCompany);
    } catch (webSearchError) {
      console.error('[identify-competitors] Web search competitor fetch failed, falling back to identifyCompetitors:', webSearchError);
    }

    if (!competitors.length) {
      competitors = await identifyCompetitors(sanitizedCompany);
    }

    return NextResponse.json({ competitors });
  } catch (error) {
    return handleApiError(error);
  }
}

function isCompanyInput(value: unknown): value is CompanyInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.name !== 'string' || !candidate.name.trim()) {
    return false;
  }

  return true;
}
