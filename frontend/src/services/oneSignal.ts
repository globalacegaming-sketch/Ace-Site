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

/**
 * Run a callback only after OneSignal SDK is fully initialized.
 * Uses the official OneSignalDeferred queue — this guarantees the SDK's
 * internal state is ready, unlike polling for window.OneSignal.
 */
function whenReady(fn: (sdk: OneSignalSDK) => void | Promise<void>): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(fn);
}

/**
 * Link the current device to the user. Call after login.
 * Backend targets this user via include_aliases.external_id.
 */
export async function oneSignalLogin(userId: string): Promise<void> {
  try {
    whenReady(async (OneSignal) => {
      try {
        await OneSignal.login(userId);
      } catch (e) {
        console.warn('OneSignal login failed:', e);
      }
    });
  } catch (e) {
    console.warn('OneSignal login setup failed:', e);
  }
}

/**
 * Unlink the current device from the user. Call on logout.
 */
export async function oneSignalLogout(): Promise<void> {
  try {
    whenReady(async (OneSignal) => {
      try {
        await OneSignal.logout();
      } catch (e) {
        console.warn('OneSignal logout failed:', e);
      }
    });
  } catch (e) {
    console.warn('OneSignal logout setup failed:', e);
  }
}

/**
 * Request notification permission. Call when the user opens the chat widget
 * (contextual) so we only prompt if they're likely to want support alerts.
 */
export async function oneSignalRequestPermission(): Promise<boolean> {
  try {
    return new Promise<boolean>((resolve) => {
      whenReady(async (OneSignal) => {
        try {
          if (OneSignal.Notifications?.isPushSupported && !OneSignal.Notifications.isPushSupported()) {
            resolve(false);
            return;
          }
          if (OneSignal.Slidedown?.promptPush) {
            OneSignal.Slidedown.promptPush();
            resolve(true);
            return;
          }
          if (OneSignal.User?.PushSubscription?.optIn) {
            await OneSignal.User.PushSubscription.optIn();
            resolve(true);
            return;
          }
          if (OneSignal.Notifications?.requestPermission) {
            await OneSignal.Notifications.requestPermission();
            resolve(true);
            return;
          }
          resolve(false);
        } catch (e) {
          console.warn('OneSignal requestPermission failed:', e);
          resolve(false);
        }
      });
    });
  } catch (e) {
    console.warn('OneSignal requestPermission setup failed:', e);
    return false;
  }
}
