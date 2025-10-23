import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import Anthropic from '@anthropic-ai/sdk';
import { randomBytes } from 'crypto';

// Validate Anthropic API key at initialization
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  throw new Error(
    'ANTHROPIC_API_KEY environment variable is not set. Please configure it in your .env file.'
  );
}

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// Generate collision-safe random ID
function generatePromptId(): string {
  return `prompt-${randomBytes(8).toString('hex')}`;
}

// Helper to sanitize user input for use in AI prompts
function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .trim()
    // Remove or escape backticks to prevent prompt injection
    .replace(/`/g, "'")
    // Remove or escape control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize quotes to prevent breaking prompt structure
    .replace(/["]/g, "'")
    // Limit length to prevent extremely long inputs
    .slice(0, 2000);
}

interface GeneratePromptsRequest {
  companyName: string;
  companyUrl?: string;
  industry?: string; // Legacy field - kept for backward compatibility
  businessContext?: string; // Full business description for better context
  count?: number;
  category?: 'ranking' | 'comparison' | 'alternatives' | 'recommendations';
}

export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to generate prompts');
    }

    const body: GeneratePromptsRequest = await request.json();
    
    if (!body.companyName) {
      throw new ValidationError('Company name is required');
    }

    // Sanitize all user inputs to prevent prompt injection
    const sanitizedCompanyName = sanitizeInput(body.companyName);
    const sanitizedCompanyUrl = body.companyUrl ? sanitizeInput(body.companyUrl) : '';
    const sanitizedBusinessContext = body.businessContext ? sanitizeInput(body.businessContext) : '';
    const sanitizedIndustry = body.industry ? sanitizeInput(body.industry) : '';
    
    // Validate sanitized company name is not empty after sanitization
    if (!sanitizedCompanyName) {
      throw new ValidationError('Invalid company name');
    }

    const count = body.count || 10;
    const category = body.category;

    // Build the prompt for Claude
    const systemPrompt = `You are an expert in AI-powered brand monitoring and SEO. Your task is to generate natural, realistic search queries that users might ask AI assistants (like ChatGPT, Claude, Perplexity, Gemini) when looking for solutions in a specific industry.

CRITICAL: Generate prompts as GENERIC questions WITHOUT mentioning any specific company or brand names. These should be questions that real users naturally ask, where AI assistants might then mention various brands in their responses.`;

    let categoryInstruction = '';
    if (category === 'ranking') {
      categoryInstruction = 'Focus on ranking/top list questions like "What are the best...", "Top 10...", "Best platforms for..."';
    } else if (category === 'comparison') {
      categoryInstruction = 'Focus on direct comparison questions like "Compare X vs Y", "X versus Y", "Difference between..."';
    } else if (category === 'alternatives') {
      categoryInstruction = 'Focus on alternative-seeking questions like "Alternatives to...", "Similar to...", "Better than..."';
    } else if (category === 'recommendations') {
      categoryInstruction = 'Focus on recommendation questions like "Which platform do you recommend...", "What should I use for...", "Best choice for..."';
    } else {
      // For mixed categories, ensure balanced distribution
      const promptsPerCategory = Math.ceil(count / 4);
      categoryInstruction = `Generate a BALANCED mix of different question types. Distribute prompts as follows:
- ${promptsPerCategory} ranking questions (e.g., "What are the best...", "Top 10...")
- ${promptsPerCategory} comparison questions (e.g., "Compare X vs Y", "Difference between...")
- ${promptsPerCategory} alternatives questions (e.g., "Alternatives to...", "Similar to...")
- ${promptsPerCategory} recommendation questions (e.g., "Which should I choose...", "What do you recommend...")

IMPORTANT: You MUST categorize each prompt correctly with one of these exact categories: "ranking", "comparison", "alternatives", or "recommendations"`;
    }

    // Use sanitized businessContext if provided, otherwise fall back to sanitized industry
    const contextInfo = sanitizedBusinessContext || sanitizedIndustry;
    
    const userPrompt = `Generate ${count} natural search prompts that users might ask AI assistants about solutions in the industry where "${sanitizedCompanyName}" operates.

Company: ${sanitizedCompanyName}
${sanitizedCompanyUrl ? `URL: ${sanitizedCompanyUrl}` : ''}
${contextInfo ? `Business Context: ${contextInfo}` : ''}

${categoryInstruction}

Requirements:
1. Make questions natural and conversational, as real users would ask
2. Cover different aspects: features, use cases, pricing, comparisons, etc.
3. DO NOT include "${sanitizedCompanyName}" or any specific brand names in the prompts
4. Generate GENERIC questions where AI responses might naturally mention ${sanitizedCompanyName} or its competitors
5. Vary question complexity and length
6. CRITICAL: Each prompt MUST have a "category" field with one of these exact values: "ranking", "comparison", "alternatives", or "recommendations"

Example GOOD prompts (generic, industry-focused):
- "What are the best project management tools for remote teams?"
- "Which CRM software has the most integrations?"
- "Top accounting software for small businesses in 2024"

Example BAD prompts (include brand names):
- "What are the features of ${sanitizedCompanyName}?"
- "How does ${sanitizedCompanyName} compare to competitors?"
- "Is ${sanitizedCompanyName} worth the price?"

Return ONLY a JSON array of objects with this EXACT structure:
[
  {
    "id": "prompt-1",
    "prompt": "the question text",
    "category": "ranking"
  },
  {
    "id": "prompt-2",
    "prompt": "the question text",
    "category": "comparison"
  }
]

Do not include any other text, just the JSON array. Ensure EVERY prompt has a valid category field.`;

    // Configure timeout for Claude API call to prevent hanging
    const CLAUDE_TIMEOUT_MS = 30000; // 30 seconds

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Claude API request timed out')), CLAUDE_TIMEOUT_MS)
    );

    const message = await Promise.race([
      anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        system: systemPrompt,
      }),
      timeoutPromise,
    ]) as Anthropic.Messages.Message;

    // Parse the response
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from the response
    let jsonText = content.text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const prompts = JSON.parse(jsonText);

    // Validate the structure
    if (!Array.isArray(prompts)) {
      console.error('[generate-prompts] Claude returned non-array response:', typeof prompts);
      throw new ValidationError('Claude API returned invalid format: expected array of prompts');
    }

    if (prompts.length === 0) {
      console.error('[generate-prompts] Claude returned empty array');
      throw new ValidationError('Claude API returned no prompts');
    }

    // Strict validation: enforce contract and fail fast on invalid items
    const validCategories = ['ranking', 'comparison', 'alternatives', 'recommendations'];
    const validatedPrompts: Array<{id: string; prompt: string; category: 'ranking' | 'comparison' | 'alternatives' | 'recommendations'}> = [];
    const invalidItems: Array<{index: number; reason: string; item: any}> = [];

    prompts.forEach((p: any, index: number) => {
      // STRICT: Require p.prompt field (no p.question fallback)
      if (!p.prompt || typeof p.prompt !== 'string') {
        invalidItems.push({
          index,
          reason: 'Missing or invalid "prompt" field',
          item: p,
        });
        return;
      }

      const promptText = p.prompt.trim();
      if (!promptText) {
        invalidItems.push({
          index,
          reason: 'Empty prompt text',
          item: p,
        });
        return;
      }

      // STRICT: Require valid category field (minimal fallback only)
      let category = p.category?.toLowerCase();
      if (!category || !validCategories.includes(category)) {
        // Minimal deterministic fallback: default to 'ranking'
        // This prevents silent failures but still surfaces the issue in logs
        console.warn(`[generate-prompts] Item ${index} has invalid category "${p.category}", defaulting to "ranking":`, {
          prompt: promptText.substring(0, 100),
          providedCategory: p.category,
        });
        category = 'ranking';
      }

      validatedPrompts.push({
        id: p.id || generatePromptId(), // Use collision-safe ID generator
        prompt: promptText,
        category: category as 'ranking' | 'comparison' | 'alternatives' | 'recommendations',
      });
    });

    // Log validation issues for debugging
    if (invalidItems.length > 0) {
      console.error(`[generate-prompts] Claude returned ${invalidItems.length} invalid items:`, invalidItems);
    }

    // Fail fast if too many items are invalid
    if (validatedPrompts.length === 0) {
      throw new ValidationError('Claude API returned no valid prompts - all items failed validation');
    }

    // Warn if significant portion of prompts were invalid
    if (invalidItems.length > prompts.length * 0.3) {
      console.warn(`[generate-prompts] High failure rate: ${invalidItems.length}/${prompts.length} items invalid`);
    }
    
    console.log('[generate-prompts] Category distribution:', {
      ranking: validatedPrompts.filter(p => p.category === 'ranking').length,
      comparison: validatedPrompts.filter(p => p.category === 'comparison').length,
      alternatives: validatedPrompts.filter(p => p.category === 'alternatives').length,
      recommendations: validatedPrompts.filter(p => p.category === 'recommendations').length,
    });

    return NextResponse.json({
      prompts: validatedPrompts,
      count: validatedPrompts.length,
    });
  } catch (error) {
    console.error('Error generating prompts:', error);
    return handleApiError(error);
  }
}
