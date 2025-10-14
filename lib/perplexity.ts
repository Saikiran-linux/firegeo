import Anthropic from '@anthropic-ai/sdk';
import { CompanyInput } from '@/lib/types';
import { generateObject, generateText } from 'ai';
import { getProviderModel } from '@/lib/provider-config';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export interface CompetitorWithType {
  name: string;
  type: 'direct' | 'regional' | 'international';
}

const CompetitorSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().min(2).max(100),
    type: z.enum(['direct', 'regional', 'international']).describe('direct = same market/products, regional = same region different products, international = similar products different region'),
    reasoning: z.string().optional().describe('Brief explanation of why this is a competitor'),
  })).min(1),
});

const OPENAI_PROMPT_TEMPLATE = (company: CompanyInput) => `Research and identify competitors of "${company.name}" using web search.

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
3. Verify all companies actually exist and are currently active
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

async function fetchWithOpenAI(company: CompanyInput): Promise<CompetitorWithType[]> {
  const modelName = 'GPT-5';
  console.log(`\n🤖 [OpenAI] Starting competitor research...`);
  console.log(`📊 [OpenAI] Model: ${modelName}`);
  console.log(`🔍 [OpenAI] API: Responses API with web_search_preview tool`);
  console.log(`🌐 [OpenAI] Company: ${company.name}`);
  console.log(`🔗 [OpenAI] Website: ${company.url || 'Not provided'}`);

  try {
    const startTime = Date.now();
    
    // First get text with web search using GPT-5
    const { text } = await generateText({
      model: openai.responses('gpt-5'), // GPT-5 with Responses API for web search
      system: 'You are a business research assistant. Use web search to find accurate, up-to-date competitor information. Analyze companies deeply and classify competitors accurately. Return ONLY valid JSON matching the schema exactly, with no additional text.',
      prompt: OPENAI_PROMPT_TEMPLATE(company),
      tools: {
        web_search_preview: openai.tools.webSearchPreview({
          searchContextSize: 'high',
        }),
      },
      temperature: 0.2,
      maxRetries: 2,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  [OpenAI] Request completed in ${duration}s`);

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*"competitors"[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    let jsonStr = jsonMatch[0]
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .trim();
    
    if (!jsonStr.endsWith('}')) {
      jsonStr += '}';
    }

    const parsed = CompetitorSchema.parse(JSON.parse(jsonStr));
    const competitors = parsed.competitors.map(entry => ({
      name: entry.name.trim(),
      type: entry.type
    }));
    
    console.log(`✅ [OpenAI] Successfully found ${competitors.length} competitors`);
    console.log(`📋 [OpenAI] Types breakdown:`, {
      direct: competitors.filter(c => c.type === 'direct').length,
      regional: competitors.filter(c => c.type === 'regional').length,
      international: competitors.filter(c => c.type === 'international').length,
    });
    
    return competitors;
  } catch (error) {
    console.error(`❌ [OpenAI] Failed after request:`, error instanceof Error ? error.message : error);
    throw error;
  }
}

const ANTHROPIC_PROMPT_TEMPLATE = (company: CompanyInput) => `Research and identify competitors of "${company.name}" using web search.

Context:
- Website: ${company.url || 'Not provided'}
- Industry: ${company.industry || 'Technology'}
- Description: ${company.description || 'No description provided'}
${company.scrapedData?.keywords?.length ? `- Keywords: ${company.scrapedData.keywords.join(', ')}` : ''}
${company.scrapedData?.competitors?.length ? `- Known competitors: ${company.scrapedData.competitors.join(', ')}` : ''}

Competitor Classification:
- DIRECT: Same products/services, same market, directly compete for same customers
- REGIONAL: Same geographic region, similar target customers, may offer different products
- INTERNATIONAL: Similar products/services but primarily operate in different regions/countries

Requirements:
1. Visit the company website to deeply understand their business model, products, and target market
2. Find 6-12 total competitors across all three types
3. Verify all companies exist and are active via web search
4. Include at least 4-6 direct competitors
5. Add 2-3 regional competitors if applicable
6. Add 2-3 international competitors if applicable
7. Exclude retailers, marketplaces, or aggregators unless the company itself is one

Respond with JSON matching this schema exactly:
{
  "competitors": [
    { "name": "Company Name", "type": "direct", "reasoning": "Brief explanation" }
  ]
}`;

