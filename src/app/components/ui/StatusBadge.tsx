import React from "react";
import { cn } from "@/app/components/ui/utils";

type PillVariant = "gig" | "rehearsal" | "quote" | "draft";

function mapStatusToVariant(status: string): PillVariant {
  const s = status?.toUpperCase();
  if (s === "CONFIRMED" || s === "COMPLETED" || s === "GIG") return "gig";
  if (s === "REHEARSAL") return "rehearsal";
  if (s === "QUOTED" || s === "QUOTE" || s === "SENT" || s === "NEGOTIATING") return "quote";
  return "draft";
}

function variantLabel(variant: PillVariant): string {
  if (variant === "gig") return "GIG";
  if (variant === "rehearsal") return "REHEARSAL";
  if (variant === "quote") return "QUOTE";
  return "DRAFT";
}

const variantClasses: Record<PillVariant, string> = {
  gig: "bg-accent-gig/15 text-accent-gig border border-accent-gig/30",
  rehearsal: "bg-secondary/20 text-secondary-foreground border border-border/50",
  quote: "bg-muted text-muted-foreground border border-border",
  draft: "bg-muted text-muted-foreground border border-border",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = mapStatusToVariant(status);
  const label = variantLabel(variant);

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-1",
        variantClasses[variant],
      )}
    >
      <span aria-hidden="true">•</span>
      {label}
    </span>
  );
}