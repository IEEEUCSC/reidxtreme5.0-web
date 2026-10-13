// Shared by the registration form and the /api/register route handler.

export const MIN_TEAM_SIZE = 1;
export const MAX_TEAM_SIZE = 4;

export const YEARS = ["1", "2", "3", "4"] as const;

export type Member = {
  name: string;
  year: string;
  whatsapp: string;
  registrationNumber: string;
  // Optional; empty string when the member has none.
  ieeeMembership: string;
};

export type RegistrationSubmission = {
  teamName: string;
  teamSize: number;
  leader: Member;
  members: Member[];
};

export const blankMember = (): Member => ({
  name: "",
  year: "",
  whatsapp: "",
  registrationNumber: "",
  ieeeMembership: "",
});

// Local format only: 10 digits starting with 0, e.g. 0771234567.
const WHATSAPP_PATTERN = /^0\d{9}$/;
const IEEE_PATTERN = /^\d{6,12}$/;

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function cleanMember(raw: unknown, who: string): Member {
  const input = (raw ?? {}) as Record<string, unknown>;
  const member: Member = {
    name: text(input.name, 100),
    year: text(input.year, 1),
    whatsapp: text(input.whatsapp, 20),
    registrationNumber: text(input.registrationNumber, 40).toUpperCase(),
    ieeeMembership: text(input.ieeeMembership, 20),
  };

  if (!member.name) throw new Error(`${who}: name is required.`);
  if (!YEARS.includes(member.year as (typeof YEARS)[number]))
    throw new Error(`${who}: choose a year of study.`);
  if (!WHATSAPP_PATTERN.test(member.whatsapp))
    throw new Error(`${who}: WhatsApp number must be 10 digits, like 0771234567.`);
  if (!member.registrationNumber) throw new Error(`${who}: registration number is required.`);
  if (member.ieeeMembership && !IEEE_PATTERN.test(member.ieeeMembership))
    throw new Error(`${who}: IEEE membership number should contain only digits.`);

  return member;
}

// Validates untrusted input and returns a normalized submission, or throws
// an Error whose message is safe to show to the user.
export function parseSubmission(raw: unknown): RegistrationSubmission {
  const input = (raw ?? {}) as Record<string, unknown>;
  const teamName = text(input.teamName, 80);
  const teamSize = Number(input.teamSize);
  const rawMembers = Array.isArray(input.members) ? input.members : [];

  if (!teamName) throw new Error("Team name is required.");
  if (!Number.isInteger(teamSize) || teamSize < MIN_TEAM_SIZE || teamSize > MAX_TEAM_SIZE)
    throw new Error(`Teams must have ${MIN_TEAM_SIZE}–${MAX_TEAM_SIZE} members.`);
  if (rawMembers.length !== teamSize - 1)
    throw new Error("Member details do not match the team size.");

  const leader = cleanMember(input.leader, "Team leader");
  const members = rawMembers.map((member, index) => cleanMember(member, `Member ${index + 2}`));

  const regNumbers = [leader, ...members].map((member) => member.registrationNumber);
  if (new Set(regNumbers).size !== regNumbers.length)
    throw new Error("Each member must have a different registration number.");

  return { teamName, teamSize, leader, members };
}
