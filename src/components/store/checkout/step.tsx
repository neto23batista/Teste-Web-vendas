"use client";

import type { ReactNode } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CheckoutStep({ number, title, summary, open, onToggle, onContinue, continueLabel, children }: {
  number: number; title: string; summary: string; open: boolean;
  onToggle: () => void; onContinue: () => void; continueLabel: string; children: ReactNode;
}) {
  const id = `checkout-step-${number}`;
  return (
    <section data-checkout-step={number} className="min-w-0 rounded-2xl border border-border bg-card">
      <h2>
        <button type="button" id={`${id}-heading`} aria-expanded={open} aria-controls={id}
          onClick={onToggle} className="flex min-h-20 w-full items-center gap-3 rounded-2xl p-4 text-left sm:p-5">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-info-surface text-sm font-bold text-info">{number}</span>
          <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span>
            {!open && <span className="mt-1 block break-words text-sm font-normal leading-relaxed text-muted-foreground">{summary}</span>}
          </span>
          <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>
      {/* Mounted controls preserve drafts and FormData while a step is collapsed. */}
      <div id={id} role="region" aria-labelledby={`${id}-heading`} hidden={!open} className="px-4 pb-4 sm:px-5 sm:pb-5">
        {children}
        <Button type="button" variant="outline" onClick={onContinue} className="mt-4 w-full sm:w-auto">
          {continueLabel} <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
