import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Remote push notifications were removed from Expo Go in SDK 53.
// Guard every expo-notifications call so the module is never loaded in Expo Go,
// preventing the DevicePushTokenAutoRegistration side-effect from firing.
const isExpoGo = Constants.appOwnership === 'expo';

export const LARGE_TRANSACTION_THRESHOLD = 5000;

// Lazily load expo-notifications only in real builds
function getNotifications() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-notifications') as typeof import('expo-notifications');
}

// Wire up the notification handler once, only outside Expo Go
if (!isExpoGo && Platform.OS !== 'web') {
  try {
    getNotifications().setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // silently ignore if native module isn't available
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (isExpoGo || Platform.OS === 'web') return false;
  try {
    const { status } = await getNotifications().requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function sendLocalNotification(title: string, body: string): Promise<void> {
  if (isExpoGo || Platform.OS === 'web') return;
  try {
    await getNotifications().scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (e) {
    // non-fatal — notifications are a nice-to-have
  }
}
