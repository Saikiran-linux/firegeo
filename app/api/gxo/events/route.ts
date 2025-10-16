import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BaseEventSchema } from "@/lib/gxo/events";

const EventsBatchSchema = z.object({
  events: z.array(BaseEventSchema),
});

/**
 * GXO Events API Endpoint
 * Receives and processes batched events from the client
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { events } = EventsBatchSchema.parse(body);

    // TODO: Store events in your analytics database
    // For now, we'll just log them
    console.log(`[GXO] Received ${events.length} events:`, events);

    // In production, you would:
    // 1. Validate events
    // 2. Store in analytics database (e.g., PostgreSQL, BigQuery, etc.)
    // 3. Send to analytics platforms (e.g., Mixpanel, Amplitude, etc.)
    // 4. Process for real-time dashboards

    return NextResponse.json({
      success: true,
      processed: events.length,
    });
  } catch (error) {
    console.error("[GXO] Failed to process events:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid event data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process events" },
      { status: 500 }
    );
  }
}

