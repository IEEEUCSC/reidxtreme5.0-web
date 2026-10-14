"use client";

import { useEffect, useId, useRef } from "react";
import { cx } from "@/lib/cx";

// Only the leader sees this link; members get theirs by email.
const LEADERS_WHATSAPP_URL = "https://chat.whatsapp.com/KegoGnuW8DLJJBeFU96OPF?s=cl&p=i&mlu=0";

export type RegistrationResult =
  | { kind: "success"; teamName: string; teamSize: number }
  | { kind: "error"; message: string };

type RegistrationDialogProps = {
  result: RegistrationResult | null;
  onClose: () => void;
};

export default function RegistrationDialog({ result, onClose }: RegistrationDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (result && !dialog.open) {
      dialog.showModal();
      actionRef.current?.focus();
    }
    if (!result && dialog.open) dialog.close();
  }, [result]);

  const isSuccess = result?.kind === "success";

  return (
    <dialog
      aria-describedby={`${id}-body`}
      aria-labelledby={`${id}-title`}
      className={cx(
        "fixed inset-0 m-auto w-[min(92vw,26rem)] overflow-visible rounded-lg border bg-[rgb(3_15_13/0.94)] p-0 text-body shadow-[0_24px_70px_rgb(0_0_0/0.6)] backdrop-blur-md",
        "open:animate-[rise-in_300ms_var(--ease-standard)_both]",
        "backdrop:bg-bg/75 backdrop:backdrop-blur-sm open:backdrop:animate-[fade-in_300ms_ease_both]",
        isSuccess
          ? "border-mint/55 shadow-[0_0_40px_rgb(140_245_189/0.18),0_24px_70px_rgb(0_0_0/0.6)]"
          : "border-[#ffb4a8]/45",
      )}
      // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      {result && (
        <div className="relative grid justify-items-center gap-4 px-[clamp(1.25rem,6vw,2rem)] pt-8 pb-7 text-center">
          {/* Corner ticks, echoing the technical frame of the panels. */}
          <span
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-2 rounded-md border border-dashed",
              isSuccess ? "border-mint/12" : "border-[#ffb4a8]/12",
            )}
          />

          <div className="grid gap-1.5">
            <p
              className={cx(
                "text-[0.68rem] font-semibold tracking-[0.16em] uppercase",
                isSuccess ? "text-mint" : "text-[#ffb4a8]",
              )}
            >
              {isSuccess ? "Registration confirmed" : "Transmission interrupted"}
            </p>
            <h2
              className={cx(
                "font-display text-[clamp(1.9rem,8vw,2.4rem)] leading-none font-bold tracking-[0.04em] text-white uppercase",
                isSuccess && "text-glow",
              )}
              id={`${id}-title`}
            >
              {isSuccess ? "Bridge connected" : "Connection failed"}
            </h2>
          </div>

          <p
            className="text-sm leading-relaxed text-muted"
            id={`${id}-body`}
            role={isSuccess ? undefined : "alert"}
          >
            {result.kind === "success" ? (
              <>
                <span className="font-semibold text-white">{result.teamName}</span> is on the
                path. {result.teamSize === 1 ? "You're" : `All ${result.teamSize} members are`}{" "}
                registered for ReidXtreme 5.0.
                {result.teamSize > 1 &&
                  " We've emailed every member a link to the official Team Members' WhatsApp group."}
              </>
            ) : (
              result.message
            )}
          </p>

          {result.kind === "success" && (
            <div className="grid w-full gap-3 rounded-md border border-mint/30 bg-bg/60 p-4 text-left">
              <div className="grid gap-1">
                <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-mint uppercase">
                  Team leader only
                </p>
                <p className="text-sm leading-relaxed text-body">
                  Join the official Team Leaders&rsquo; WhatsApp group for announcements, selection
                  round updates and competition instructions.
                </p>
              </div>
              <a
                className="btn-primary h-auto min-h-11 w-full text-[0.78rem] tracking-[0.06em]"
                href={LEADERS_WHATSAPP_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                Join the leaders&rsquo; group
              </a>
            </div>
          )}

          <button
            className={cx(
              "mt-1 h-auto min-h-12 w-full text-[0.78rem] tracking-[0.06em]",
              isSuccess
                ? "rounded-md border border-mint/45 font-bold text-mint uppercase transition-colors hover:bg-mint/10"
                : "btn-primary",
            )}
            onClick={onClose}
            ref={actionRef}
            type="button"
          >
            {isSuccess ? "Done" : "Back to the form"}
          </button>
        </div>
      )}
    </dialog>
  );
}
