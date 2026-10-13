// Saves an unfinished registration in localStorage so people can leave and
// pick up where they stopped. Browser-only: call from event handlers,
// effects, or components that render after hydration.

import { MAX_TEAM_SIZE, blankMember, type Member } from "@/lib/registration";

const STORAGE_KEY = "reidxtreme5:registration-draft";
const VERSION = 1;

export type RegistrationDraft = {
  step: number;
  teamName: string;
  leader: Member;
  // Everyone except the leader.
  members: Member[];
  savedAt: number;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");

function readMember(raw: unknown): Member {
  const input = (raw ?? {}) as Record<string, unknown>;
  return {
    ...blankMember(),
    name: str(input.name),
    year: str(input.year),
    email: str(input.email),
    whatsapp: str(input.whatsapp),
    registrationNumber: str(input.registrationNumber),
    ieeeMembership: str(input.ieeeMembership),
  };
}

export function loadDraft(): RegistrationDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.version !== VERSION) return null;

    const members = (Array.isArray(data.members) ? data.members : [])
      .slice(0, MAX_TEAM_SIZE - 1)
      .map(readMember);
    // Steps are team, leader, one per member, then review.
    const lastStep = members.length + 2;
    const step = Math.min(Math.max(Number(data.step) || 0, 0), lastStep);

    return {
      step,
      teamName: str(data.teamName),
      leader: readMember(data.leader),
      members,
      savedAt: Number(data.savedAt) || Date.now(),
    };
  } catch {
    // Corrupt JSON or storage blocked (private mode); start fresh.
    return null;
  }
}

export function saveDraft(draft: Omit<RegistrationDraft, "savedAt">) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: VERSION, ...draft, savedAt: Date.now() }),
    );
  } catch {
    // Storage full or blocked; the form still works without saving.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
