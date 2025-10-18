import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses } from '@/lib/db/schema';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { scrapeCompanyInfo } from '@/lib/scrape-utils';
import { fetchCompetitorsWithWebSearch } from '@/lib/perplexity';
import type { CompanyInput } from '@/lib/types';

interface OnboardingData {
  websiteUrl: string;
  businessDescription: string;
  topics: string[];
  prompts: string[] | Array<{ id: string; prompt: string; category: string }>;
  competitors: Array<{
    name: string;
    url: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to complete onboarding');
    }

    const body: OnboardingData = await request.json();
    const { websiteUrl, businessDescription, topics, prompts, competitors } = body;

    // Validate required fields
    if (!websiteUrl || !businessDescription) {
      throw new ValidationError('Website URL and business description are required');
    }

    console.log('[onboarding] Starting onboarding process...');

    // Step 1: Scrape company info using Firecrawl
    console.log('[onboarding] Step 1: Scraping company info with Firecrawl...');
    let companyInfo;
    try {
      companyInfo = await scrapeCompanyInfo(websiteUrl);
      console.log(`[onboarding] Company scraped: ${companyInfo.name}`);
    } catch (error) {
      console.error('[onboarding] Error scraping company:', error);
      // Use fallback data
      companyInfo = {
        id: crypto.randomUUID(),
        url: websiteUrl,
        name: extractCompanyName(websiteUrl),
        description: businessDescription,
        industry: topics?.[0] || 'General',
        scraped: false,
      };
    }

    // Step 2: Find competitors using Perplexity if user didn't add any
    let finalCompetitors = competitors;
    if (!competitors || competitors.length === 0) {
      console.log('[onboarding] Step 2: Finding competitors with Perplexity...');
      try {
        const companyInput: CompanyInput = {
          name: companyInfo.name,
          url: websiteUrl,
          industry: companyInfo.industry,
          description: businessDescription,
          scrapedData: companyInfo.scrapedData,
        };
        
        const foundCompetitors = await fetchCompetitorsWithWebSearch(companyInput);
        finalCompetitors = foundCompetitors.map(c => ({
          name: c.name,
          url: '', // Perplexity doesn't return URLs
        }));
        console.log(`[onboarding] Found ${finalCompetitors.length} competitors`);
      } catch (error) {
        console.error('[onboarding] Error finding competitors:', error);
        // Continue without competitors
        finalCompetitors = [];
      }
    }

    // Normalize prompts - they could be strings or objects with category
    const normalizedPrompts = (prompts || []).map((p, index) => {
      if (typeof p === 'string') {
        // Old format: just a string
        // Try to infer category from the text
        const promptLower = p.toLowerCase();
        let category: 'ranking' | 'comparison' | 'alternatives' | 'recommendations' = 'ranking';
        
        if (promptLower.includes('compare') || promptLower.includes('versus') || promptLower.includes('vs') || promptLower.includes('difference')) {
          category = 'comparison';
        } else if (promptLower.includes('alternative') || promptLower.includes('similar') || promptLower.includes('instead')) {
          category = 'alternatives';
        } else if (promptLower.includes('recommend') || promptLower.includes('should i') || promptLower.includes('which one')) {
          category = 'recommendations';
        }
        
        return {
          id: `onboarding-${crypto.randomUUID()}-${index}`,
          prompt: p,
          category,
        };
      } else {
        // New format: object with category
        return {
          id: p.id || `onboarding-${crypto.randomUUID()}-${index}`,
          prompt: p.prompt,
          category: p.category || 'ranking',
        };
      }
    });

    // Create analysis data
    const analysisData: any = {
      companyName: companyInfo.name,
      description: businessDescription,
      topics: topics || [],
      competitors: finalCompetitors.map(c => c.name),
      competitorUrls: finalCompetitors.map(c => c.url).filter(u => u),
      prompts: normalizedPrompts,
      scrapedData: companyInfo.scrapedData,
      onboardingCompleted: true,
    };

    // Create brand analysis record
    const [newAnalysis] = await db.insert(brandAnalyses).values({
      userId: sessionResponse.user.id,
      url: websiteUrl,
      companyName: companyInfo.name,
      industry: companyInfo.industry || topics?.[0] || 'General',
      analysisData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log('[onboarding] Onboarding completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      analysisId: newAnalysis.id,
      company: companyInfo,
      competitors: finalCompetitors,
    });
  } catch (error) {
    console.error('[onboarding] Error:', error);
    return handleApiError(error);
  }
}

function extractCompanyName(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const parts = domain.split('.');
    
    // Capitalize first letter
    const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return name;
  } catch {
    return 'Company';
  }
}

