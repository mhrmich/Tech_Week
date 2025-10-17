/**
 * Event bus for DJ gesture events.
 * Simple pub/sub system with no external dependencies.
 */

import type { DJEvent } from './types';

type Listener = (event: DJEvent) => void;

// Internal set of all subscribers
const listeners = new Set<Listener>();

/**
 * Subscribe to all DJ events.
 *
 * @param fn - Callback function that receives events
 * @returns Unsubscribe function
 */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Emit a DJ event to all subscribers.
 *
 * @param event - The event to emit
 */
export function emit(event: DJEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('Error in event listener:', error);
    }
  });
}

/**
 * Subscribe to a specific event type only once.
 * Automatically unsubscribes after the first matching event.
 *
 * @param type - The event type to listen for
 * @param fn - Callback function
 * @returns Unsubscribe function (in case you want to cancel before it fires)
 */
export function once(type: DJEvent["type"], fn: Listener): () => void {
  const wrapper: Listener = (event) => {
    if (event.type === type) {
      fn(event);
      unsubscribe();
    }
  };
  const unsubscribe = subscribe(wrapper);
  return unsubscribe;
}

/**
 * Rate-limit a function to fire at most `hz` times per second.
 * Useful for continuous events like FILTER_SWEEP or SCRATCH_JOG.
 *
 * @param fn - Function to rate-limit
 * @param hz - Maximum calls per second (default: 15)
 * @returns Rate-limited version of the function
 */
export function rateLimit<T extends (...args: any[]) => void>(
  fn: T,
  hz: number = 15
): T {
  const minInterval = 1000 / hz;
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: any[]) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= minInterval) {
      lastCall = now;
      fn(...args);
    } else {
      // Schedule for later if not already scheduled
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          fn(...args);
          timeoutId = null;
        }, minInterval - timeSinceLastCall);
      }
    }
  }) as T;
}

// Debug hook for development builds
declare global {
  interface Window {
    __djbusDebug?: {
      emit: typeof emit;
    };
  }
}

if (import.meta.env.DEV) {
  window.__djbusDebug = { emit };
  console.log('🔧 DJ Bus debug mode enabled. Use window.__djbusDebug.emit({type:"PLAY"}) to test.');
}
