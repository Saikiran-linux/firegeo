import Anthropic from '@anthropic-ai/sdk';
import { CompanyInput } from '@/lib/types';
import { generateObject } from 'ai';
import { getProviderModel } from '@/lib/provider-config';
import { z } from 'zod';

const CompetitorSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().min(2).max(100),
  })).min(1),
});

const OPENAI_PROMPT_TEMPLATE = (company: CompanyInput) => `Identify 6-9 direct competitors of "${company.name}".

Company Details:
- Industry: ${company.industry || 'Technology'}
- Description: ${company.description || 'No description provided'}
${company.scrapedData?.keywords?.length ? `- Keywords: ${company.scrapedData.keywords.join(', ')}` : ''}
${company.scrapedData?.competitors?.length ? `- Known competitors: ${company.scrapedData.competitors.join(', ')}` : ''}

Research Requirements:
1. Only include companies offering the same or very similar products/services.
2. They must target the same customer segment and business model.
3. Verify they are currently active.
4. Exclude retailers, marketplaces, or aggregators unless this brand is one.

Return ONLY valid JSON matching this schema:
{
  "competitors": [
    { "name": "Company" }
  ]
}`;

async function fetchWithOpenAI(company: CompanyInput): Promise<string[]> {
  const model = getProviderModel('openai', 'gpt-4o-mini', { useWebSearch: true });
  if (!model) {
    throw new Error('OpenAI is not configured');
  }

  const { object } = await generateObject({
    model,
    schema: CompetitorSchema,
    system: 'You research brands using web search. Return JSON matching the provided schema exactly.',
    prompt: OPENAI_PROMPT_TEMPLATE(company),
    temperature: 0.2,
    maxRetries: 2,
  });

  return Array.from(new Set(object.competitors.map(entry => entry.name.trim()))).slice(0, 9);
}

const ANTHROPIC_PROMPT_TEMPLATE = (company: CompanyInput) => `Research the brand "${company.name}" and return 6-9 direct competitors.

Context:
- Industry: ${company.industry || 'Technology'}
- Description: ${company.description || 'No description provided'}
${company.scrapedData?.keywords?.length ? `- Keywords: ${company.scrapedData.keywords.join(', ')}` : ''}
${company.scrapedData?.competitors?.length ? `- Known competitors: ${company.scrapedData.competitors.join(', ')}` : ''}

Requirements:
- Competitors must sell the same or very similar products/services.
- They should target the same customer segment and business model.
- Verify via web search that they are active companies, not marketplaces or resellers.

Respond with JSON matching this schema exactly:
{
  "competitors": [
    { "name": "Company" }
  ]
}`;

async function fetchWithAnthropic(company: CompanyInput): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic is not configured');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: 'You are a research assistant that must return strict JSON matching the provided schema.',
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    messages: [
      {
        role: 'user',
        content: ANTHROPIC_PROMPT_TEMPLATE(company),
      },
    ],
  });

  const textContent = message.content
    .flatMap(block => (block.type === 'text' ? [block.text] : []))
    .join('\n');

  const jsonMatch = textContent.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error('Anthropic response did not contain JSON');
  }

  let parsed: z.infer<typeof CompetitorSchema>;
  try {
    parsed = CompetitorSchema.parse(JSON.parse(jsonMatch[0]));
  } catch (error) {
    throw new Error(`Anthropic JSON parsing failed: ${(error as Error).message}`);
  }

  return Array.from(new Set(parsed.competitors.map(entry => entry.name.trim()))).slice(0, 9);
}

export async function fetchCompetitorsWithWebSearch(company: CompanyInput): Promise<string[]> {
  const strategies: Array<(company: CompanyInput) => Promise<string[]>> = [fetchWithOpenAI, fetchWithAnthropic];
  const errors: unknown[] = [];

  for (const strategy of strategies) {
    try {
      const competitors = await strategy(company);
      if (competitors.length >= 3) {
        return competitors;
      }
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length) {
    console.warn('[fetchCompetitorsWithWebSearch] All provider attempts failed', errors);
  }

  return [];
}
