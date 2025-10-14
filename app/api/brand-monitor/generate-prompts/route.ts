import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generatePromptsForCompany } from '@/lib/ai-utils';
import { Company } from '@/lib/types';

// Define Zod schema for runtime validation
const RequestBodySchema = z.object({
  company: z.object({
    id: z.string(),
    name: z.string().min(1, 'Company name is required'),
    url: z.string().url('Valid URL is required'),
    description: z.string().optional(),
    industry: z.string().optional(),
    logo: z.string().optional(),
    favicon: z.string().optional(),
    scraped: z.boolean().optional(),
    scrapedData: z.object({
      title: z.string(),
      description: z.string(),
      keywords: z.array(z.string()),
      mainContent: z.string(),
      mainProducts: z.array(z.string()).optional(),
      competitors: z.array(z.string()).optional(),
      ogImage: z.string().optional(),
      favicon: z.string().optional(),
    }).optional(),
  }),
  competitors: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Early validation: ensure company is a valid object with required properties
    if (
      typeof body.company !== 'object' || 
      body.company === null || 
      typeof body.company.name !== 'string' || 
      body.company.name.trim().length === 0
    ) {
      return NextResponse.json(
        { 
          error: 'Invalid company object',
          details: 'Company must be an object with a non-empty name property'
        },
        { status: 400 }
      );
    }
    
    // Validate request body with Zod
    const validationResult = RequestBodySchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    // Extract validated data with safe defaults
    const { company, competitors = [] } = validationResult.data;

    console.log('\n' + '═'.repeat(100));
    console.log('🎯 API ENDPOINT: /api/brand-monitor/generate-prompts');
    console.log('═'.repeat(100));
    console.log(`📥 Company: ${company.name}`);
    console.log(`🔗 Website: ${company.url || 'Not provided'}`);
    console.log(`👥 Competitors: ${competitors.length} provided`);
    
    const startTime = Date.now();
    console.log('\n🤖 Generating AI-powered prompts...');

    // Generate prompts using AI
    const prompts = await generatePromptsForCompany(company, competitors);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Generated ${prompts.length} prompts in ${duration}s`);
    console.log('═'.repeat(100) + '\n');

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('Error generating prompts:', error);
    return NextResponse.json(
      { error: 'Failed to generate prompts', details: 'Internal server error' },
      { status: 500 }
    );
  }
}


