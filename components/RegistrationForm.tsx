"use client";

import { useId, useState, type FormEvent } from "react";
import CustomSelect from "@/components/CustomSelect";
import RegistrationDialog, { type RegistrationResult } from "@/components/RegistrationDialog";
import { SectionHeader } from "@/components/SectionHeader";
import { cx } from "@/lib/cx";
import {
  MAX_TEAM_SIZE,
  MIN_TEAM_SIZE,
  YEARS,
  blankMember,
  type Member,
  type RegistrationSubmission,
} from "@/lib/registration";
import { motion } from "motion/react";

const YEAR_OPTIONS = YEARS.map((year) => ({ label: `Year ${year}`, value: year }));

const TEAM_SIZE_OPTIONS = Array.from(
  { length: MAX_TEAM_SIZE - MIN_TEAM_SIZE + 1 },
  (_, index) => {
    const size = MIN_TEAM_SIZE + index;
    return { label: `${size} member${size === 1 ? "" : "s"}`, value: String(size) };
  },
);

type RegistrationFormProps = {
  // When false, the form is shown greyed out behind a "coming soon" overlay.
  isOpen: boolean;
};

// Form building blocks, styled after DESIGN.md §25.
const FIELD = "grid min-w-0 gap-[0.45rem]";
const LABEL = "m-0 block p-0 font-display text-[1.05rem] font-bold tracking-[0.1em] text-white";
const HINT = "font-sans text-[0.67rem] font-normal tracking-[0.015em] text-muted";
const CONTROL =
  "block min-h-[2.9rem] w-full min-w-0 rounded-sm border border-line bg-bg/65 px-[0.85rem] py-[0.72rem] font-sans text-[0.85rem] leading-[1.4] text-body transition-[border-color,box-shadow] duration-180 placeholder:text-muted/80 focus:border-mint focus:shadow-[0_0_12px_rgb(140_245_189/0.25)]";
const GROUP = "m-0 grid min-w-0 gap-[0.8rem] border-0 p-0 after:clear-both after:block";
// Floated so the legend sits inside the fieldset's grid like a normal label.
const LEGEND = `${LABEL} float-left mb-[0.8rem] w-full`;
const CARD = "grid min-w-0 gap-[0.7rem] rounded-md border border-emerald/28 bg-bg/42 p-[0.85rem]";
const CARD_HEADING = "m-0 font-display text-[0.9rem] font-semibold tracking-[0.1em] text-mint";

type MemberFieldsProps = {
  fieldId: string;
  name: string;
  // Prefix for the screen-reader labels, e.g. "Team lead".
  who: string;
  member: Member;
  onChange: (field: keyof Member, value: string) => void;
};

function MemberFields({ fieldId, name, who, member, onChange }: MemberFieldsProps) {
  return (
    <>
      <div className={FIELD}>
        <label className="sr-only" htmlFor={`${fieldId}-name`}>
          {who} full name
        </label>
        <input
          autoComplete="name"
          className={CONTROL}
          id={`${fieldId}-name`}
          maxLength={100}
          name={`${name}[name]`}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="Full name"
          required
          value={member.name}
        />
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-[0.7rem] max-[420px]:grid-cols-1">
        <div className={FIELD}>
          <label className="sr-only" htmlFor={`${fieldId}-whatsapp`}>
            {who} WhatsApp number
          </label>
          <input
            autoComplete="tel"
            className={CONTROL}
            id={`${fieldId}-whatsapp`}
            inputMode="numeric"
            maxLength={10}
            name={`${name}[whatsapp]`}
            // Digits only, so the value can only ever take the 0771234567 shape.
            onChange={(event) => onChange("whatsapp", event.target.value.replace(/\D/g, ""))}
            pattern="0[0-9]{9}"
            placeholder="WhatsApp (07XXXXXXXX)"
            required
            title="10 digits starting with 0, e.g. 0771234567"
            type="tel"
            value={member.whatsapp}
          />
        </div>
        <div className={FIELD}>
          <span className="sr-only" id={`${fieldId}-year-label`}>
            {who} year of study
          </span>
          <CustomSelect
            id={`${fieldId}-year`}
            labelId={`${fieldId}-year-label`}
            name={`${name}[year]`}
            onChange={(value) => onChange("year", value)}
            options={YEAR_OPTIONS}
            placeholder="Year"
            required
            value={member.year}
          />
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-[0.7rem] max-[420px]:grid-cols-1">
        <div className={FIELD}>
          <label className="sr-only" htmlFor={`${fieldId}-registration`}>
            {who} registration number
          </label>
          <input
            autoComplete="off"
            className={CONTROL}
            id={`${fieldId}-registration`}
            maxLength={40}
            name={`${name}[registrationNumber]`}
            onChange={(event) => onChange("registrationNumber", event.target.value)}
            placeholder="Registration number"
            required
            value={member.registrationNumber}
          />
        </div>
        <div className={FIELD}>
          <label className="sr-only" htmlFor={`${fieldId}-ieee`}>
            {who} IEEE membership number (optional)
          </label>
          <input
            autoComplete="off"
            className={CONTROL}
            id={`${fieldId}-ieee`}
            inputMode="numeric"
            maxLength={12}
            name={`${name}[ieeeMembership]`}
            onChange={(event) => onChange("ieeeMembership", event.target.value)}
            placeholder="IEEE no. (optional)"
            value={member.ieeeMembership}
          />
        </div>
      </div>
    </>
  );
}

