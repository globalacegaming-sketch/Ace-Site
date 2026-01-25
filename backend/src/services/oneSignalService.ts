/**
 * Sends push notifications via OneSignal REST API.
 * Used when an admin sends a support message so the user gets a push
 * when they're inactive or logged out.
 */

const ONESIGNAL_URL = 'https://api.onesignal.com/notifications';
const APP_ID = process.env.ONESIGNAL_APP_ID || '85f288b7-130d-4334-9a01-304bd9070551';
const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

export interface SendChatPushOptions {
  userId: string;
  /** Plain text preview; will be truncated. Use "Support sent an attachment" if no text. */
  body: string;
  /** Optional. Site base URL to open /chat when the user taps the notification. */
  webUrl?: string;
}

/**
 * Send a push for a new support message. No-op if ONESIGNAL_REST_API_KEY is not set.
 * Targets the user via external_id (set by OneSignal.login(userId) in the frontend).
 */
export async function sendChatMessagePush(options: SendChatPushOptions): Promise<void> {
  if (!REST_API_KEY || REST_API_KEY.length < 10) {
    return;
  }

  const { userId, body, webUrl } = options;
  const text = (body || 'Support sent an attachment').slice(0, 120);

  const payload = {
    app_id: APP_ID,
    target_channel: 'push' as const,
    include_aliases: { external_id: [userId] },
    contents: { en: text },
    headings: { en: 'New message from Support' },
    ...(webUrl ? { web_url: webUrl.endsWith('/') ? `${webUrl}chat` : `${webUrl}/chat` } : {}),
    // Prefer web only if we only have web subscribers; otherwise OneSignal will route to any subscription
    isAnyWeb: true,
    isIos: true,
    isAndroid: true,
  };

  try {
    const res = await fetch(`${ONESIGNAL_URL}?c=push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text();
      console.warn('[OneSignal] push failed:', res.status, t);
    }
  } catch (e) {
    console.warn('[OneSignal] push request error:', e);
  }
}
