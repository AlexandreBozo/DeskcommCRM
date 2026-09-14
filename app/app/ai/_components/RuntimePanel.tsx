"use client";

import { useEffect, useState } from "react";

type Capability =
  | "system.runtime.info"
  | "tenant.context.summary"
  | "tenant.capabilities.list";

type RuntimeStatus = {
  status: string;
  mode: string;
  capabilities: string[];
  tenant_id: string;
};

const ITEMS: Array<{ id: Capability; label: string }> = [
  { id: "system.runtime.info", label: "Runtime" },
  { id: "tenant.context.summary", label: "Contexto do tenant" },
  { id: "tenant.capabilities.list", label: "Capabilities" },
];

export function RuntimePanel() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [running, setRunning] = useState<Capability | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/v1/ai/runtime", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Falha ao ler o runtime.");
        setStatus(body.data as RuntimeStatus);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Falha ao ler o runtime.");
      });
  }, []);

  async function run(capability: Capability) {
    try {
      setRunning(capability);
      setError(null);
      const res = await fetch("/api/v1/ai/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability, input: {} }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Execução falhou.");
      setResult(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao executar.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <section className="rounded-2xl border p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Coagentica OS</p>
          <h2 className="text-xl font-semibold">Runtime nativo</h2>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs">
          {status ? `${status.status} • ${status.mode}` : "verificando"}
        </span>
      </div>

      {status && (
        <p className="mt-3 text-xs text-muted-foreground">
          Tenant: <span className="font-mono">{status.tenant_id}</span>
        </p>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void run(item.id)}
            disabled={running !== null}
            className="rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {running === item.id ? "Executando..." : item.label}
          </button>
        ))}
      </div>

      {result !== null && (
        <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-muted p-4 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
