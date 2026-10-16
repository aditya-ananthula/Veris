const fs = require("fs");
const content = `import { useEffect, useState } from "react";
import { Server, KeyRound, Database, Shield, Layout, Palette, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { Card, Button, Badge, ErrorBanner } from "../components/ui";
import type { Capabilities, Health } from "../types";

export function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"general" | "api" | "appearance" | "data" | "danger">("general");

  useEffect(() => {
    Promise.all([api.health(), api.capabilities()])
      .then(([h, c]) => {
        setHealth(h);
        setCaps(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to reach backend."));
  }, []);

  const tabs = [
    { id: "general", label: "General", icon: Layout },
    { id: "api", label: "API Keys", icon: KeyRound },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "data", label: "Data", icon: Database },
    { id: "danger", label: "Danger Zone", icon: Trash2 },
  ];

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">Settings & system status</h2>
        <p className="mt-1 text-sm text-slate-400">
          Live backend configuration. Secrets are never exposed to the browser.
        </p>
      </div>
      {error && <ErrorBanner message={error} />}

      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as "general" | "api" | "appearance" | "data" | "danger")}
            className={
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 border " +
              (activeTab === t.id
                ? "bg-accent-500/10 border-accent-500/20 text-accent-400"
                : "border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200 hover:border-slate-600/50")
            }
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {activeTab === "general" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Server size={16} className="text-accent-400" /> Backend status
              </h3>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-slate-950 px-3 py-2 border border-slate-700/40">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Status</dt>
                  <dd className="text-slate-200">{health?.status ?? "—"}</dd>
                </div>
                <div className="rounded-lg bg-slate-950 px-3 py-2 border border-slate-700/40">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">App</dt>
                  <dd className="text-slate-200">{health?.app ?? "—"}</dd>
                </div>
                <div className="rounded-lg bg-slate-950 px-3 py-2 border border-slate-700/40">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Model</dt>
                  <dd className="text-slate-200">{caps?.llm_model ?? health?.model ?? "—"}</dd>
                </div>
                <div className="rounded-lg bg-slate-950 px-3 py-2 border border-slate-700/40">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Persistence</dt>
                  <dd className="text-slate-200">{caps?.persistence ?? "ephemeral-in-memory"}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Shield size={16} className="text-accent-400" /> Security
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {caps?.groq_configured ?? health?.groq_configured
                  ? "LLM provider key is configured on the backend."
                  : "LLM provider key is NOT configured — questions will fail until GROQ_API_KEY is set server-side."}
              </p>
            </div>
          </div>
        )}

        {activeTab === "api" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <KeyRound size={16} className="text-accent-400" /> API configuration
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Backend API keys are managed server-side. This page shows connection status only.
              </p>
            </div>
            <div className="rounded-lg bg-slate-950 p-4 border border-slate-700/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300">GROQ API Key</span>
                <Badge variant={caps?.groq_configured ? "success" : "error"}>
                  {caps?.groq_configured ? "Configured" : "Not configured"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Set GROQ_API_KEY on the backend to enable document intelligence features.
              </p>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Palette size={16} className="text-accent-400" /> Theme
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-4">
                  <div className="flex items-center gap-2">
                    <input type="radio" name="theme" defaultChecked className="accent-accent-500" />
                    <label className="text-sm text-slate-200">Dark (Intelligence Console)</label>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Dark slate theme with cyan accents</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Database size={16} className="text-accent-400" /> Storage & sessions
              </h3>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-slate-950 px-3 py-2 border border-slate-700/40">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Max upload</dt>
                  <dd className="text-slate-200">{caps?.max_upload_mb ?? 10} MB</dd>
                </div>
                <div className="rounded-lg bg-slate-950 px-3 py-2 border border-slate-700/40">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Session TTL</dt>
                  <dd className="text-slate-200">{caps ? Math.round(caps.session_ttl_seconds / 60) : 60} minutes</dd>
                </div>
                <div className="rounded-lg bg-slate-950 px-3 py-2 border border-slate-700/40">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Supported types</dt>
                  <dd className="text-slate-200">{caps?.supported_extensions.join(", ") ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {activeTab === "danger" && (
          <div className="space-y-6">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
              <h3 className="text-sm font-semibold text-red-300 flex items-center gap-2">
                <Trash2 size={16} className="text-red-400" /> Danger zone
              </h3>
              <p className="mt-1 text-sm text-red-400/80">
                These actions are permanent and cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1">
                Clear all documents
              </Button>
              <Button variant="danger" className="flex-1">
                Reset session
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
`;
fs.writeFileSync("c:/Projects/Veris/frontend/src/pages/SettingsPage.tsx", content, "utf8");
console.log("SettingsPage written");

