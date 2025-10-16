import { z } from "zod";

/**
 * GXO Event Types
 * Track user interactions and conversion events for optimization
 */

export const GXOEventType = {
  // UI Interactions
  PAGE_VIEW: "page_view",
  BUTTON_CLICK: "button_click",
  FORM_SUBMIT: "form_submit",
  LINK_CLICK: "link_click",
  
  // Brand Monitor Events
  BRAND_ANALYSIS_START: "brand_analysis_start",
  BRAND_ANALYSIS_COMPLETE: "brand_analysis_complete",
  BRAND_ANALYSIS_ERROR: "brand_analysis_error",
  PROMPT_GENERATED: "prompt_generated",
  COMPETITOR_ADDED: "competitor_added",
  
  // Chat Events
  CHAT_MESSAGE_SENT: "chat_message_sent",
  CHAT_MESSAGE_RECEIVED: "chat_message_received",
  CHAT_FEEDBACK: "chat_feedback",
  
  // Conversion Events
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  PLAN_VIEWED: "plan_viewed",
  PLAN_SELECTED: "plan_selected",
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_COMPLETED: "subscription_completed",
  
  // Engagement Events
  FEATURE_DISCOVERED: "feature_discovered",
  TOOLTIP_VIEWED: "tooltip_viewed",
  HELP_ACCESSED: "help_accessed",
} as const;

export type GXOEventType = (typeof GXOEventType)[keyof typeof GXOEventType];

// Event Schemas
export const BaseEventSchema = z.object({
  type: z.string(),
  timestamp: z.number(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  page: z.string().optional(),
  properties: z.record(z.any()).optional(),
});

export const PageViewEventSchema = BaseEventSchema.extend({
  type: z.literal(GXOEventType.PAGE_VIEW),
  properties: z.object({
    path: z.string(),
    title: z.string().optional(),
    referrer: z.string().optional(),
  }),
});

export const ButtonClickEventSchema = BaseEventSchema.extend({
  type: z.literal(GXOEventType.BUTTON_CLICK),
  properties: z.object({
    label: z.string(),
    variant: z.string().optional(),
    location: z.string().optional(),
  }),
});

export const BrandAnalysisEventSchema = BaseEventSchema.extend({
  type: z.enum([
    GXOEventType.BRAND_ANALYSIS_START,
    GXOEventType.BRAND_ANALYSIS_COMPLETE,
    GXOEventType.BRAND_ANALYSIS_ERROR,
  ]),
  properties: z.object({
    brandUrl: z.string().optional(),
    promptsCount: z.number().optional(),
    competitorsCount: z.number().optional(),
    providersUsed: z.array(z.string()).optional(),
    duration: z.number().optional(),
    errorMessage: z.string().optional(),
  }),
});

export const ChatEventSchema = BaseEventSchema.extend({
  type: z.enum([
    GXOEventType.CHAT_MESSAGE_SENT,
    GXOEventType.CHAT_MESSAGE_RECEIVED,
    GXOEventType.CHAT_FEEDBACK,
  ]),
  properties: z.object({
    conversationId: z.string().optional(),
    messageLength: z.number().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    feedbackType: z.enum(["positive", "negative"]).optional(),
    responseTime: z.number().optional(),
  }),
});

export const ConversionEventSchema = BaseEventSchema.extend({
  type: z.enum([
    GXOEventType.SIGNUP_STARTED,
    GXOEventType.SIGNUP_COMPLETED,
    GXOEventType.PLAN_VIEWED,
    GXOEventType.PLAN_SELECTED,
    GXOEventType.SUBSCRIPTION_STARTED,
    GXOEventType.SUBSCRIPTION_COMPLETED,
  ]),
  properties: z.object({
    plan: z.string().optional(),
    planPrice: z.number().optional(),
    source: z.string().optional(),
    variant: z.string().optional(),
  }),
});

export type GXOEvent = z.infer<typeof BaseEventSchema>;
export type PageViewEvent = z.infer<typeof PageViewEventSchema>;
export type ButtonClickEvent = z.infer<typeof ButtonClickEventSchema>;
export type BrandAnalysisEvent = z.infer<typeof BrandAnalysisEventSchema>;
export type ChatEvent = z.infer<typeof ChatEventSchema>;
export type ConversionEvent = z.infer<typeof ConversionEventSchema>;

/**
 * Event Queue for batching
 */
export class GXOEventQueue {
  private events: GXOEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 10;
  private readonly flushIntervalMs = 5000; // 5 seconds

  constructor(private onFlush: (events: GXOEvent[]) => Promise<void>) {
    this.startAutoFlush();
  }

  push(event: GXOEvent) {
    this.events.push(event);
    if (this.events.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.events.length === 0) return;
    
    const eventsToFlush = [...this.events];
    this.events = [];
    
    try {
      await this.onFlush(eventsToFlush);
    } catch (error) {
      console.error("Failed to flush GXO events:", error);
      // Re-add failed events to queue
      this.events.unshift(...eventsToFlush);
    }
  }

  private startAutoFlush() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush(); // Final flush
  }
}

