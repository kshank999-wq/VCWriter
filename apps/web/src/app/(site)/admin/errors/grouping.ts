export interface ErrorReportRow {
  id: string;
  user_id: string | null;
  app_version: string;
  platform: string;
  os_version: string;
  error_name: string;
  error_message: string;
  stack: string;
  surface: string;
  created_at: string;
}

export interface ErrorGroup {
  key: string;
  errorName: string;
  errorMessage: string;
  surface: string;
  stack: string;
  count: number;
  /** Distinct signed-in reporters. Signed-out reports are counted in `count` only. */
  knownUsers: number;
  versions: string[];
  platforms: string[];
  lastSeen: string | null;
}

/**
 * Collapse reports into one row per distinct failure.
 *
 * Messages vary in their details — an id, a count, a number of milliseconds —
 * so the grouping key normalises numbers out. Without that, one bug with a
 * counter in its message spreads across fifty rows and looks like fifty rare
 * problems instead of one common one.
 */
const groupingKey = (row: ErrorReportRow): string => {
  const message = row.error_message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/\d+/g, '#')
    .slice(0, 120);
  // The first stack frame separates two different bugs that fail the same way.
  const frame = row.stack.split('\n').find((line) => line.trim().startsWith('at'))?.trim() ?? '';
  return `${row.surface}|${row.error_name}|${message}|${frame}`;
};

export const groupErrorReports = (rows: ErrorReportRow[]): ErrorGroup[] => {
  const groups = new Map<string, ErrorGroup & { users: Set<string> }>();

  for (const row of rows) {
    const key = groupingKey(row);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        errorName: row.error_name,
        errorMessage: row.error_message,
        surface: row.surface,
        stack: row.stack.split('\n').slice(0, 6).join('\n'),
        count: 1,
        knownUsers: 0,
        versions: row.app_version ? [row.app_version] : [],
        platforms: row.platform ? [row.platform] : [],
        lastSeen: row.created_at,
        users: new Set(row.user_id ? [row.user_id] : []),
      });
      continue;
    }

    existing.count += 1;
    if (row.user_id) existing.users.add(row.user_id);
    if (row.app_version && !existing.versions.includes(row.app_version)) existing.versions.push(row.app_version);
    if (row.platform && !existing.platforms.includes(row.platform)) existing.platforms.push(row.platform);
    // Rows arrive newest first, so the first `created_at` seen is the latest;
    // comparing rather than assuming keeps this correct under any ordering.
    if (existing.lastSeen === null || row.created_at > existing.lastSeen) existing.lastSeen = row.created_at;
  }

  return [...groups.values()]
    .map(({ users, ...group }) => ({ ...group, knownUsers: users.size }))
    .sort((a, b) => b.count - a.count || (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
};