export default function RegistrationForm({ isOpen }: RegistrationFormProps) {
  const id = useId();
  const [teamName, setTeamName] = useState("");
  const [leader, setLeader] = useState<Member>(blankMember);
  // Everyone except the leader; its length is always teamSize - 1.
  const [members, setMembers] = useState<Member[]>([]);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const teamSize = members.length + 1;

  function changeTeamSize(value: string) {
    const otherMembers = Number(value) - 1;
    setMembers((current) =>
      Array.from({ length: otherMembers }, (_, index) => current[index] ?? blankMember()),
    );
  }

  function updateMember(index: number, field: keyof Member, value: string) {
    setMembers((current) =>
      current.map((member, currentIndex) =>
        currentIndex === index ? { ...member, [field]: value } : member,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if ([leader, ...members].some((member) => !member.year)) {
      setResult({
        kind: "error",
        message: "Choose a year of study for every member, then try again.",
      });
      return;
    }

    const submission: RegistrationSubmission = { teamName, teamSize, leader, members };

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        teamId?: string;
      };
      if (!response.ok || !body.ok) {
        setResult({
          kind: "error",
          message: body.error ?? "Something went wrong on our side. Please try again.",
        });
        return;
      }

      setResult({ kind: "success", teamId: body.teamId ?? "", teamName, teamSize });
      setTeamName("");
      setLeader(blankMember());
      setMembers([]);
    } catch {
      setResult({
        kind: "error",
        message:
          "The connection could not be established. Check your internet connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.section
      id="registration"
      aria-labelledby={`${id}-heading`}
      className="w-full min-w-0"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <SectionHeader
        id={`${id}-heading`}
        title="Register Now!"
        className="mb-[clamp(1.5rem,4vw,2.5rem)]"
      />

      <div className="relative mx-auto w-full max-w-[520px] min-w-0 rounded-lg border border-line bg-panel shadow-[0_20px_55px_rgb(0_0_0/0.3),inset_0_1px_rgb(245_250_247/0.035)] backdrop-blur-md">

        {!isOpen && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-bg/40 backdrop-blur-[3px]">
            <div className="mx-4 flex flex-col items-center justify-center rounded-xl border border-mint/30 bg-panel/90 p-8 shadow-[0_0_40px_rgb(140_245_189/0.15)] backdrop-blur-md text-center">
              <h3 className="font-display text-xl font-bold tracking-[0.1em] text-white md:text-2xl">
                REGISTRATIONS
              </h3>
              <p className="mt-1 font-display text-2xl font-bold tracking-[0.05em] text-mint text-glow md:text-3xl">
                COMING SOON
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Assemble your team. The chasm opens shortly.
              </p>
            </div>
          </div>
        )}

        <div
          className={cx(
            "p-[clamp(1rem,5vw,1.6rem)] max-[420px]:p-[0.9rem]",
            !isOpen && "pointer-events-none opacity-25 grayscale-[0.5] select-none",
          )}
          inert={!isOpen}
        >
          <form className="grid min-w-0 gap-[1.15rem]" onSubmit={handleSubmit}>
            <div className={FIELD}>
              <label className={LABEL} htmlFor={`${id}-team-name`}>
                TEAM NAME <span className={HINT}>(INPUT)</span>
              </label>
              <input
                autoComplete="organization"
                className={CONTROL}
                id={`${id}-team-name`}
                maxLength={80}
                name="teamName"
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Enter your team name"
                required
                value={teamName}
              />
            </div>

            <div className={FIELD}>
              <span className={LABEL} id={`${id}-team-size-label`}>
                NUMBER OF MEMBERS{" "}
                <span className={HINT}>(MAX {MAX_TEAM_SIZE}, INCLUDING LEADER)</span>
              </span>
              <CustomSelect
                id={`${id}-team-size`}
                labelId={`${id}-team-size-label`}
                name="teamSize"
                onChange={changeTeamSize}
                options={TEAM_SIZE_OPTIONS}
                required
                value={String(teamSize)}
              />
            </div>

            <fieldset className={GROUP}>
              <legend className={LEGEND}>
                MEMBERS <span className={HINT}>(INPUT)</span>
              </legend>

              <div className={CARD}>
                <p className={CARD_HEADING}>TEAM LEADER</p>
                <MemberFields
                  fieldId={`${id}-leader`}
                  member={leader}
                  name="leader"
                  onChange={(field, value) =>
                    setLeader((current) => ({ ...current, [field]: value }))
                  }
                  who="Team leader"
                />
              </div>

              {members.map((member, index) => {
                const memberId = `${id}-member-${index + 2}`;

                return (
                  <div className={CARD} key={memberId}>
                    <p className={CARD_HEADING}>
                      TEAM MEMBER {String(index + 2).padStart(2, "0")}
                    </p>
                    <MemberFields
                      fieldId={memberId}
                      member={member}
                      name={`members[${index}]`}
                      onChange={(field, value) => updateMember(index, field, value)}
                      who={`Team member ${index + 2}`}
                    />
                  </div>
                );
              })}
            </fieldset>

            <button
              className="btn-primary h-auto min-h-13 w-full px-4 text-[clamp(0.68rem,3vw,0.8rem)] tracking-[0.06em] disabled:cursor-wait disabled:opacity-65"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "CONSTRUCTING BRIDGE..." : "CONNECT & REGISTER"}
            </button>
          </form>
        </div>
      </div>

      <RegistrationDialog onClose={() => setResult(null)} result={result} />
    </motion.section>
  );
}
