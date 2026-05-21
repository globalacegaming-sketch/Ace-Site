/**
 * OneSignal push notification integration.
 * - login: links device subscription to user id (external_id for backend pushes)
 * - ensurePushSetup: login + opt-in when permission already granted
 * - requestPermission: contextual browser / slidedown prompt
 */

interface OneSignalSDK {
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  Notifications?: {
    requestPermission: () => void | Promise<boolean>;
    isPushSupported?: () => boolean;
    permission?: boolean;
  };
  User?: { PushSubscription?: { optIn: () => Promise<void>; optedIn?: boolean } };
  Slidedown?: { promptPush: (opts?: { force?: boolean }) => void };
}

declare global {
  interface Window {
    OneSignal?: OneSignalSDK;
    OneSignalDeferred?: Array<(OneSignal: OneSignalSDK) => void | Promise<void>>;
  }
}

function whenReady(fn: (sdk: OneSignalSDK) => void | Promise<void>): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(fn);
}

function runWhenReady<T>(fn: (sdk: OneSignalSDK) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve) => {
    whenReady(async (sdk) => {
      try {
        resolve(await fn(sdk));
      } catch {
        resolve(undefined as T);
      }
    });
  });
}

/**
 * Link the current device to the user. Call after login.
 */
export async function oneSignalLogin(userId: string): Promise<void> {
  const id = String(userId).trim();
  if (!id) return;
  await runWhenReady(async (OneSignal) => {
    await OneSignal.login(id);
  });
}

/**
 * Unlink device on logout.
 */
export async function oneSignalLogout(): Promise<void> {
  await runWhenReady(async (OneSignal) => {
    await OneSignal.logout();
  });
}

/**
 * If the user already allowed notifications, register subscription without re-prompting.
 */
export async function oneSignalOptInIfGranted(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  await runWhenReady(async (OneSignal) => {
    if (OneSignal.Notifications?.isPushSupported && !OneSignal.Notifications.isPushSupported()) {
      return;
    }
    if (OneSignal.User?.PushSubscription?.optIn) {
      await OneSignal.User.PushSubscription.optIn();
    }
  });
}

/**
 * Login + opt-in when permitted. Call on app load and when opening chat.
 */
export async function oneSignalEnsurePushSetup(userId: string): Promise<void> {
  await oneSignalLogin(userId);
  await oneSignalOptInIfGranted();
}

/**
 * Show permission UI (slidedown or native). Returns true if prompt was shown.
 */
export async function oneSignalRequestPermission(force = false): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'denied' && !force) return false;

  return runWhenReady(async (OneSignal) => {
    if (OneSignal.Notifications?.isPushSupported && !OneSignal.Notifications.isPushSupported()) {
      return false;
    }
    if (Notification.permission === 'granted') {
      await OneSignal.User?.PushSubscription?.optIn?.();
      return true;
    }
    if (OneSignal.Slidedown?.promptPush) {
      OneSignal.Slidedown.promptPush({ force });
      return true;
    }
    if (OneSignal.Notifications?.requestPermission) {
      await OneSignal.Notifications.requestPermission();
      if (Notification.permission === 'granted') {
        await OneSignal.User?.PushSubscription?.optIn?.();
      }
      return true;
    }
    return false;
  });
}
