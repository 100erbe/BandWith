import React from "react";
import { cn } from "@/app/components/ui/utils";

export function StatusBadge({ status }: { status: string }) {
  let bg = "bg-stone-100";
  let text = "text-stone-600";
  let dotColor = "bg-stone-400";
  
  if (status === "TENTATIVE" || status === "Negotiating") { bg = "bg-yellow-100"; text = "text-yellow-700"; dotColor = "bg-yellow-500"; }
  if (status === "QUOTE" || status === "Sent") { bg = "bg-blue-100"; text = "text-blue-700"; dotColor = "bg-blue-500"; }
  if (status === "CONFIRMED" || status === "Finalizing") { bg = "bg-green-100"; text = "text-green-700"; dotColor = "bg-green-500"; }
  if (status === "PENDING" || status === "Draft") { bg = "bg-stone-200"; text = "text-stone-600"; dotColor = "bg-stone-500"; }

  return (
    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wide flex items-center gap-1.5", bg, text)}>
      <div className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
      {status}
    </span>
  );
}
