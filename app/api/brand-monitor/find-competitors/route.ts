import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { fetchCompetitorsWithWebSearch } from '@/lib/perplexity';
import type { CompanyInput } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to find competitors');
    }

    const body = await request.json();
    const { companyName, companyUrl, businessDescription } = body;

    if (!companyName || !businessDescription) {
      throw new ValidationError('Company name and description are required');
    }

    console.log('[find-competitors] Finding competitors for:', companyName);

    // Prepare company input for Perplexity
    const companyInput: CompanyInput = {
      name: companyName,
      url: companyUrl || '',
      industry: '', // Will be inferred from description
      description: businessDescription,
    };

    // Use Perplexity Sonar Pro to find competitors
    const competitors = await fetchCompetitorsWithWebSearch(companyInput);

    console.log(`[find-competitors] Found ${competitors.length} competitors`);

    // Format competitors for response (Perplexity doesn't return URLs, so we'll leave them empty)
    const formattedCompetitors = competitors.map(c => ({
      name: c.name,
      type: c.type,
    }));
    return NextResponse.json({
      competitors: formattedCompetitors,
      count: formattedCompetitors.length,
    });
  } catch (error) {
    console.error('[find-competitors] Error:', error);
    return handleApiError(error);
  }
}

