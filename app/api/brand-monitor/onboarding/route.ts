import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses } from '@/lib/db/schema';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { scrapeCompanyInfo } from '@/lib/scrape-utils';
import { fetchCompetitorsWithWebSearch } from '@/lib/perplexity';
import type { CompanyInput } from '@/lib/types';
import { 
  createAnalysisTrace, 
  updateTraceOutput, 
  flushLangfuse,
  addEvent,
  createSpan,
  completeSpan
} from '@/lib/langfuse-client';

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
  // Create Langfuse trace for onboarding workflow
  const trace = createAnalysisTrace('Onboarding Workflow', {
    brandName: 'unknown',
    useWebSearch: true,
    feature: 'onboarding',
  });

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
    
    if (trace) {
      addEvent(trace, 'onboarding_started', {
        websiteUrl,
        hasTopics: !!topics?.length,
        hasPrompts: !!prompts?.length,
        hasCompetitors: !!competitors?.length,
        userId: sessionResponse.user.id,
      });
    }

    // Step 1: Scrape company info using Firecrawl
    console.log('[onboarding] Step 1: Scraping company info with Firecrawl...');
    const scrapeSpan = createSpan(trace, 'scrape_company_info', { url: websiteUrl });
    let companyInfo;
    try {
      companyInfo = await scrapeCompanyInfo(websiteUrl);
      console.log(`[onboarding] Company scraped: ${companyInfo.name}`);
      completeSpan(scrapeSpan, { success: true, companyName: companyInfo.name });
    } catch (error) {
      console.error('[onboarding] Error scraping company:', error);
      completeSpan(scrapeSpan, { success: false, error: error instanceof Error ? error.message : String(error) });
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
      const competitorSpan = createSpan(trace, 'find_competitors', { companyName: companyInfo.name });
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
        completeSpan(competitorSpan, { success: true, count: finalCompetitors.length, competitors: finalCompetitors.map(c => c.name) });
      } catch (error) {
        console.error('[onboarding] Error finding competitors:', error);
        completeSpan(competitorSpan, { success: false, error: error instanceof Error ? error.message : String(error) });
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

    // Update trace with final results
    if (trace) {
      updateTraceOutput(trace, {
        success: true,
        analysisId: newAnalysis.id,
        companyName: companyInfo.name,
        competitorsCount: finalCompetitors.length,
        promptsCount: normalizedPrompts.length,
      }, {
        companyName: companyInfo.name,
        industry: companyInfo.industry,
        scraped: companyInfo.scraped,
      });
      
      await flushLangfuse();
      console.log('[Langfuse] Onboarding trace completed and flushed');
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      analysisId: newAnalysis.id,
      company: companyInfo,
      competitors: finalCompetitors,
    });
  } catch (error) {
    console.error('[onboarding] Error:', error);
    
    // Log error to trace
    if (trace) {
      addEvent(trace, 'onboarding_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      await flushLangfuse();
    }
    
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

