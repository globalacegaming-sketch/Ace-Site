/**
 * Sends push notifications via OneSignal REST API.
 * Targets users by external_id (OneSignal.login(userId) on the client).
 */

const ONESIGNAL_URL = 'https://api.onesignal.com/notifications';
const APP_ID = process.env.ONESIGNAL_APP_ID || '85f288b7-130d-4334-9a01-304bd9070551';
const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

export interface SendChatPushOptions {
  userId: string;
  /** Plain text preview; will be truncated. */
  body: string;
  /** Site base URL — opens /chat when the notification is tapped. */
  webUrl?: string;
}

function buildChatUrl(webUrl?: string): string | undefined {
  if (!webUrl) return undefined;
  const base = webUrl.replace(/\/$/, '');
  return `${base}/chat`;
}

/**
 * Send a push for a new support message. No-op if ONESIGNAL_REST_API_KEY is not set.
 */
export async function sendChatMessagePush(options: SendChatPushOptions): Promise<void> {
  if (!REST_API_KEY || REST_API_KEY.length < 10) {
    console.warn('[OneSignal] ONESIGNAL_REST_API_KEY not configured — push skipped');
    return;
  }

  const userId = String(options.userId).trim();
  const text = (options.body || 'Support sent an attachment').slice(0, 120);
  const chatUrl = buildChatUrl(options.webUrl);

  const payload: Record<string, unknown> = {
    app_id: APP_ID,
    target_channel: 'push',
    include_aliases: { external_id: [userId] },
    contents: { en: text },
    headings: { en: 'New message from Support' },
  };

  if (chatUrl) {
    payload.web_url = chatUrl;
    payload.app_url = chatUrl;
  }

  try {
    const res = await fetch(`${ONESIGNAL_URL}?c=push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.warn('[OneSignal] push failed:', res.status, raw);
      return;
    }

    try {
      const data = JSON.parse(raw) as { id?: string; errors?: unknown };
      if (data.errors) {
        console.warn('[OneSignal] push API errors for user', userId, data.errors);
      } else if (data.id) {
        console.info('[OneSignal] push queued:', data.id, 'user:', userId);
      }
    } catch {
      console.info('[OneSignal] push sent for user:', userId);
    }
  } catch (e) {
    console.warn('[OneSignal] push request error:', e);
  }
}
