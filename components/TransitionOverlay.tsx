"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useHydrated } from "@/hooks/useHydrated";
import { cx } from "@/lib/cx";

type TransitionOverlayProps = {
  show: boolean;
  // "page": between routes; the page underneath is already dimmed by
  // app/template.tsx, so the overlay appears instantly and lets clicks through.
  // "submit": over a live page; fades in, dims the page and blocks input.
  variant?: "page" | "submit";
  // Announced to screen readers and shown under the logo.
  label?: string;
};

// The logo-assembly video shown between pages and while a registration is sent.
export function TransitionOverlay({ show, variant = "page", label }: TransitionOverlayProps) {
  const hydrated = useHydrated();
  const isSubmit = variant === "submit";

  // Portalled to <body>: the page wrapper in app/template.tsx has a filter,
  // which would otherwise pin this "fixed" overlay to the page, not the screen.
  if (!hydrated) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          animate={{ opacity: 1 }}
          className={cx(
            "fixed inset-0 z-[9999] flex items-center justify-center",
            isSubmit ? "bg-bg/85 backdrop-blur-md" : "pointer-events-none",
          )}
          exit={{ opacity: 0 }}
          initial={{ opacity: isSubmit ? 0 : 1 }}
          transition={{ duration: isSubmit ? 0.35 : 0.6, ease: "easeInOut" }}
        >
          {/* Glowing Green Grid Background */}
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage:
                "linear-gradient(rgb(140 245 189 / 0.25) 1px, transparent 1px), linear-gradient(90deg, rgb(140 245 189 / 0.25) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              filter: "drop-shadow(0 0 8px rgb(140 245 189 / 0.8))",
              maskImage: "radial-gradient(circle at center, black 10%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(circle at center, black 10%, transparent 70%)",
            }}
          />
          {/* Soft Radial Glow behind video */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgb(140_245_189/0.08)_0%,transparent_50%)]" />
          <video
            aria-hidden="true"
            autoPlay
            className="h-full w-full object-contain"
            height={1080}
            // A submission can outlast one play, so keep the logo moving until it settles.
            loop={isSubmit}
            muted
            playsInline
            src="/transition/transition.webm"
            width={1920}
          />
          {label && (
            <p
              className="absolute inset-x-0 bottom-[clamp(3rem,14vh,8rem)] m-0 animate-[fade-in_600ms_400ms_ease_both] text-center text-[0.72rem] font-semibold tracking-[0.18em] text-mint uppercase"
              role="status"
            >
              {label}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
