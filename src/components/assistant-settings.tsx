"use client";

import { useEffect, useState } from "react";
import type { AssistantModelTier, AssistantSettings } from "@/domain/types";
import { apiRequest } from "@/lib/api";

export function AssistantSettingsPanel() {
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [selectedTier, setSelectedTier] = useState<AssistantModelTier>("BALANCED");
  const [status, setStatus] = useState("Loading assistant settings…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void apiRequest<AssistantSettings>("/api/company/assistant-settings")
      .then((value) => {
        if (!active) return;
        setSettings(value);
        setSelectedTier(value.modelTier);
        setStatus("");
      })
      .catch(() => {
        if (active) setStatus("We could not load assistant settings. Try refreshing the page.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(): Promise<void> {
    setSaving(true);
    setStatus("Saving assistant choice…");
    try {
      const updated = await apiRequest<AssistantSettings>("/api/company/assistant-settings", {
        method: "PATCH",
        body: JSON.stringify({ modelTier: selectedTier }),
      });
      setSettings(updated);
      setSelectedTier(updated.modelTier);
      setStatus("Assistant choice saved. Your next request will use it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "We could not save this assistant choice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 border-y-2 border-[var(--graphite)] bg-white p-5 sm:p-7" id="assistant-settings">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="page-kicker">Assistant settings</p>
          <h2 className="mt-2 text-3xl font-black uppercase sm:text-4xl">Choose how your assistant works</h2>
          <p className="mt-3 leading-7 text-[var(--muted)]">
            This company-wide choice applies to the next assistant request. It does not change earlier messages.
          </p>
        </div>
        <button
          className="primary-button w-fit"
          disabled={saving || !settings || selectedTier === settings.modelTier}
          onClick={() => void save()}
          type="button"
        >
          {saving ? "Saving…" : "Save choice"}
        </button>
      </div>

      {settings && <fieldset className="mt-6 grid gap-3 md:grid-cols-3" disabled={saving}>
        <legend className="sr-only">Assistant model</legend>
        {settings.options.map((option) => {
          const selected = selectedTier === option.tier;
          return <label
            className={`cursor-pointer border p-4 transition-colors ${selected ? "border-[var(--cobalt)] bg-[var(--cobalt-soft)]" : "border-[var(--border-strong)]"}`}
            key={option.tier}
          >
            <span className="flex items-center gap-3">
              <input
                checked={selected}
                name="assistant-model-tier"
                onChange={() => setSelectedTier(option.tier)}
                type="radio"
                value={option.tier}
              />
              <span className="text-lg font-black">{option.label}</span>
            </span>
            <span className="mt-3 block text-sm leading-6 text-[var(--muted)]">{option.description}</span>
            <span className="metadata mt-3 block text-xs font-bold text-[var(--cobalt)]">OpenAI · {option.modelId}</span>
          </label>;
        })}
      </fieldset>}

      <p aria-live="polite" className="mt-4 min-h-6 text-sm font-bold text-[var(--muted)]">{status}</p>
    </section>
  );
}
