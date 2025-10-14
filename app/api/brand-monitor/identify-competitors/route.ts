import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { CompanyInput } from '@/lib/types';
import { fetchCompetitorsWithWebSearch, CompetitorWithType } from '@/lib/perplexity';

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

    let competitors: CompetitorWithType[] = [];

    console.log('\n' + '═'.repeat(100));
    console.log('🎯 API ENDPOINT: /api/brand-monitor/identify-competitors');
    console.log('═'.repeat(100));
    console.log(`📥 Request received for company: ${sanitizedCompany.name}`);
    console.log(`🔗 Website: ${sanitizedCompany.url || 'Not provided'}`);
    console.log(`🏭 Industry: ${sanitizedCompany.industry || 'Not specified'}`);
    
    if (sanitizedCompany.scrapedData?.competitors?.length) {
      console.log(`📋 Scraped competitors found: ${sanitizedCompany.scrapedData.competitors.length}`);
    }

    try {
      console.log('\n🚀 Initiating competitor research with Perplexity Sonar Pro...\n');
      const startTime = Date.now();
      
      competitors = await fetchCompetitorsWithWebSearch(sanitizedCompany);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n⏱️  Total API processing time: ${duration}s`);
      console.log(`✅ Perplexity returned ${competitors.length} competitors`);
    } catch (webSearchError) {
      console.error('\n❌ Failed to fetch competitors from Perplexity:', webSearchError);
      competitors = [];
    }

    // Add any competitors from scraping as direct type
    if (sanitizedCompany.scrapedData?.competitors) {
      const scrapedCount = competitors.length;
      const scrapedCompetitors = sanitizedCompany.scrapedData.competitors
        .filter(name => !competitors.find(c => c.name.toLowerCase() === name.toLowerCase()))
        .map(name => ({ name, type: 'direct' as const }));
      
      if (scrapedCompetitors.length > 0) {
        console.log(`\n📌 Adding ${scrapedCompetitors.length} additional competitors from website scraping`);
      }
      
      competitors = [...competitors, ...scrapedCompetitors].slice(0, 15);
      
      if (scrapedCompetitors.length > 0) {
        console.log(`📊 Total after merging: ${competitors.length} competitors`);
      }
    }

    console.log('\n' + '═'.repeat(100));
    console.log(`✅ FINAL RESPONSE: Returning ${competitors.length} competitors`);
    console.log('═'.repeat(100) + '\n');

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
