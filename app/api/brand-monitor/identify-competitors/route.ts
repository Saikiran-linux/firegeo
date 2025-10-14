import { NextRequest, NextResponse } from 'next/server';
import pino from 'pino';
import { auth } from '@/lib/auth';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { CompanyInput } from '@/lib/types';
import { fetchCompetitorsWithWebSearch, CompetitorWithType } from '@/lib/perplexity';

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
});

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

    const isProduction = process.env.NODE_ENV === 'production';
    const logCompanyName = isProduction ? '[REDACTED]' : sanitizedCompany.name;
    const logWebsite = isProduction ? '[REDACTED]' : (sanitizedCompany.url || 'Not provided');
    const logIndustry = sanitizedCompany.industry || 'Not specified';

    logger.info({
      company: logCompanyName,
      website: logWebsite,
      industry: logIndustry,
      hasScrapedCompetitors: !!sanitizedCompany.scrapedData?.competitors?.length,
    }, 'API /api/brand-monitor/identify-competitors request received');

    if (sanitizedCompany.scrapedData?.competitors?.length) {
      logger.debug({
        count: sanitizedCompany.scrapedData.competitors.length,
        sample: isProduction ? undefined : sanitizedCompany.scrapedData.competitors.slice(0, 5),
      }, 'Scraped competitors detected');
    }

    try {
      logger.info('Initiating competitor research with Perplexity Sonar Pro');
      const startTime = Date.now();
      
      competitors = await fetchCompetitorsWithWebSearch(sanitizedCompany);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info({
        durationSeconds: Number(duration),
        competitorCount: competitors.length,
      }, 'Perplexity competitor research completed');
    } catch (webSearchError) {
      logger.error({ err: webSearchError }, 'Failed to fetch competitors from Perplexity');
      competitors = [];
    }

    // Add any competitors from scraping as direct type
    if (sanitizedCompany.scrapedData?.competitors) {
      const scrapedCount = competitors.length;
      const scrapedCompetitors = sanitizedCompany.scrapedData.competitors
        .filter(name => !competitors.find(c => c.name.toLowerCase() === name.toLowerCase()))
        .map(name => ({ name, type: 'direct' as const }));
      
      competitors = [...competitors, ...scrapedCompetitors].slice(0, 15);
      
      if (scrapedCompetitors.length > 0) {
        logger.info({
          added: scrapedCompetitors.length,
          total: competitors.length,
        }, 'Merged scraped competitors');
      }
    }

    logger.info({
      competitorCount: competitors.length,
    }, 'Returning competitors response');

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
