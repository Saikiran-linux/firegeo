import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface BrandTopic {
  id: string;
  name: string;
  location?: string;
  createdAt: string;
  prompts: Array<{
    id: string;
    prompt: string;
    topicId: string;
  }>;
}

// POST /api/brand-monitor/generate-topics - Generate topics with AI
export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to generate topics');
    }

    const body = await request.json();
    const { companyName, companyUrl, count = 3, promptsPerTopic = 5 } = body;

    if (!companyName) {
      throw new ValidationError('Company name is required');
    }

    const systemPrompt = `You are a brand visibility analyst. Generate relevant topics and prompts for tracking a company's brand visibility across AI platforms.

Each topic should represent a specific use case or search scenario relevant to the company's business.
Each topic should have ${promptsPerTopic} diverse prompts that users might ask AI assistants.

CRITICAL: Generate prompts as GENERIC questions that real users would ask WITHOUT mentioning the specific company name.
The prompts should be natural questions where AI assistants might mention the company in their responses.

Examples of GOOD prompts (generic, no brand name):
- "What are the best CRM tools for small businesses?"
- "Which project management software has the best collaboration features?"
- "What are the top e-commerce platforms for startups in India?"

Examples of BAD prompts (include brand name):
- "What are the best features of Salesforce?"
- "How does Asana compare to other tools?"
- "Is Shopify good for Indian startups?"

Format your response as a valid JSON array of topics. Each topic should have:
- id: a unique identifier (use format "topic-TIMESTAMP-INDEX")
- name: a descriptive topic name
- location: optional location code (e.g., "IN", "US", "Global")
- prompts: array of ${promptsPerTopic} prompt objects, each with:
  - id: unique identifier (use format "prompt-TIMESTAMP-INDEX")
  - prompt: the actual question/prompt text (NO brand names!)
  - topicId: the parent topic id

Make prompts natural, diverse, and realistic - exactly like real user questions.`;

    const userPrompt = `Company: ${companyName}
${companyUrl ? `Website: ${companyUrl}` : ''}

Generate ${count} relevant topics with ${promptsPerTopic} prompts each for this company. Consider:
1. Their industry and target market
2. Common use cases and search scenarios
3. Geographic relevance
4. Competitor comparisons
5. Solution alternatives

IMPORTANT REMINDER: 
- Do NOT include "${companyName}" in any prompt text
- Generate generic questions that users would naturally ask
- The prompts should trigger AI responses that MIGHT mention ${companyName} among other options

Return ONLY a valid JSON array, no other text.`;

    console.log('[generate-topics] Calling Claude to generate topics...');

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      temperature: 0.8,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    // Extract JSON from response
    let jsonText = content.text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    let topics: BrandTopic[];
    try {
      topics = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[generate-topics] Failed to parse JSON:', jsonText.substring(0, 200));
      throw new Error('Failed to parse generated topics. Please try again.');
    }

    if (!Array.isArray(topics) || topics.length === 0) {
      throw new Error('No topics generated. Please try again.');
    }

    // Validate and enrich topics
    const now = Date.now();
    topics = topics.map((topic, topicIdx) => {
      const topicId = topic.id || `topic-${now}-${topicIdx}`;
      
      // Ensure prompts are properly formatted
      const prompts = (topic.prompts || []).map((prompt: any, promptIdx: number) => ({
        id: prompt.id || `prompt-${now}-${topicIdx}-${promptIdx}`,
        prompt: prompt.prompt || prompt,
        topicId: topicId,
      }));

      return {
        id: topicId,
        name: topic.name || `Topic ${topicIdx + 1}`,
        location: topic.location,
        createdAt: new Date().toISOString(),
        prompts,
      };
    });

    console.log(`[generate-topics] Successfully generated ${topics.length} topics with ${topics.reduce((sum, t) => sum + t.prompts.length, 0)} total prompts`);

    return NextResponse.json({
      message: `Generated ${topics.length} topics successfully`,
      topics,
    });
  } catch (error) {
    console.error('[generate-topics] Error:', error);
    return handleApiError(error);
  }
}

