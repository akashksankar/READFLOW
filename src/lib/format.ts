/**
 * Formatting helpers for file sizes, relative dates, and percentages
 */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'opened just now';
  if (diffMins === 1) return 'opened 1 minute ago';
  if (diffMins < 60) return `opened ${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return 'opened 1 hour ago';
  if (diffHours < 24) return `opened ${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'opened yesterday';
  if (diffDays < 30) return `opened ${diffDays} days ago`;
  const date = new Date(timestamp);
  return `opened ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function computeProgressPercent(
  pageIndex: number,
  fraction: number,
  pageCount: number
): number {
  if (!pageCount || pageCount <= 0) return 0;
  const clampedPage = Math.max(0, Math.min(pageCount - 1, pageIndex));
  const clampedFraction = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const raw = ((clampedPage + clampedFraction) / pageCount) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
