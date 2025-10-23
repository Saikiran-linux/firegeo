import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';

interface BrandTopic {
  id: string;
  name: string;
  location?: string;
  createdAt?: string;
  prompts: any[];
}

// POST /api/brand-monitor/prompts/topics - Add new topics
export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to add topics');
    }

    const body = await request.json();
    const newTopics: BrandTopic[] = body.topics ? body.topics : (body.topic ? [body.topic] : []);

    if (!Array.isArray(newTopics) || newTopics.length === 0) {
      throw new ValidationError('Topics array is required and must not be empty');
    }

    // Validate each topic
    for (const topic of newTopics) {
      if (!topic.id || !topic.name) {
        throw new ValidationError('Each topic must have id and name');
      }
      if (!Array.isArray(topic.prompts)) {
        throw new ValidationError('Each topic must have a prompts array');
      }
    }

    // Get the latest analysis
    const analyses = await db.query.brandAnalyses.findMany({
      where: eq(brandAnalyses.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalyses.createdAt),
      limit: 1,
    });

    if (!analyses || analyses.length === 0) {
      throw new ValidationError('No analysis found. Please run an analysis first.');
    }

    const analysis = analyses[0];
    const currentAnalysisData = (analysis.analysisData as any) || {};
    const existingTopics = currentAnalysisData.topics || [];

    // Merge new topics with existing ones (avoid duplicates)
    const existingIds = new Set(existingTopics.map((t: any) => t.id));
    const topicsToAdd = newTopics.filter((t) => !existingIds.has(t.id));

    if (topicsToAdd.length === 0) {
      return NextResponse.json({
        message: 'All topics already exist',
        addedCount: 0,
        totalTopics: existingTopics.length,
      });
    }

    const updatedTopics = [...existingTopics, ...topicsToAdd];
    const updatedAnalysisData = {
      ...currentAnalysisData,
      topics: updatedTopics,
    };

    // Update the analysis
    await db
      .update(brandAnalyses)
      .set({
        analysisData: updatedAnalysisData,
        updatedAt: new Date(),
      })
      .where(eq(brandAnalyses.id, analysis.id));

    return NextResponse.json({
      message: 'Topics added successfully',
      addedCount: topicsToAdd.length,
      totalTopics: updatedTopics.length,
      topics: updatedTopics,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/brand-monitor/prompts/topics - Delete a specific topic
export async function DELETE(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to delete topics');
    }

    const body = await request.json();
    const topicId = body.topicId;

    if (!topicId) {
      throw new ValidationError('Topic ID is required');
    }

    // Get the latest analysis
    const analyses = await db.query.brandAnalyses.findMany({
      where: eq(brandAnalyses.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalyses.createdAt),
      limit: 1,
    });

    if (!analyses || analyses.length === 0) {
      throw new ValidationError('No analysis found');
    }

    const analysis = analyses[0];
    const currentAnalysisData = (analysis.analysisData as any) || {};
    const topics = currentAnalysisData.topics || [];

    // Filter out the topic to delete
    const updatedTopics = topics.filter((t: any) => t.id !== topicId);

    // Also remove any results for prompts in this topic
    const promptResults = currentAnalysisData.promptResults || [];
    const deletedPromptIds = new Set(
      topics.find((t: any) => t.id === topicId)?.prompts?.map((p: any) => p.id) || []
    );
    const updatedResults = promptResults.filter((r: any) => !deletedPromptIds.has(r.promptId));

    // Update the analysis
    const updatedAnalysisData = {
      ...currentAnalysisData,
      topics: updatedTopics,
      promptResults: updatedResults,
    };

    await db
      .update(brandAnalyses)
      .set({
        analysisData: updatedAnalysisData,
        updatedAt: new Date(),
      })
      .where(eq(brandAnalyses.id, analysis.id));

    return NextResponse.json({
      message: 'Topic deleted successfully',
      topicId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

