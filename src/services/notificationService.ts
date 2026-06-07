import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const REMINDER_ID_KEY = '@daily_reminder_id';

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  if (isExpoGo || Platform.OS === 'web') return;
  try {
    const Notifications = getNotifications();
    // Cancel any existing reminder first
    const prev = await AsyncStorage.getItem(REMINDER_ID_KEY);
    if (prev) await Notifications.cancelScheduledNotificationAsync(prev).catch(() => {});

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💰 Daily spending check-in",
        body: "Have you logged all your expenses today?",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
      },
    });
    await AsyncStorage.setItem(REMINDER_ID_KEY, id);
  } catch (e) {
    // non-fatal
  }
}

export async function cancelDailyReminder(): Promise<void> {
  if (isExpoGo || Platform.OS === 'web') return;
  try {
    const Notifications = getNotifications();
    const id = await AsyncStorage.getItem(REMINDER_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(REMINDER_ID_KEY);
    }
  } catch (e) {
    // non-fatal
  }
}

export async function getReminderTime(): Promise<{ hour: number; minute: number } | null> {
  try {
    const raw = await AsyncStorage.getItem('@daily_reminder_time');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveReminderTime(hour: number, minute: number): Promise<void> {
  await AsyncStorage.setItem('@daily_reminder_time', JSON.stringify({ hour, minute }));
}
