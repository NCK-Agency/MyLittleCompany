"use client";

import { useEffect, useState } from "react";
import type {
  AccessGrant,
  Company,
  CompanyMembership,
  CompanyRole,
  KnowledgePermission,
  KnowledgeScope,
} from "@/domain/types";
import { apiRequest } from "@/lib/api";

const memberRoles: CompanyRole[] = ["MANAGER", "MARKETING", "OPERATIONS", "SALES", "FRONT_DESK", "EMPLOYEE"];
const permissions: KnowledgePermission[] = ["READ", "SUGGEST", "APPROVE"];

function sameScope(left: KnowledgeScope, right: KnowledgeScope): boolean {
  return left.level === right.level && left.organizationalUnitId === right.organizationalUnitId;
}

function GrantMatrix({
  company,
  grants,
  onChange,
}: {
  company: Company;
  grants: AccessGrant[];
  onChange: (grants: AccessGrant[]) => void;
}) {
  const scopes: Array<{ label: string; scope: KnowledgeScope }> = [
    { label: "Entire company", scope: { level: "COMPANY" } },
    ...company.organizationalUnits.filter((unit) => unit.type === "DEPARTMENT").map((unit) => ({
      label: unit.name,
      scope: { level: "DEPARTMENT" as const, organizationalUnitId: unit.id },
    })),
  ];

  function toggle(permission: KnowledgePermission, scope: KnowledgeScope): void {
    const exists = grants.some((grant) => grant.permission === permission && sameScope(grant.scope, scope));
    onChange(exists
      ? grants.filter((grant) => !(grant.permission === permission && sameScope(grant.scope, scope)))
      : [...grants, { permission, scope }]);
  }

  return (
    <div className="overflow-x-auto border border-[var(--border-strong)]">
      <div className="grid min-w-[32rem] grid-cols-[1fr_repeat(3,6rem)] bg-[var(--ivory)] px-3 py-2 text-xs font-extrabold uppercase tracking-wide">
        <span>Scope</span>{permissions.map((permission) => <span className="text-center" key={permission}>{permission}</span>)}
      </div>
      {scopes.map(({ label, scope }) => (
        <div className="grid min-w-[32rem] grid-cols-[1fr_repeat(3,6rem)] items-center border-t border-[var(--border)] px-3 py-3" key={`${scope.level}:${scope.organizationalUnitId ?? "company"}`}>
          <strong className="text-sm">{label}</strong>
          {permissions.map((permission) => (
            <label className="grid place-items-center" key={permission}>
              <span className="sr-only">{permission} for {label}</span>
              <input checked={grants.some((grant) => grant.permission === permission && sameScope(grant.scope, scope))} onChange={() => toggle(permission, scope)} type="checkbox" />
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

function RolePicker({ roles, onChange }: { roles: CompanyRole[]; onChange: (roles: CompanyRole[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {memberRoles.map((role) => (
        <label className="flex items-center gap-2 border border-[var(--border-strong)] px-3 py-2 text-xs font-bold" key={role}>
          <input checked={roles.includes(role)} onChange={() => onChange(roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role])} type="checkbox" />
          {role.replace("_", " ")}
        </label>
      ))}
    </div>
  );
}

function MemberEditor({ company, member, onSaved }: { company: Company; member: CompanyMembership; onSaved: (member: CompanyMembership) => void }) {
  const [displayName, setDisplayName] = useState(member.displayName);
  const [roles, setRoles] = useState(member.roles);
  const [grants, setGrants] = useState(member.grants);
  const [status, setStatus] = useState("");
  const owner = member.roles.includes("OWNER");

  async function save(nextStatus = member.status): Promise<void> {
    setStatus("Saving access…");
    try {
      const updated = await apiRequest<CompanyMembership>(`/api/memberships/${member.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName, roles, grants, status: nextStatus }),
      });
      onSaved(updated);
      setStatus("Access saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save access.");
    }
  }

  return (
    <article className="border-2 border-[var(--border-strong)] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-kicker">{owner ? "Owner" : member.status}</p>
          <h2 className="mt-1 text-2xl font-black">{member.displayName}</h2>
          <p className="text-sm text-[var(--muted)]">{member.email}</p>
        </div>
        {owner ? <span className="knowledge-scope-chip">Full access</span> : (
          <button className="secondary-button" onClick={() => void save(member.status === "DISABLED" ? "ACTIVE" : "DISABLED")} type="button">
            {member.status === "DISABLED" ? "Restore access" : "Pause access"}
          </button>
        )}
      </div>
      {!owner && (
        <div className="mt-6 grid gap-5">
          <label className="field-label">Display name<input className="text-input" onChange={(event) => setDisplayName(event.target.value)} value={displayName} /></label>
          <div><p className="field-label mb-2">Business roles</p><RolePicker onChange={setRoles} roles={roles} /></div>
          <div><p className="field-label mb-2">Knowledge access</p><GrantMatrix company={company} grants={grants} onChange={setGrants} /></div>
          <div className="flex items-center justify-between gap-4"><p aria-live="polite" className="text-sm text-[var(--muted)]">{status}</p><button className="primary-button" onClick={() => void save()} type="button">Save access</button></div>
        </div>
      )}
    </article>
  );
}

export function PeopleAccess() {
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMembership[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<CompanyRole[]>(["EMPLOYEE"]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [status, setStatus] = useState("Loading people…");

  useEffect(() => {
    Promise.all([apiRequest<Company>("/api/company"), apiRequest<CompanyMembership[]>("/api/memberships")])
      .then(([companyResult, membershipResult]) => {
        setCompany(companyResult);
        setMembers(membershipResult);
        setStatus("");
      })
      .catch(() => setStatus("Could not load people and access."));
  }, []);

  async function invite(): Promise<void> {
    if (!company) return;
    setStatus("Sending invitation…");
    try {
      const member = await apiRequest<CompanyMembership>("/api/memberships", {
        method: "POST",
        body: JSON.stringify({ displayName, email, roles, grants }),
      });
      setMembers((current) => [...current, member]);
      setDisplayName("");
      setEmail("");
      setRoles(["EMPLOYEE"]);
      setGrants([]);
      setStatus(`Invitation created for ${member.email}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create the invitation.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="border-b-2 border-[var(--graphite)] pb-8">
        <p className="page-kicker">People & access</p>
        <h1 className="page-title mt-3">Give people only what they need.</h1>
        <p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">Reading, suggesting, and approving are separate. Each can apply to the whole company or one department.</p>
      </header>

      {company && (
        <section className="mt-8 border-2 border-[var(--cobalt)] bg-[var(--cobalt-soft)] p-5 sm:p-7">
          <h2 className="text-3xl font-black uppercase">Invite someone</h2>
          <div className="mt-5 grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field-label">Name<input className="text-input" onChange={(event) => setDisplayName(event.target.value)} value={displayName} /></label>
              <label className="field-label">Email<input className="text-input" onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label>
            </div>
            <div><p className="field-label mb-2">Business roles</p><RolePicker onChange={setRoles} roles={roles} /></div>
            <div><p className="field-label mb-2">Knowledge access</p><GrantMatrix company={company} grants={grants} onChange={setGrants} /></div>
            <div className="flex justify-end"><button className="primary-button" disabled={!displayName || !email || roles.length === 0} onClick={() => void invite()} type="button">Send invitation</button></div>
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-5">
        {company && members.map((member) => (
          <MemberEditor company={company} key={member.userId} member={member} onSaved={(updated) => setMembers((current) => current.map((item) => item.userId === updated.userId ? updated : item))} />
        ))}
      </section>
      <p aria-live="polite" className="mt-5 text-sm font-bold text-[var(--cobalt)]">{status}</p>
    </main>
  );
}
