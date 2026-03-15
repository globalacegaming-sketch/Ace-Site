import { getApiBaseUrl } from '../utils/api';

interface TrackingEvent {
  userId?: string;
  sessionId: string;
  eventName: string;
  category: 'page' | 'click' | 'onboarding' | 'feature' | 'conversion' | 'error' | 'session';
  timestamp: number;
  pageUrl?: string;
  pagePath?: string;
  featureName?: string;
  elementId?: string;
  elementText?: string;
  properties?: Record<string, any>;
  device?: string;
  browser?: string;
  os?: string;
  referrer?: string;
  screenWidth?: number;
  screenHeight?: number;
  duration?: number;
  scrollDepth?: number;
}

const BATCH_INTERVAL = 5000;
const MAX_BATCH_SIZE = 30;
const RAGE_CLICK_THRESHOLD = 3;
const RAGE_CLICK_WINDOW = 800;

let eventQueue: TrackingEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let sessionId = '';
let currentUserId: string | undefined;
let pageEnteredAt = 0;
let currentPath = '';
let maxScrollDepth = 0;
let clickTimestamps: { t: number; x: number; y: number }[] = [];

function getSessionId(): string {
  if (sessionId) return sessionId;
  const stored = sessionStorage.getItem('_a_sid');
  if (stored) {
    sessionId = stored;
    return sessionId;
  }
  sessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  sessionStorage.setItem('_a_sid', sessionId);
  return sessionId;
}

function getDeviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Other';
}

function getOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Other';
}

function createBaseEvent(eventName: string, category: TrackingEvent['category']): TrackingEvent {
  return {
    userId: currentUserId,
    sessionId: getSessionId(),
    eventName,
    category,
    timestamp: Date.now(),
    pageUrl: window.location.href,
    pagePath: window.location.pathname,
    device: getDeviceType(),
    browser: getBrowser(),
    os: getOS(),
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    referrer: document.referrer || undefined,
  };
}

function enqueue(event: TrackingEvent) {
  eventQueue.push(event);
  if (eventQueue.length >= MAX_BATCH_SIZE) flush();
}

async function flush() {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
  try {
    const url = `${getApiBaseUrl()}/analytics/events`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Silent fail — analytics should never break the app
  }
}

// ── Public API ──────────────────────────────────────────────

export function initTracker(userId?: string) {
  currentUserId = userId;
  getSessionId();

  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(flush, BATCH_INTERVAL);

  trackPageView();
  setupClickTracking();
  setupScrollTracking();
  setupErrorTracking();
  setupVisibilityTracking();

  window.addEventListener('beforeunload', () => {
    recordTimeSpent();
    flush();
  });
}

export function setUserId(userId: string) {
  currentUserId = userId;
}

export function trackPageView(path?: string) {
  recordTimeSpent();
  maxScrollDepth = 0;
  currentPath = path || window.location.pathname;
  pageEnteredAt = Date.now();

  enqueue({ ...createBaseEvent('page_view', 'page'), pagePath: currentPath });
}

export function trackFeature(featureName: string, eventName = 'feature_used', properties?: Record<string, any>) {
  enqueue({ ...createBaseEvent(eventName, 'feature'), featureName, properties });
}

export function trackConversion(eventName: string, properties?: Record<string, any>) {
  enqueue({ ...createBaseEvent(eventName, 'conversion'), properties });
}

export function trackOnboarding(eventName: string, properties?: Record<string, any>) {
  enqueue({ ...createBaseEvent(eventName, 'onboarding'), properties });
}

export function trackClick(elementId: string, elementText: string, properties?: Record<string, any>) {
  enqueue({ ...createBaseEvent('button_clicked', 'click'), elementId, elementText, properties });
}

export function trackError(errorMessage: string, properties?: Record<string, any>) {
  enqueue({ ...createBaseEvent('error_shown', 'error'), properties: { ...properties, errorMessage } });
}

// ── Internal helpers ────────────────────────────────────────

function recordTimeSpent() {
  if (!pageEnteredAt || !currentPath) return;
  const duration = Math.round((Date.now() - pageEnteredAt) / 1000);
  if (duration > 0 && duration < 1800) {
    enqueue({
      ...createBaseEvent('time_spent_on_page', 'page'),
      pagePath: currentPath,
      duration,
    });
  }
  if (maxScrollDepth > 0) {
    enqueue({
      ...createBaseEvent('scroll_depth', 'page'),
      pagePath: currentPath,
      scrollDepth: maxScrollDepth,
    });
  }
  pageEnteredAt = 0;
}

function setupClickTracking() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Find the nearest interactive element
    const el =
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.closest('input[type="submit"]');

    if (el) {
      const text = (el.textContent || '').trim().substring(0, 80);
      const id = el.id || el.getAttribute('data-track') || el.className?.split?.(' ')[0] || '';
      enqueue({ ...createBaseEvent('button_clicked', 'click'), elementId: id, elementText: text });
    }

    // Rage click detection
    const now = Date.now();
    clickTimestamps.push({ t: now, x: e.clientX, y: e.clientY });
    clickTimestamps = clickTimestamps.filter((c) => now - c.t < RAGE_CLICK_WINDOW);
    if (clickTimestamps.length >= RAGE_CLICK_THRESHOLD) {
      const area = clickTimestamps.every(
        (c) => Math.abs(c.x - clickTimestamps[0].x) < 30 && Math.abs(c.y - clickTimestamps[0].y) < 30
      );
      if (area) {
        enqueue({
          ...createBaseEvent('rage_click_detected', 'error'),
          properties: { x: e.clientX, y: e.clientY, page: window.location.pathname },
        });
        clickTimestamps = [];
      }
    }
  }, { passive: true });
}

function setupScrollTracking() {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const depth = Math.round((scrollTop / docHeight) * 100);
        if (depth > maxScrollDepth) maxScrollDepth = depth;
      }
      ticking = false;
    });
  }, { passive: true });
}

function setupErrorTracking() {
  window.addEventListener('error', (e) => {
    enqueue({
      ...createBaseEvent('error_shown', 'error'),
      properties: { message: e.message, filename: e.filename, line: e.lineno },
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    enqueue({
      ...createBaseEvent('error_shown', 'error'),
      properties: { message: String(e.reason)?.substring(0, 200) },
    });
  });
}

function setupVisibilityTracking() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      recordTimeSpent();
      flush();
    } else {
      pageEnteredAt = Date.now();
    }
  });
}

export function destroyTracker() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flush();
}
