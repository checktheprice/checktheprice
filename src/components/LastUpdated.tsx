import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function LastUpdated() {
  const [stamp, setStamp] = useState<string | null>(null);
  useEffect(() => {
    setStamp(
      new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, []);
  return (
    <div className="mx-auto mb-2 flex max-w-7xl items-center justify-end gap-1.5 px-1 text-[11px] text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>Last updated: {stamp ?? "just now"}</span>
    </div>
  );
}