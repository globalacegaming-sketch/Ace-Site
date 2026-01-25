/**
 * OneSignal push notification integration.
 * - Login/logout: links the subscription to the user so backend can target by external_id.
 * - requestPermission: call when the user opens chat (contextual prompt).
 */

interface OneSignalSDK {
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  Notifications?: { requestPermission: () => void | Promise<boolean>; isPushSupported?: () => boolean };
  User?: { PushSubscription?: { optIn: () => Promise<void> } };
  Slidedown?: { promptPush: (opts?: { force?: boolean }) => void };
}

declare global {
  interface Window {
    OneSignal?: OneSignalSDK;
    OneSignalDeferred?: Array<(OneSignal: OneSignalSDK) => void | Promise<void>>;
  }
}

/** Wait for OneSignal to be available (SDK loads with defer). */
function getOneSignal(): Promise<NonNullable<typeof window.OneSignal>> {
  return new Promise((resolve) => {
    if (window.OneSignal) {
      resolve(window.OneSignal);
      return;
    }
    const check = () => {
      if (window.OneSignal) {
        resolve(window.OneSignal);
        return;
      }
      setTimeout(check, 50);
    };
    setTimeout(check, 100);
  });
}

/**
 * Link the current device to the user. Call after login.
 * Backend targets this user via include_aliases.external_id.
 */
export async function oneSignalLogin(userId: string): Promise<void> {
  try {
    const OneSignal = await getOneSignal();
    await OneSignal.login(userId);
  } catch (e) {
    console.warn('OneSignal login failed:', e);
  }
}

/**
 * Unlink the current device from the user. Call on logout.
 */
export async function oneSignalLogout(): Promise<void> {
  try {
    const OneSignal = await getOneSignal();
    await OneSignal.logout();
  } catch (e) {
    console.warn('OneSignal logout failed:', e);
  }
}

/**
 * Request notification permission. Call when the user opens the chat widget
 * (contextual) so we only prompt if they’re likely to want support alerts.
 */
export async function oneSignalRequestPermission(): Promise<boolean> {
  try {
    const OneSignal = await getOneSignal();
    if (OneSignal.Notifications?.isPushSupported && !OneSignal.Notifications.isPushSupported()) {
      return false;
    }
    if (OneSignal.Slidedown?.promptPush) {
      OneSignal.Slidedown.promptPush();
      return true;
    }
    if (OneSignal.User?.PushSubscription?.optIn) {
      await OneSignal.User.PushSubscription.optIn();
      return true;
    }
    if (OneSignal.Notifications?.requestPermission) {
      await OneSignal.Notifications.requestPermission();
      return true;
    }
    return false;
  } catch (e) {
    console.warn('OneSignal requestPermission failed:', e);
    return false;
  }
}
