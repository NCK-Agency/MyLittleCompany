"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Company, HydratedMemory, KnowledgeScope, MemoryType } from "@/domain/types";
import { apiRequest } from "@/lib/api";
import { BrandMark } from "./brand-mark";
import { KnowledgePageDialog } from "./knowledge-page-dialog";
import { isOwner } from "@/domain/authorization";
import { useViewer } from "./viewer-context";

type ScopeFilter = "ALL" | "COMPANY" | string;
type KnowledgeGroup = "ALL" | "COMPANY" | "CUSTOMERS" | "BRAND" | "DECISIONS" | "WORK";

const knowledgeGroups: Array<{ key: KnowledgeGroup; label: string; types: MemoryType[] }> = [
  { key: "ALL", label: "Everything", types: [] },
  { key: "COMPANY", label: "Company basics", types: ["COMPANY_FACT"] },
  { key: "CUSTOMERS", label: "Customers", types: ["CUSTOMER_INSIGHT"] },
  { key: "BRAND", label: "Brand", types: ["BRAND_RULE"] },
  { key: "DECISIONS", label: "Decisions & policies", types: ["DECISION", "POLICY"] },
  { key: "WORK", label: "How we work", types: ["SOP", "LESSON"] },
];

export function PlaybookList() {
  const viewer = useViewer();
  const owner = Boolean(viewer && isOwner(viewer));
  const [company, setCompany] = useState<Company | null>(null);
  const [memories, setMemories] = useState<HydratedMemory[]>([]);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");
  const [groupFilter, setGroupFilter] = useState<KnowledgeGroup>("ALL");
  const [status, setStatus] = useState("Loading company knowledge…");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createScope, setCreateScope] = useState<KnowledgeScope>({ level: "COMPANY" });

  useEffect(() => {
    Promise.all([
      apiRequest<HydratedMemory[]>("/api/memories"),
      apiRequest<Company>("/api/company"),
    ]).then(([items, companyResult]) => {
      setMemories(items);
      setCompany(companyResult);
      setStatus("");
    }).catch(() => setStatus("Could not load company knowledge. Try refreshing the page."));
  }, []);

  const scopedMemories = useMemo(() => memories.filter((memory) => (
    scopeFilter === "ALL"
      || (scopeFilter === "COMPANY" && memory.record.scope.level === "COMPANY")
      || memory.record.scope.organizationalUnitId === scopeFilter
  )), [memories, scopeFilter]);

  const visible = useMemo(() => scopedMemories.filter((memory) => {
    const matchesQuery = `${memory.version.title} ${memory.version.statement}`.toLowerCase().includes(query.toLowerCase());
    const group = knowledgeGroups.find((item) => item.key === groupFilter);
    return matchesQuery && (!group || group.key === "ALL" || group.types.includes(memory.record.type));
  }), [groupFilter, query, scopedMemories]);

  function beginCreate(scope: KnowledgeScope): void {
    setCreateScope(scope);
    setDialogOpen(true);
  }

  function scopeName(memory: HydratedMemory): string {
    if (memory.record.scope.level === "COMPANY") return "Entire company";
    return company?.organizationalUnits.find((unit) => unit.id === memory.record.scope.organizationalUnitId)?.name ?? "Department";
  }

  return (
    <main className="knowledge-workspace">
      <aside className="knowledge-tree-panel">
        <div className="knowledge-tree-heading">
          <div>
            <p className="page-kicker">Company Playbook</p>
            <h1>Knowledge</h1>
          </div>
          {owner && <button aria-label="Create knowledge page" className="icon-button" onClick={() => beginCreate({ level: "COMPANY" })} type="button">＋</button>}
        </div>

        <label className="knowledge-search">
          <span className="sr-only">Search company knowledge</span>
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Search knowledge" type="search" value={query} />
        </label>

        <nav aria-label="Knowledge hierarchy" className="knowledge-tree">
          <button aria-current={scopeFilter === "ALL" ? "page" : undefined} onClick={() => setScopeFilter("ALL")} type="button">
            <BrandMark className="size-5" />
            <span>All knowledge</span>
            <small>{memories.length}</small>
          </button>

          <div className="knowledge-tree-group">
            <div className="knowledge-tree-row">
              <button aria-current={scopeFilter === "COMPANY" ? "page" : undefined} onClick={() => setScopeFilter("COMPANY")} type="button">
                <span aria-hidden="true">⌂</span>
                <span>{company?.name ?? "Company"}</span>
                <small>{memories.filter((memory) => memory.record.scope.level === "COMPANY").length}</small>
              </button>
              {owner && <button aria-label="Create company knowledge" onClick={() => beginCreate({ level: "COMPANY" })} type="button">＋</button>}
            </div>

            {company?.organizationalUnits.filter((unit) => unit.type === "DEPARTMENT").map((unit) => (
              <div className="knowledge-tree-row knowledge-tree-child" key={unit.id}>
                <button aria-current={scopeFilter === unit.id ? "page" : undefined} onClick={() => setScopeFilter(unit.id)} type="button">
                  <span aria-hidden="true">›</span>
                  <span>{unit.name}</span>
                  <small>{memories.filter((memory) => memory.record.scope.organizationalUnitId === unit.id).length}</small>
                </button>
                {owner && <button aria-label={`Create knowledge for ${unit.name}`} onClick={() => beginCreate({ level: "DEPARTMENT", organizationalUnitId: unit.id })} type="button">＋</button>}
              </div>
            ))}
          </div>
        </nav>

        <div className="knowledge-tree-footer">
          <strong>Approved knowledge only</strong>
          <span>Suggestions stay in Review until an owner decides.</span>
        </div>
      </aside>

      <section className="knowledge-index-pane">
        <header className="knowledge-index-header">
          <div>
            <p className="page-kicker">Trusted and reusable</p>
            <h2>Approved company knowledge</h2>
            <p>Pages your team and assistants can rely on.</p>
          </div>
          {owner && <button className="primary-button" onClick={() => beginCreate(scopeFilter !== "ALL" && scopeFilter !== "COMPANY"
            ? { level: "DEPARTMENT", organizationalUnitId: scopeFilter }
            : { level: "COMPANY" })} type="button">New page</button>}
        </header>

        <nav aria-label="Knowledge topics" className="knowledge-topic-nav">
          {knowledgeGroups.map((group) => (
            <button
              aria-current={groupFilter === group.key ? "page" : undefined}
              key={group.key}
              onClick={() => setGroupFilter(group.key)}
              type="button"
            >
              <span>{group.label}</span>
              <small>{group.key === "ALL"
                ? scopedMemories.length
                : scopedMemories.filter((memory) => group.types.includes(memory.record.type)).length}</small>
            </button>
          ))}
        </nav>

        <div className="knowledge-table-header" aria-hidden="true">
          <span>Page</span><span>Scope</span><span>Updated</span>
        </div>
        <div className="knowledge-page-list">
          {visible.map((memory) => (
            <Link href={`/playbook/${memory.record.id}`} key={memory.record.id}>
              <div className="knowledge-page-title">
                <BrandMark className="size-7" />
                <div>
                  <strong>{memory.version.title}</strong>
                  <span>{memory.version.statement}</span>
                </div>
              </div>
              <span className="knowledge-scope-chip">{scopeName(memory)}</span>
              <span className="knowledge-page-date">V{memory.version.version} · {new Date(memory.version.approvedAt).toLocaleDateString()}</span>
            </Link>
          ))}
          {visible.length === 0 && !status && (
            <div className="knowledge-empty-state">
              <BrandMark className="size-12" />
              <h3>{query || groupFilter !== "ALL" ? "No matching pages" : "No knowledge here yet"}</h3>
              <p>{query || groupFilter !== "ALL" ? "Try another topic or a shorter search." : "Create the first approved page for this part of the company."}</p>
              {owner && <div className="flex flex-wrap justify-center gap-3">
                <Link className="primary-button" href="/onboarding">Bring in company context</Link>
                <button className="secondary-button" onClick={() => beginCreate({ level: "COMPANY" })} type="button">Create a page</button>
              </div>}
            </div>
          )}
        </div>
        <p aria-live="polite" className="knowledge-status">{status}</p>
      </section>

      {dialogOpen && <KnowledgePageDialog
        company={company}
        initialScope={createScope}
        onClose={() => setDialogOpen(false)}
        onSaved={(memory) => {
          setMemories((current) => [memory, ...current]);
          setDialogOpen(false);
          setScopeFilter(memory.record.scope.level === "COMPANY" ? "COMPANY" : memory.record.scope.organizationalUnitId ?? "ALL");
          setStatus(`Saved “${memory.version.title}”.`);
        }}
      />}
    </main>
  );
}