async function fetchWithAnthropic(company: CompanyInput): Promise<CompetitorWithType[]> {
  const modelName = 'Claude 4 Sonnet';
  console.log(`\n🤖 [Anthropic] Starting competitor research...`);
  console.log(`📊 [Anthropic] Model: ${modelName}`);
  console.log(`🔍 [Anthropic] API: Messages API with web_search tool`);
  console.log(`🌐 [Anthropic] Company: ${company.name}`);
  console.log(`🔗 [Anthropic] Website: ${company.url || 'Not provided'}`);
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`❌ [Anthropic] API key not configured`);
    throw new Error('Anthropic is not configured');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const startTime = Date.now();
    
    const message = await client.messages.create({
      model: 'claude-4-sonnet-20250514', // Claude 4 Sonnet with web search support
      max_tokens: 4096,
      system: 'You are a business research assistant with web search capabilities. Analyze companies deeply and classify competitors accurately. Return ONLY valid JSON matching the provided schema, with no additional text or formatting.',
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [
        {
          role: 'user',
          content: ANTHROPIC_PROMPT_TEMPLATE(company),
        },
      ],
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  [Anthropic] Request completed in ${duration}s`);

    const textContent = message.content
      .flatMap(block => (block.type === 'text' ? [block.text] : []))
      .join('\n');

    // Try to extract JSON more robustly - look for the complete object
    let jsonMatch = textContent.match(/\{[\s\S]*"competitors"[\s\S]*\]/);
    if (!jsonMatch) {
      // Fallback to simpler match
      jsonMatch = textContent.match(/\{[\s\S]*?\}/);
    }
    
    if (!jsonMatch) {
      console.error('[Anthropic] Response text:', textContent);
      throw new Error('Anthropic response did not contain valid JSON');
    }

    // Clean up the JSON string - remove trailing commas and fix common issues
    let jsonStr = jsonMatch[0]
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/\n/g, ' ') // Remove newlines
      .trim();
    
    // Ensure it ends with closing brace
    if (!jsonStr.endsWith('}')) {
      jsonStr += '}';
    }
    
    const jsonData = JSON.parse(jsonStr);
    const parsed = CompetitorSchema.parse(jsonData);
    
    const competitors = parsed.competitors.map(entry => ({
      name: entry.name.trim(),
      type: entry.type
    }));
    
    console.log(`✅ [Anthropic] Successfully found ${competitors.length} competitors`);
    console.log(`📋 [Anthropic] Types breakdown:`, {
      direct: competitors.filter(c => c.type === 'direct').length,
      regional: competitors.filter(c => c.type === 'regional').length,
      international: competitors.filter(c => c.type === 'international').length,
    });
    
    return competitors;
  } catch (error) {
    console.error(`❌ [Anthropic] Request or parsing failed:`, error instanceof Error ? error.message : error);
    throw error;
  }
}

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

export async function fetchCompetitorsWithWebSearch(company: CompanyInput): Promise<CompetitorWithType[]> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 STARTING COMPETITOR IDENTIFICATION PROCESS');
  console.log('='.repeat(80));
  console.log(`🏢 Target Company: ${company.name}`);
  console.log(`🌐 Website: ${company.url || 'Not provided'}`);
  console.log(`🏭 Industry: ${company.industry || 'Not specified'}`);
  console.log(`📝 Description: ${company.description ? company.description.substring(0, 100) + '...' : 'Not provided'}`);
  console.log('='.repeat(80));
  
  console.log(`\n🤖 Using AI Provider: Perplexity Sonar Pro`);
  console.log(`🔍 Features: Built-in web search + real-time data`);

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

    // Sort and limit to top 15, prioritizing direct > regional > international
    const typeOrder = { direct: 0, regional: 1, international: 2 };
    const sorted = competitors.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]).slice(0, 15);
    
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
