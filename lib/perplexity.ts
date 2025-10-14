import { CompanyInput } from '@/lib/types';
import { generateObject } from 'ai';
import { getProviderModel } from '@/lib/provider-config';
import { z } from 'zod';

// Maximum number of competitors to return (aligned with prompt requirement of 6-12)
export const MAX_COMPETITORS = 12;

export interface CompetitorWithType {
  name: string;
  type: 'direct' | 'regional' | 'international';
}

/**
 * Schema for competitor identification results.
 * 
 * Competitor types:
 * - direct: Same market and products (main competitors)
 * - regional: Same region but different products
 * - international: Similar products but different region
 */
const CompetitorSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().min(2).max(100),
    type: z.enum(['direct', 'regional', 'international']),
    reasoning: z.string().optional().describe('Brief explanation of why this is a competitor'),
  })).min(1),
});

// NOTE: OpenAI and Anthropic implementations removed as unused dead code
// TODO: Re-implement when multi-provider orchestration is added
// See function documentation for planned multi-provider architecture

const PERPLEXITY_PROMPT_TEMPLATE = (company: CompanyInput) => `Research and identify competitors of "${company.name}" using comprehensive web search.

Company Details:
- Website: ${company.url || 'Not provided'}
- Industry: ${company.industry || 'Technology'}
- Description: ${company.description || 'No description provided'}
${company.scrapedData?.keywords?.length ? `- Keywords: ${company.scrapedData.keywords.join(', ')}` : ''}
${company.scrapedData?.competitors?.length ? `- Known competitors: ${company.scrapedData.competitors.join(', ')}` : ''}

Competitor Classification:
- DIRECT: Same products/services, same market, directly compete for same customers
- REGIONAL: Same geographic region, similar target customers, may offer different products  
- INTERNATIONAL: Similar products/services but primarily operate in different regions/countries

Research Requirements:
1. Visit the company website to deeply understand their business model, products, and target market
2. Find 6-12 total competitors across all three types
3. Use current web data to verify all companies exist and are active
4. Include at least 4-6 direct competitors
5. Add 2-3 regional competitors if applicable
6. Add 2-3 international competitors if applicable
7. Exclude retailers, marketplaces, or aggregators unless the company itself is one

Return ONLY valid JSON matching this schema:
{
  "competitors": [
    { "name": "Company Name", "type": "direct", "reasoning": "Brief explanation" }
  ]
}`;

async function fetchWithPerplexity(company: CompanyInput): Promise<CompetitorWithType[]> {
  const modelName = 'Sonar Pro';
  console.log(`\n🤖 [Perplexity] Starting competitor research...`);
  console.log(`📊 [Perplexity] Model: ${modelName}`);
  console.log(`🔍 [Perplexity] API: Standard API (built-in web search)`);
  console.log(`🌐 [Perplexity] Company: ${company.name}`);
  console.log(`🔗 [Perplexity] Website: ${company.url || 'Not provided'}`);
  
  const model = getProviderModel('perplexity', 'sonar-pro');
  if (!model) {
    console.error(`❌ [Perplexity] API key not configured`);
    throw new Error('Perplexity is not configured');
  }

  try {
    const startTime = Date.now();
    
    const { object } = await generateObject({
      model,
      schema: CompetitorSchema,
      prompt: PERPLEXITY_PROMPT_TEMPLATE(company),
      temperature: 0.2,
      maxRetries: 2,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  [Perplexity] Request completed in ${duration}s`);

    const competitors = object.competitors.map(entry => ({
      name: entry.name.trim(),
      type: entry.type
    }));
    
    console.log(`✅ [Perplexity] Successfully found ${competitors.length} competitors`);
    console.log(`📋 [Perplexity] Types breakdown:`, {
      direct: competitors.filter(c => c.type === 'direct').length,
      regional: competitors.filter(c => c.type === 'regional').length,
      international: competitors.filter(c => c.type === 'international').length,
    });
    
    return competitors;
  } catch (error) {
    console.error(`❌ [Perplexity] Failed:`, error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Fetches competitors using web search capabilities.
 * 
 * CURRENT IMPLEMENTATION: Perplexity Sonar Pro only
 * - Uses Perplexity's built-in web search for real-time competitor research
 * - Returns up to MAX_COMPETITORS (12) competitors sorted by type priority
 * 
 * TODO: Multi-provider orchestration
 * - Implement parallel calls to OpenAI (GPT-5 + web_search_preview) and Anthropic (Claude 4 + web_search)
 * - Merge and deduplicate results from all providers
 * - Weight/rank results based on consensus across providers
 * - Consider implementing a voting or confidence scoring system
 * - Add fallback logic if primary provider fails
 */
export async function fetchCompetitorsWithWebSearch(company: CompanyInput): Promise<CompetitorWithType[]> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 STARTING COMPETITOR IDENTIFICATION PROCESS');
  console.log('='.repeat(80));
  console.log(`🏢 Target Company: ${company.name}`);
  console.log(`🌐 Website: ${company.url || 'Not provided'}`);
  console.log(`🏭 Industry: ${company.industry || 'Not specified'}`);
  console.log(`📝 Description: ${company.description ? company.description.substring(0, 100) + '...' : 'Not provided'}`);
  console.log('='.repeat(80));
  
  console.log(`\n🤖 Using AI Provider: Perplexity Sonar Pro (single-provider implementation)`);
  console.log(`🔍 Features: Built-in web search + real-time data`);
  console.log(`📝 Note: Multi-provider orchestration planned for future release`);

  const startTime = Date.now();
  let competitors: CompetitorWithType[] = [];

  try {
    // Call Perplexity Sonar Pro for competitor identification
    competitors = await fetchWithPerplexity(company);
    
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Perplexity: ${competitors.length} competitors found`);
    console.log(`⏱️  Total execution time: ${totalDuration}s`);
    console.log('='.repeat(80));

    if (competitors.length === 0) {
      console.warn('\n⚠️  WARNING: No competitors found');
      return [];
    }

    // Sort and limit to MAX_COMPETITORS, prioritizing direct > regional > international
    const typeOrder = { direct: 0, regional: 1, international: 2 };
    const sorted = competitors.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]).slice(0, MAX_COMPETITORS);
    
    console.log(`\n📋 Final list (top ${sorted.length}):`, {
      direct: sorted.filter(c => c.type === 'direct').length,
      regional: sorted.filter(c => c.type === 'regional').length,
      international: sorted.filter(c => c.type === 'international').length,
    });
    
    console.log(`\n🎯 FINAL RESULTS:`);
    sorted.forEach((comp, idx) => {
      const badge = comp.type === 'direct' ? '🔴' : comp.type === 'regional' ? '🔵' : '🟣';
      console.log(`   ${idx + 1}. ${badge} ${comp.name} (${comp.type})`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ COMPETITOR IDENTIFICATION COMPLETE');
    console.log('='.repeat(80) + '\n');
    
    return sorted;

  } catch (error) {
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.error(`\n${'='.repeat(80)}`);
    console.error('❌ COMPETITOR IDENTIFICATION FAILED');
    console.error('='.repeat(80));
    console.error(`Provider: Perplexity Sonar Pro`);
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`Duration: ${totalDuration}s`);
    console.error('='.repeat(80) + '\n');
    
    return [];
  }
}
