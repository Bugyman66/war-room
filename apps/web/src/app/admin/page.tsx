"use client";

import { useEffect, useState } from 'react';
import { Save, AlertTriangle, CheckCircle2, Plus, Trash2, RotateCcw } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface NarrativeRule {
  id: string;
  title: string;
  keywords: string[];
}

interface ConfigResponse {
  promptTemplate: string;
  narrativeRules: NarrativeRule[];
  defaults: { promptTemplate: string; narrativeRules: NarrativeRule[] };
}

type Status = { kind: 'idle' | 'ok' | 'err'; msg: string };

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [prompt, setPrompt] = useState('');
  const [rules, setRules] = useState<NarrativeRule[]>([]);
  const [defaults, setDefaults] = useState<ConfigResponse['defaults'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptStatus, setPromptStatus] = useState<Status>({ kind: 'idle', msg: '' });
  const [rulesStatus, setRulesStatus] = useState<Status>({ kind: 'idle', msg: '' });

  useEffect(() => {
    setToken(localStorage.getItem('warroom_admin_token') || '');
    fetch(`${API}/api/config`)
      .then(res => res.json())
      .then((data: ConfigResponse) => {
        setPrompt(data.promptTemplate);
        setRules(data.narrativeRules);
        setDefaults(data.defaults);
      })
      .catch(err => setPromptStatus({ kind: 'err', msg: `Load failed: ${err}` }))
      .finally(() => setLoading(false));
  }, []);

  const saveToken = (t: string) => {
    setToken(t);
    localStorage.setItem('warroom_admin_token', t);
  };

  async function savePrompt() {
    setPromptStatus({ kind: 'idle', msg: 'Saving...' });
    try {
      const res = await fetch(`${API}/api/config/prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ promptTemplate: prompt }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || res.statusText);
      setPromptStatus({ kind: 'ok', msg: 'Prompt saved. Applies on next AI cycle.' });
    } catch (err) {
      setPromptStatus({ kind: 'err', msg: String((err as Error).message) });
    }
  }

  async function saveRules() {
    setRulesStatus({ kind: 'idle', msg: 'Saving...' });
    try {
      const res = await fetch(`${API}/api/config/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ narrativeRules: rules }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || res.statusText);
      setRulesStatus({ kind: 'ok', msg: 'Rules saved. Applies to newly ingested signals.' });
    } catch (err) {
      setRulesStatus({ kind: 'err', msg: String((err as Error).message) });
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#050505] text-green-500 font-mono p-8">Loading config...</div>;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-mono text-sm p-6 flex flex-col gap-6">
      <header className="border-b border-[#1a1a1a] pb-3 flex justify-between items-start">
        <div>
          <h1 className="text-white text-lg font-bold uppercase tracking-widest">War Room — Admin Config</h1>
          <p className="text-gray-600 text-xs mt-1">Edit the AI prompt and narrative rules. Changes are stored in Postgres and picked up live by the workers.</p>
        </div>
        <a href="/" className="flex items-center gap-2 text-xs text-gray-400 hover:text-green-500 border border-[#1a1a1a] hover:border-green-700 px-3 py-2 transition-colors">
          <RotateCcw className="w-3 h-3 rotate-180" /> Return to Dashboard
        </a>
      </header>

      <section className="flex flex-col gap-2 max-w-md">
        <label className="text-gray-500 uppercase text-xs">Admin Token (x-admin-token)</label>
        <input
          type="password"
          value={token}
          onChange={e => saveToken(e.target.value)}
          placeholder="ADMIN_TOKEN from .env"
          className="bg-[#0a0a0a] border border-[#1a1a1a] px-3 py-2 text-green-400 focus:border-green-700 outline-none"
        />
      </section>

      {/* PROMPT EDITOR */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-gray-400 uppercase text-xs font-bold">AI Prompt Template</label>
          <div className="flex gap-2">
            {defaults && (
              <button onClick={() => setPrompt(defaults.promptTemplate)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-500 border border-[#1a1a1a] px-2 py-1">
                <RotateCcw className="w-3 h-3" /> Reset to default
              </button>
            )}
            <button onClick={savePrompt} className="flex items-center gap-1 text-xs text-black bg-green-500 hover:bg-green-400 px-3 py-1 font-bold">
              <Save className="w-3 h-3" /> Save Prompt
            </button>
          </div>
        </div>
        <p className="text-gray-600 text-xs">Must include <code className="text-green-600">{'{{title}}'}</code> and <code className="text-green-600">{'{{signals}}'}</code> placeholders.</p>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={12}
          className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 text-gray-300 focus:border-green-700 outline-none leading-relaxed"
        />
        <StatusLine status={promptStatus} />
      </section>

      {/* RULES EDITOR */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-gray-400 uppercase text-xs font-bold">Narrative Rules ({rules.length})</label>
          <div className="flex gap-2">
            {defaults && (
              <button onClick={() => setRules(defaults.narrativeRules)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-500 border border-[#1a1a1a] px-2 py-1">
                <RotateCcw className="w-3 h-3" /> Reset to default
              </button>
            )}
            <button onClick={() => setRules([...rules, { id: `rule_${Date.now()}`, title: 'New Narrative', keywords: [] }])} className="flex items-center gap-1 text-xs text-gray-300 border border-[#1a1a1a] hover:border-green-700 px-2 py-1">
              <Plus className="w-3 h-3" /> Add Rule
            </button>
            <button onClick={saveRules} className="flex items-center gap-1 text-xs text-black bg-green-500 hover:bg-green-400 px-3 py-1 font-bold">
              <Save className="w-3 h-3" /> Save Rules
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {rules.map((rule, i) => (
            <div key={i} className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <input
                  value={rule.id}
                  onChange={e => setRules(rules.map((r, j) => j === i ? { ...r, id: e.target.value } : r))}
                  placeholder="id"
                  className="bg-black border border-[#1a1a1a] px-2 py-1 text-gray-500 w-48 text-xs"
                />
                <input
                  value={rule.title}
                  onChange={e => setRules(rules.map((r, j) => j === i ? { ...r, title: e.target.value } : r))}
                  placeholder="title"
                  className="bg-black border border-[#1a1a1a] px-2 py-1 text-white flex-1"
                />
                <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-red-600 hover:text-red-400 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={rule.keywords.join(', ')}
                onChange={e => setRules(rules.map((r, j) => j === i ? { ...r, keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) } : r))}
                placeholder="comma, separated, keywords"
                rows={2}
                className="bg-black border border-[#1a1a1a] px-2 py-1 text-green-400 text-xs"
              />
            </div>
          ))}
        </div>
        <StatusLine status={rulesStatus} />
      </section>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (!status.msg) return null;
  const color = status.kind === 'ok' ? 'text-green-500' : status.kind === 'err' ? 'text-red-500' : 'text-gray-500';
  const Icon = status.kind === 'ok' ? CheckCircle2 : status.kind === 'err' ? AlertTriangle : null;
  return (
    <div className={`flex items-center gap-2 text-xs ${color}`}>
      {Icon && <Icon className="w-3 h-3" />} {status.msg}
    </div>
  );
}

