"use client";

import React, { createContext, useContext, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { GXOEvent, GXOEventType, GXOEventQueue } from "./events";

/**
 * GXO Instrumentation Context
 * Provides event tracking functionality throughout the app
 */

interface GXOContextValue {
  trackEvent: (event: Omit<GXOEvent, "timestamp" | "userId" | "sessionId">) => void;
  trackPageView: (path: string, title?: string) => void;
  trackButtonClick: (label: string, variant?: string, location?: string) => void;
  trackBrandAnalysis: (type: string, properties: Record<string, any>) => void;
  trackChatEvent: (type: string, properties: Record<string, any>) => void;
  trackConversion: (type: string, properties: Record<string, any>) => void;
}

const GXOContext = createContext<GXOContextValue | null>(null);

export function useGXO() {
  const context = useContext(GXOContext);
  if (!context) {
    throw new Error("useGXO must be used within GXOProvider");
  }
  return context;
}

interface GXOProviderProps {
  children: React.ReactNode;
  endpoint?: string;
}

export function GXOProvider({ children, endpoint = "/api/gxo/events" }: GXOProviderProps) {
  const { data: session } = useSession();
  const sessionIdRef = useRef<string>();
  const eventQueueRef = useRef<GXOEventQueue | null>(null);

  // Generate or retrieve session ID
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    let sessionId = sessionStorage.getItem("gxo_session_id");
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("gxo_session_id", sessionId);
    }
    sessionIdRef.current = sessionId;
  }, []);

  // Initialize event queue
  useEffect(() => {
    const onFlush = async (events: GXOEvent[]) => {
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ events }),
        });
      } catch (error) {
        console.error("Failed to send GXO events:", error);
      }
    };

    eventQueueRef.current = new GXOEventQueue(onFlush);

    return () => {
      eventQueueRef.current?.destroy();
    };
  }, [endpoint]);

  const trackEvent = useCallback(
    (event: Omit<GXOEvent, "timestamp" | "userId" | "sessionId">) => {
      if (!eventQueueRef.current) return;

      const fullEvent: GXOEvent = {
        ...event,
        timestamp: Date.now(),
        userId: session?.user?.id,
        sessionId: sessionIdRef.current,
      };

      eventQueueRef.current.push(fullEvent);
    },
    [session?.user?.id]
  );

  const trackPageView = useCallback(
    (path: string, title?: string) => {
      trackEvent({
        type: GXOEventType.PAGE_VIEW,
        page: path,
        properties: {
          path,
          title: title || document.title,
          referrer: document.referrer,
        },
      });
    },
    [trackEvent]
  );

  const trackButtonClick = useCallback(
    (label: string, variant?: string, location?: string) => {
      trackEvent({
        type: GXOEventType.BUTTON_CLICK,
        page: window.location.pathname,
        properties: {
          label,
          variant,
          location,
        },
      });
    },
    [trackEvent]
  );

  const trackBrandAnalysis = useCallback(
    (type: string, properties: Record<string, any>) => {
      trackEvent({
        type,
        page: window.location.pathname,
        properties,
      });
    },
    [trackEvent]
  );

  const trackChatEvent = useCallback(
    (type: string, properties: Record<string, any>) => {
      trackEvent({
        type,
        page: window.location.pathname,
        properties,
      });
    },
    [trackEvent]
  );

  const trackConversion = useCallback(
    (type: string, properties: Record<string, any>) => {
      trackEvent({
        type,
        page: window.location.pathname,
        properties,
      });
    },
    [trackEvent]
  );

  const value: GXOContextValue = {
    trackEvent,
    trackPageView,
    trackButtonClick,
    trackBrandAnalysis,
    trackChatEvent,
    trackConversion,
  };

  return <GXOContext.Provider value={value}>{children}</GXOContext.Provider>;
}

/**
 * Auto-track page views
 */
export function GXOPageViewTracker() {
  const pathname = usePathname();
  const { trackPageView } = useGXO();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname, trackPageView]);

  return null;
}

/**
 * HOC to track button clicks
 */
export function withGXOTracking<P extends { onClick?: (...args: any[]) => any }>(
  Component: React.ComponentType<P>,
  label: string,
  variant?: string
) {
  return function TrackedComponent(props: P) {
    const { trackButtonClick } = useGXO();

    const handleClick = useCallback(
      (...args: any[]) => {
        trackButtonClick(label, variant, window.location.pathname);
        props.onClick?.(...args);
      },
      [props]
    );

    return <Component {...props} onClick={handleClick} />;
  };
}

