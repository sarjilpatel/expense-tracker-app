import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { runSync, type SyncReason } from './engine';
import { getSyncMeta, updateSyncMeta, type BackupSchedule } from './meta';
import { isSignedIn } from './session';
import * as outbox from './outbox';
import { reportError } from '@/src/utils/log';

/**
 * When the engine runs (W3-17). The user's schedule is a ceiling on staleness, not a clock:
 *
 *   instant   a debounced run 5 s after the last local write while the app is open, and the
 *             background floor below when it is not
 *   hourly / every4h / every8h   a run is due once that long has passed since the last one
 *   daily     due once the local midnight after the last run has passed ("around midnight")
 *   manual    only "Sync now" and pull-to-refresh
 *
 * Every schedule also runs on app foreground *if due*, and `expo-background-task` is registered
 * at the schedule's interval (the OS floor is 15 minutes, and it runs at the OS's convenience —
 * deferred on low battery, gone if the app is force-stopped). "Wi-Fi only" applies to scheduled
 * and background runs; a manual run always goes.
 */

export const INTERVAL_MS: Record<BackupSchedule, number | null> = {
  instant: 15 * 60 * 1000,      // the background floor; foreground writes run sooner
  hourly:  60 * 60 * 1000,
  every4h: 4 * 60 * 60 * 1000,
  every8h: 8 * 60 * 60 * 1000,
  daily:   null,                // midnight rule, see isDue
  manual:  null,
};

const WRITE_DEBOUNCE_MS = 5000;
const TASK = 'expense-tracker-sync';

/** Pure: is a run due under `schedule`, given the last run and now? Exported for tests. */
export function isDue(schedule: BackupSchedule, lastSyncAt: string | null, now = new Date(), pending = 0): boolean {
  if (schedule === 'manual') return false;
  if (!lastSyncAt) return true;
  const last = new Date(lastSyncAt);
  if (schedule === 'daily') {
    const midnight = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    return now >= midnight;
  }
  const interval = INTERVAL_MS[schedule] as number;
  if (schedule === 'instant' && pending > 0) return true;
  return now.getTime() - last.getTime() >= interval;
}

async function onWifi(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.type === 'wifi' || state.type === 'ethernet';
  } catch { return true; }
}

/** Run if the schedule says so; `reason` is for the log. */
export async function syncIfDue(reason: SyncReason = 'schedule'): Promise<boolean> {
  if (!isSignedIn()) return false;
  const meta = await getSyncMeta();
  const pending = await outbox.count();
  if (!isDue(meta.schedule, meta.lastSyncAt, new Date(), pending)) return false;
  const wifi = await onWifi();
  if (meta.wifiOnly && !wifi) return false;
  await runSync(reason, { attachments: wifi || meta.attachmentsOnCellular });
  return true;
}

// ── Foreground: after a write, and on returning to the app ───────────────────

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Called by dataService after every local write. Instant schedule → a debounced run. A write in
 * a *shared* group runs on the instant path whatever the schedule says (W3-23): the schedule is
 * the user's backup preference for their own data, and a family ledger hours stale is nobody's.
 */
export function noteLocalWrite(): void {
  if (!isSignedIn()) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    const meta = await getSyncMeta();
    const shared = !!meta.activeGroupId && meta.sharedGroupIds.includes(meta.activeGroupId);
    if (meta.schedule !== 'instant' && !shared) return;
    const wifi = await onWifi();
    if (meta.wifiOnly && !shared && !wifi) return;
    runSync('write', { attachments: wifi || meta.attachmentsOnCellular }).catch(() => {});
  }, WRITE_DEBOUNCE_MS);
}

let signalTimer: ReturnType<typeof setTimeout> | null = null;

/** The server said the group changed (W3-22): pull, debounced so a burst of edits is one run. */
export function noteGroupSignal(): void {
  if (!isSignedIn()) return;
  if (signalTimer) clearTimeout(signalTimer);
  signalTimer = setTimeout(() => { signalTimer = null; runSync('signal').catch(() => {}); }, 2000);
}

let appStateSub: { remove: () => void } | null = null;

/** Wire the foreground check once, from the root layout. */
export function startForegroundScheduler(): () => void {
  if (appStateSub) return () => {};
  const onChange = (state: AppStateStatus) => {
    if (state === 'active') syncIfDue('foreground').catch(() => {});
  };
  appStateSub = AppState.addEventListener('change', onChange);
  syncIfDue('foreground').catch(() => {});
  return () => { appStateSub?.remove(); appStateSub = null; };
}

// ── Background ───────────────────────────────────────────────────────────────

// Defined at module load: TaskManager requires the task to exist before the OS can invoke it.
if (!TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask(TASK, async () => {
    try {
      await syncIfDue('schedule');
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      reportError('[sync] background task', e);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** (Re)register the background task for the current schedule; unregister for manual. */
export async function applyBackgroundSchedule(schedule?: BackupSchedule): Promise<void> {
  const s = schedule ?? (await getSyncMeta()).schedule;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK);
    if (s === 'manual' || !isSignedIn()) {
      if (registered) await BackgroundTask.unregisterTaskAsync(TASK);
      return;
    }
    // Minutes; the OS floor is 15 and anything below is raised to it.
    const minimumInterval = Math.max(15, Math.round((INTERVAL_MS[s] ?? 24 * 60 * 60 * 1000) / 60000));
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval });
  } catch (e) {
    // No background execution here (a simulator, a restricted device) — foreground runs still work.
    reportError('[sync] background registration', e);
  }
}

export async function setBackupSchedule(schedule: BackupSchedule): Promise<void> {
  await updateSyncMeta({ schedule });
  await applyBackgroundSchedule(schedule);
}

export async function setWifiOnly(wifiOnly: boolean): Promise<void> {
  await updateSyncMeta({ wifiOnly });
}

export async function setAttachmentsOnCellular(attachmentsOnCellular: boolean): Promise<void> {
  await updateSyncMeta({ attachmentsOnCellular });
}
