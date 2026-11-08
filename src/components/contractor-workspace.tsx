'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Clock3, Hammer, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';

type TradeStatus = 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | 'BLOCKED';
type Trade = { id: string; trade: string; company: string; contact?: string; phone?: string; status: TradeStatus };
type Task = { id: string; title: string; tradeId: string; due: string; dependsOn: string[]; note?: string };
type Message = { id: string; sourceTaskId: string; body: string; status: string; createdAt: string };
type Workspace = { mode?: string; viewer: { tradeId: string; trade: string; company: string; contact: string }; job: { id: string; name: string; address: string | null; status: string }; trades: Trade[]; tasks: Task[]; messages: Message[] };

const statusLabel: Record<TradeStatus, string> = { ON_TRACK: 'On track', AT_RISK: 'At risk', DELAYED: 'Delayed', BLOCKED: 'Blocked' };

function statusClass(status: TradeStatus) {
  return status === 'ON_TRACK' ? 'green' : status === 'AT_RISK' ? 'amber' : 'red';
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export default function ContractorWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const response = await fetch('/api/mills/contractor', { cache: 'no-store' });
    if (!response.ok) throw new Error('Workspace unavailable');
    const data = await response.json() as Workspace;
    setWorkspace(data);
  }

  useEffect(() => { void refresh().catch(() => setNotice('The pilot workspace is unavailable right now.')); }, []);

  const selectedTrade = workspace ? (workspace.trades.find(trade => trade.id === workspace.viewer.tradeId) ?? workspace.trades[0]) : undefined;
  const myTasks = useMemo(() => workspace?.tasks.filter(task => task.tradeId === selectedTrade?.id) ?? [], [workspace, selectedTrade?.id]);
  const upstream = useMemo(() => {
    if (!workspace || !selectedTrade) return [];
    const dependencies = new Set(myTasks.flatMap(task => task.dependsOn));
    return workspace.tasks.filter(task => dependencies.has(task.id));
  }, [workspace, selectedTrade, myTasks]);
  const impacted = useMemo(() => {
    if (!workspace || !selectedTrade) return [];
    const delayed = new Set(workspace.trades.filter(trade => trade.status === 'DELAYED' || trade.status === 'BLOCKED').map(trade => trade.id));
    return workspace.tasks.filter(task => task.tradeId === selectedTrade.id && task.dependsOn.some(dependency => {
      const source = workspace.tasks.find(candidate => candidate.id === dependency);
      return Boolean(source && delayed.has(source.tradeId));
    }));
  }, [workspace, selectedTrade]);

  async function updateStatus(status: TradeStatus) {
    if (!selectedTrade) return;
    setSaving(true);
    try {
      const response = await fetch('/api/mills/contractor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateStatus', status }) });
      if (!response.ok) throw new Error('Status update failed');
      await refresh();
      setNotice('Your status was saved to the pilot workspace. No message was sent.');
    } catch {
      setNotice('Status could not be saved. Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  if (!workspace || !selectedTrade) return <main className="contractor-page"><div className="contractor-loading"><Sparkles size={18}/><span>Loading your Mills workspace...</span></div></main>;

  return <main className="contractor-page">
    <header className="contractor-header">
      <div>
        <a className="mills-wordmark" href="/hq" aria-label="Back to Mills headquarters">mills<span>.</span></a>
        <div className="eyebrow"><span className="eyebrow-rule"/> CONTRACTOR WORKSPACE · MOCK PILOT</div>
        <h1>Your work, without the group-text scramble.</h1>
        <p>{workspace.job.name} · {workspace.job.address || 'Toronto, ON'}</p>
      </div>
      <div className="contractor-header-actions"><span className="badge green"><ShieldCheck size={12}/> Human-approved coordination</span><a className="button secondary" href="/hq"><ArrowLeft size={14}/> Mills HQ</a></div>
    </header>

    <div className="mills-notice" role="status" aria-live="polite"><Sparkles size={17}/><span><strong>Contractor preview.</strong> This safe pilot uses one local demo session. Your status is saved for the GC to review. Mills does not send SMS or email from this screen.</span></div>
    {notice && <div className="notice" role="status" aria-live="polite">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}

    <section className="contractor-context panel">
      <div><span className="contractor-kicker">YOUR TRADE</span><h2>{workspace.viewer.company}</h2><p>{workspace.viewer.trade} · {workspace.viewer.contact} · {workspace.job.name}</p></div>
      <span className="badge green">Scoped to this workspace</span>
    </section>

    <section className="contractor-stats">
      <article className="panel"><small>My next handoff</small><strong>{myTasks[0] ? formatDate(myTasks[0].due) : 'No task'}</strong><span>{myTasks[0]?.title || 'Nothing due right now'}</span></article>
      <article className="panel"><small>Schedule status</small><strong className={statusClass(selectedTrade.status)}>{statusLabel[selectedTrade.status]}</strong><span>Last update is shared with the GC</span></article>
      <article className="panel"><small>Upstream work</small><strong>{upstream.length}</strong><span>Dependencies to keep an eye on</span></article>
      <article className="panel"><small>Messages</small><strong>{workspace.messages.length}</strong><span>Approved updates in this pilot</span></article>
    </section>

    <div className="contractor-grid">
      <section className="panel contractor-panel">
        <div className="section-heading"><div><h2>My schedule</h2><p className="muted">The next handoff is always visible here.</p></div><CalendarDays size={18}/></div>
        <div className="contractor-task-list">{myTasks.map(task => <article className="contractor-task" key={task.id}><div className="contractor-task-date"><strong>{formatDate(task.due)}</strong><small>Due date</small></div><div><strong>{task.title}</strong><small>{task.dependsOn.length ? `After ${upstream.find(item => item.id === task.dependsOn[0])?.title || 'upstream work'}` : 'No dependency'}</small></div><span className="badge green">Planned</span></article>)}{!myTasks.length && <div className="mills-empty"><Check size={24}/><strong>No tasks assigned yet</strong><span>The GC will add your next handoff here.</span></div>}</div>
      </section>

      <aside className="contractor-side-stack">
        <section className="panel contractor-panel"><div className="section-heading"><div><h2>Update the GC</h2><p className="muted">One quick status check keeps the next crew moving.</p></div><Hammer size={18}/></div><label className="contractor-status-label">Current status<select aria-label="Current status" value={selectedTrade.status} disabled={saving} onChange={event => void updateStatus(event.target.value as TradeStatus)}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="contractor-safe-note"><Clock3 size={15}/><span>Changes are saved for review. Nothing is sent automatically.</span></div></section>
        <section className="panel contractor-panel"><div className="section-heading"><div><h2>Heads up</h2><p className="muted">What could affect your handoff.</p></div><MessageSquare size={18}/></div>{impacted.length ? impacted.map(task => <article className="contractor-alert" key={task.id}><span className="badge red">Needs attention</span><strong>{task.title}</strong><p>An upstream trade is delayed or blocked. Check with the GC before your crew arrives.</p></article>) : <div className="mills-empty"><Check size={24}/><strong>No blockers right now</strong><span>Mills will surface a change before it reaches your crew.</span></div>}</section>
      </aside>
    </div>

    <footer className="mills-footer"><span>Mills contractor workspace</span><span>Mock pilot · no outbound messages · GC approval remains required</span></footer>
  </main>;
}
