"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/lib/cx";

export type RegistrationResult =
  | { kind: "success"; teamId: string; teamName: string; teamSize: number }
  | { kind: "error"; message: string };

type RegistrationDialogProps = {
  result: RegistrationResult | null;
  onClose: () => void;
};

const ERROR_TONE = "#ffb4a8";

// Two deck spans meeting over the chasm. Connected spans draw a continuous
// mint line; a failed connection leaves a broken gap.
function BridgeMark({ connected }: { connected: boolean }) {
  const stroke = connected ? "var(--color-mint)" : ERROR_TONE;
  const draw = "animate-[draw-line_600ms_var(--ease-draw)_both]";

  return (
    <svg
      aria-hidden="true"
      className={cx("h-14 w-36", connected && "drop-shadow-[0_0_10px_rgb(140_245_189/0.55)]")}
      fill="none"
      viewBox="0 0 144 56"
    >
      {/* Pylons */}
      <path d="M22 50V14M122 50V14" stroke={stroke} strokeOpacity="0.45" strokeWidth="1.5" />
      {/* Cables */}
      <path
        className={draw}
        d="M22 14 L4 34 M22 14 L48 34 M122 14 L140 34 M122 14 L96 34"
        pathLength={1}
        stroke={stroke}
        strokeDasharray="1"
        strokeOpacity="0.6"
        strokeWidth="1"
      />
      {connected ? (
        <path
          className={draw}
          d="M2 34 Q72 22 142 34"
          pathLength={1}
          stroke={stroke}
          strokeDasharray="1"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      ) : (
        <>
          <path d="M2 34 Q32 30 58 33" stroke={stroke} strokeLinecap="round" strokeWidth="2.5" />
          <path d="M86 33 Q112 30 142 34" stroke={stroke} strokeLinecap="round" strokeWidth="2.5" />
          {/* Falling debris in the gap */}
          <path
            d="M66 38l-3 6M74 40l2 7M70 46l-1 4"
            stroke={stroke}
            strokeLinecap="round"
            strokeOpacity="0.7"
            strokeWidth="1.5"
          />
        </>
      )}
    </svg>
  );
}

export default function RegistrationDialog({ result, onClose }: RegistrationDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (result && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first control (COPY); start on the main action.
      actionRef.current?.focus();
    }
    if (!result && dialog.open) dialog.close();
  }, [result]);

  async function copyTeamId(teamId: string) {
    try {
      await navigator.clipboard.writeText(teamId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the ID is still on screen to copy by hand.
    }
  }

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

          <BridgeMark connected={isSuccess} />

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

          {result.kind === "success" ? (
            <>
              <p className="text-sm leading-relaxed text-muted" id={`${id}-body`}>
                <span className="font-semibold text-white">{result.teamName}</span> is on the
                path. {result.teamSize === 1 ? "You're" : `All ${result.teamSize} members are`}{" "}
                registered for ReidXtreme 5.0.
              </p>

              {result.teamId && (
                <div className="grid w-full gap-1.5 rounded-md border border-line bg-bg/60 px-4 py-3">
                  <span className="text-[0.62rem] font-semibold tracking-[0.16em] text-muted uppercase">
                    Your team ID
                  </span>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-display text-[1.75rem] leading-none font-bold tracking-[0.12em] text-mint text-glow">
                      {result.teamId}
                    </span>
                    <button
                      className="min-h-7 cursor-pointer rounded-sm border border-mint/40 px-2 text-[0.6rem] font-semibold tracking-[0.08em] text-mint transition-[opacity,transform] duration-150 hover:-translate-y-px hover:opacity-80"
                      onClick={() => copyTeamId(result.teamId)}
                      type="button"
                    >
                      {copied ? "COPIED" : "COPY"}
                    </button>
                  </div>
                  <span className="text-[0.7rem] text-muted">Keep it handy for the checkpoints ahead.</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted" id={`${id}-body`} role="alert">
              {result.message}
            </p>
          )}

          <button
            className="btn-primary mt-1 h-auto min-h-12 w-full text-[0.78rem] tracking-[0.06em]"
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
