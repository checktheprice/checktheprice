import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, CheckCircle2 } from "lucide-react";
import type { Deal } from "@/lib/deals";

interface Props {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceAlertModal({ deal, open, onOpenChange }: Props) {
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!deal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      onOpenChange(false);
      setSubmitted(false);
      setEmail("");
      setTarget("");
    }, 1800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden border-0 shadow-2xl">
        <div
          className="absolute inset-x-0 top-0 h-24 -z-10 opacity-90"
          style={{ background: "var(--gradient-hero)" }}
        />
        <DialogHeader className="pt-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-lg ring-4 ring-background">
            <Bell className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Set Price Drop Alert
          </DialogTitle>
          <DialogDescription className="text-center">
            Get notified the moment{" "}
            <span className="font-medium text-foreground">{deal.title}</span>{" "}
            drops in price.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-12 w-12 text-loot-hot" />
            <p className="text-lg font-medium">Alert set successfully!</p>
            <p className="text-sm text-muted-foreground">
              We'll ping you when the price drops.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Notify me when price is below</Label>
              <Input
                id="target"
                type="number"
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={`Current: ₹${deal.onlinePrice}`}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" size="lg">
                <Bell className="mr-2 h-4 w-4" /> Set Alert
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}