import { NextRequest, NextResponse } from 'next/server';
import { generatePromptsForCompany } from '@/lib/ai-utils';
import { Company } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company, competitors } = body as { company: Company; competitors: string[] };

    if (!company) {
      return NextResponse.json(
        { error: 'Company data is required' },
        { status: 400 }
      );
    }

    console.log('Generating prompts for:', company.name, 'with competitors:', competitors);

    // Generate prompts using AI
    const prompts = await generatePromptsForCompany(company, competitors || []);

    console.log('Generated', prompts.length, 'prompts');

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('Error generating prompts:', error);
    return NextResponse.json(
      { error: 'Failed to generate prompts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


