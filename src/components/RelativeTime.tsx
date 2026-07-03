import { useEffect, useState } from "react";

function format(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

interface Props {
  timestamp?: number;
  fallback?: string;
  className?: string;
  prefix?: string;
}

export function RelativeTime({
  timestamp,
  fallback = "Recently added",
  className,
  prefix = "Updated ",
}: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!timestamp) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (!timestamp) {
    return <span className={className}>{fallback}</span>;
  }
  return <span className={className}>{prefix}{format(timestamp)}</span>;
}