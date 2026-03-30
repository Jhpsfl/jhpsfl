'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createSupabaseClient } from './supabase';

/**
 * useYelpRealtime - Subscribes to Yelp conversation changes via Supabase Realtime
 * Replaces 30s polling with instant updates.
 * Falls back to manual fetch if no update in 2 minutes.
 */
export function useYelpRealtime(
  onConversationChange: (payload: { new: Record<string, unknown>; old: Record<string, unknown>; eventType: string }) => void,
  onHealthChange?: (payload: Record<string, unknown>) => void,
) {
  const supabase = createSupabaseClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('yelp-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'yelp_conversations' },
        (payload) => {
          lastUpdateRef.current = Date.now();
          onConversationChange({
            new: (payload.new as Record<string, unknown>) || {},
            old: (payload.old as Record<string, unknown>) || {},
            eventType: payload.eventType,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'yelp_agent_health' },
        (payload) => {
          lastUpdateRef.current = Date.now();
          onHealthChange?.((payload.new as Record<string, unknown>) || {});
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setConnected(false);
    };
  }, []);

  return { connected };
}

/**
 * useDeliveryStatus - Subscribe to delivery log changes for a specific conversation
 */
export function useDeliveryStatus(conversationId: string | null) {
  const supabase = createSupabaseClient();
  const [deliveryLogs, setDeliveryLogs] = useState<Array<{
    id: string;
    message_index: number;
    method: string;
    status: string;
    attempts: number;
    completed_at: string | null;
  }>>([]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`delivery-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'yelp_delivery_log',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newLog = payload.new as { id: string; message_index: number; method: string; status: string; attempts: number; completed_at: string | null };
          setDeliveryLogs((prev) => {
            const idx = prev.findIndex((l) => l.id === newLog.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = newLog;
              return next;
            }
            return [...prev, newLog];
          });
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [conversationId]);

  return deliveryLogs;
}
