// Streak / daily goal bookkeeping. "Today" is the device's local calendar day.
const HISTORY_DAYS = 60;

export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const daysAgo = (now, n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);

const BACKUP_REMINDER_DAYS = 14;

/** True when the last backup (or snooze, or first run) is more than 14 days old and reminders are on. */
export function backupReminderDue({ enabled, lastBackupAt, snoozedAt, firstRunAt }, now = new Date()) {
  if (!enabled) return false;
  const times = [lastBackupAt, snoozedAt, firstRunAt].filter(Boolean).map((d) => new Date(d).getTime());
  return times.length > 0 && now.getTime() - Math.max(...times) > BACKUP_REMINDER_DAYS * 86_400_000;
}

/** Progress as it should be shown now (a lapsed streak reads 0; today's counters come from history). */
export function viewProgress(p, now = new Date()) {
  const today = dayKey(now);
  const alive = p.lastStudyDate === today || p.lastStudyDate === dayKey(daysAgo(now, 1));
  const entry = p.history.find((h) => h.date === today);
  return { ...p, streak: alive ? p.streak : 0, dailyDone: entry?.cards ?? 0, newToday: entry?.newCards ?? 0 };
}

/** Records finished cards: xp, daily count, streak and the per-day history. Returns a new object. */
export function recordStudy(p, { xp, cards, newCards = 0 }, now = new Date()) {
  const view = viewProgress(p, now);
  const today = dayKey(now);
  const prev = p.history.find((h) => h.date === today) ?? { date: today, cards: 0, xp: 0, newCards: 0 };
  const entry = { date: today, cards: prev.cards + cards, xp: prev.xp + xp, newCards: prev.newCards + newCards };
  const history = [...p.history.filter((h) => h.date !== today), entry]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-HISTORY_DAYS);
  return {
    ...p,
    xp: p.xp + xp,
    streak: p.lastStudyDate === today ? view.streak : view.streak + 1,
    lastStudyDate: today,
    dailyDone: entry.cards,
    history,
  };
}
