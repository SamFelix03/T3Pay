export function money(cents: number): string {
  return `$${(Number(cents ?? 0) / 100).toFixed(2)}`;
}

export function short(value: unknown, max = 22): string {
  const text = String(value ?? "");
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max - 8)}…${text.slice(-6)}` : text;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
