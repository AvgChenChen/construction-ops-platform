'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clipboard, ClipboardList, Hammer, MessageSquare, Plus, ShieldCheck, Sparkles, Users, X } from 'lucide-react';

type TradeStatus = 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | 'BLOCKED';
type DiscoveryStatus = 'PROSPECT' | 'SCHEDULED' | 'INTERVIEWED' | 'PILOT' | 'NOT_NOW';
type Tab = 'board' | 'discovery' | 'pricing';

type Trade = {
  id: string;
  trade: string;
  company: string;
  contact: string;
  phone: string;
  status: TradeStatus;
};

type Task = {
  id: string;
  title: string;
  tradeId: string;
  due: string;
  dependsOn: string[];
  note?: string;
};

type DiscoveryContact = {
  id: string;
  name: string;
  company: string;
  role: string;
  city: string;
  email: string;
  status: DiscoveryStatus;
  callDate: string;
  pain: number;
  notes: string;
  nextStep: string;
};

type PersistedMessage = { sourceTaskId: string; status: string };

const initialTrades: Trade[] = [
  { id: 'plumbing', trade: 'Plumbing', company: 'Anson Plumbing', contact: 'Anson', phone: '+1 647 555 0101', status: 'ON_TRACK' },
  { id: 'electrical', trade: 'Electrical', company: 'Northline Electrical', contact: 'Maya', phone: '+1 416 555 0102', status: 'ON_TRACK' },
  { id: 'drywall', trade: 'Drywall', company: 'West End Drywall', contact: 'Chris', phone: '+1 416 555 0103', status: 'ON_TRACK' },
  { id: 'painting', trade: 'Painting', company: 'Lakeshore Finishes', contact: 'Jordan', phone: '+1 416 555 0104', status: 'ON_TRACK' },
];

const initialTasks: Task[] = [
  { id: 'rough-plumbing', title: 'Rough plumbing complete', tradeId: 'plumbing', due: '2026-11-12', dependsOn: [] },
  { id: 'rough-electrical', title: 'Rough electrical complete', tradeId: 'electrical', due: '2026-11-14', dependsOn: ['rough-plumbing'] },
  { id: 'drywall-close', title: 'Close walls and hang drywall', tradeId: 'drywall', due: '2026-11-18', dependsOn: ['rough-electrical'] },
  { id: 'paint-ready', title: 'Prime and paint main floor', tradeId: 'painting', due: '2026-11-22', dependsOn: ['drywall-close'] },
];

const initialContacts: DiscoveryContact[] = [
  { id: 'discovery-1', name: 'Design partner candidate', company: 'Toronto Renovation Co.', role: 'Owner / GC', city: 'Toronto', email: '', status: 'SCHEDULED', callDate: '2026-11-07T10:00', pain: 4, notes: 'Currently uses a spreadsheet and group texts for trade updates.', nextStep: 'Ask for a live-job walkthrough' },
  { id: 'discovery-2', name: 'Warm referral', company: 'Pacific Build Group', role: 'Project Manager', city: 'Vancouver', email: '', status: 'PROSPECT', callDate: '', pain: 0, notes: '', nextStep: 'Send a short interview request' },
];

const storageKey = 'mills-pilot-v1';
const statusLabel: Record<TradeStatus, string> = { ON_TRACK: 'On track', AT_RISK: 'At risk', DELAYED: 'Delayed', BLOCKED: 'Blocked' };
const discoveryLabel: Record<DiscoveryStatus, string> = { PROSPECT: 'Prospect', SCHEDULED: 'Scheduled', INTERVIEWED: 'Interviewed', PILOT: 'Pilot', NOT_NOW: 'Not now' };

function loadState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(`${storageKey}-${key}`);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function statusClass(status: TradeStatus) {
  return status === 'ON_TRACK' ? 'green' : status === 'AT_RISK' ? 'amber' : 'red';
}

export default function MillsPilot() {
  const [tab, setTab] = useState<Tab>('board');
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [contacts, setContacts] = useState<DiscoveryContact[]>(initialContacts);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [jobId, setJobId] = useState('');
  const [persistedMessages, setPersistedMessages] = useState<PersistedMessage[]>([]);
  const [serverBacked, setServerBacked] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState<string | null>(null);

  async function refreshWorkspace() {
    setWorkspaceReady(false);
    try {
      const response = await fetch('/api/mills', { cache: 'no-store' });
      if (!response.ok) throw new Error('Mills workspace unavailable');
      const data = await response.json() as { job: { id: string }; trades: Trade[]; tasks: Task[]; contacts: DiscoveryContact[]; messages: PersistedMessage[] };
      setJobId(data.job.id);
      setTrades(data.trades);
      setTasks(data.tasks);
      setContacts(data.contacts);
      setPersistedMessages(data.messages ?? []);
      setServerBacked(true);
      return true;
    } catch {
      setServerBacked(false);
      return false;
    } finally {
      setWorkspaceReady(true);
    }
  }

  async function persist(input: Record<string, unknown>) {
    if (!serverBacked) return null;
    try {
      const response = await fetch('/api/mills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error('Mills sync unavailable');
      return await response.json() as Record<string, unknown>;
    } catch {
      setServerBacked(false);
      setNotice('Saved in this browser. Server sync is unavailable right now.');
      return null;
    }
  }

  useEffect(() => {
    setTrades(loadState('trades', initialTrades));
    setTasks(loadState('tasks', initialTasks));
    setContacts(loadState('contacts', initialContacts));
    setApproved(loadState('approved', {}));
    setSent(loadState('sent', {}));
    void refreshWorkspace();
  }, []);
  useEffect(() => { window.localStorage.setItem(`${storageKey}-trades`, JSON.stringify(trades)); }, [trades]);
  useEffect(() => { window.localStorage.setItem(`${storageKey}-tasks`, JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { window.localStorage.setItem(`${storageKey}-contacts`, JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { window.localStorage.setItem(`${storageKey}-approved`, JSON.stringify(approved)); }, [approved]);
  useEffect(() => { window.localStorage.setItem(`${storageKey}-sent`, JSON.stringify(sent)); }, [sent]);
  const impacted = useMemo(() => {
    const blockedTaskIds = new Set(tasks.filter(task => trades.find(t => t.id === task.tradeId)?.status === 'DELAYED' || trades.find(t => t.id === task.tradeId)?.status === 'BLOCKED').map(task => task.id));
    const dependents = new Map<string, string[]>();
    for (const task of tasks) for (const dependency of task.dependsOn) dependents.set(dependency, [...(dependents.get(dependency) ?? []), task.id]);
    const result = new Map<string, { task: Task; causedBy: Task }>();
    const queue = [...blockedTaskIds];
    const seen = new Set(queue);
    while (queue.length) {
      const sourceId = queue.shift()!;
      for (const dependentId of dependents.get(sourceId) ?? []) {
        if (seen.has(dependentId)) continue;
        seen.add(dependentId);
        const task = tasks.find(candidate => candidate.id === dependentId);
        const cause = tasks.find(candidate => candidate.id === sourceId);
        if (task && cause) result.set(task.id, { task, causedBy: cause });
        queue.push(dependentId);
      }
    }
    return [...result.values()];
  }, [tasks, trades]);

  useEffect(() => {
    if (!persistedMessages.length || !impacted.length) return;
    const sourceIds = new Set(persistedMessages.filter(message => message.status === 'SENT_MOCK').map(message => message.sourceTaskId));
    setSent(current => {
      const next = { ...current };
      for (const item of impacted) if (sourceIds.has(item.causedBy.id)) next[item.task.id] = true;
      return next;
    });
  }, [persistedMessages, impacted]);

  function updateTrade(id: string, status: TradeStatus) {
    setTrades(current => current.map(trade => trade.id === id ? { ...trade, status } : trade));
    void persist({ action: 'updateTrade', tradeId: id, status });
    setNotice(serverBacked ? 'Saved to Mills. No trade was contacted.' : 'Saved locally. No trade was contacted.');
  }

  function approveMessage(id: string) {
    setApproved(current => ({ ...current, [id]: !current[id] }));
  }

  function draftFor(match: { task: Task; causedBy: Task }) {
    const recipient = trades.find(trade => trade.id === match.task.tradeId);
    const sourceTrade = trades.find(trade => trade.id === match.causedBy.tradeId);
    return `Hi ${recipient?.contact ?? 'there'}, ${sourceTrade?.trade ?? 'A trade'} is currently ${statusLabel[sourceTrade?.status ?? 'DELAYED'].toLowerCase()} on the Bloor renovation. Can you confirm whether ${match.task.title.toLowerCase()} is still on track for ${match.task.due}?`;
  }

  async function copyDraft(id: string) {
    const match = impacted.find(item => item.task.id === id);
    if (!match) return;
    try {
      await navigator.clipboard.writeText(draftFor(match));
      setCopiedDraft(id);
      setNotice('Draft copied locally. No message was sent.');
    } catch {
      setNotice('Clipboard access is unavailable. Select the draft text manually. No message was sent.');
    }
  }

  async function sendMockMessage(id: string) {
    if (!approved[id]) return;
    const match = impacted.find(item => item.task.id === id);
    const source = match?.causedBy;
    if (serverBacked && jobId && source) {
      const recipient = trades.find(trade => trade.id === match.task.tradeId);
      const body = `Mills update for the Bloor renovation: ${source.title} is ${statusLabel[trades.find(trade => trade.id === source.tradeId)?.status ?? 'DELAYED'].toLowerCase()}. Can you confirm whether ${match.task.title.toLowerCase()} is still on track for ${match.task.due}?`;
      await persist({ action: 'recordMockMessage', jobId, sourceTaskId: source.id, recipientTradeIds: recipient ? [recipient.id] : [], body, approved: true });
    }
    setSent(current => ({ ...current, [id]: true }));
    setNotice('Mock update recorded. No SMS was sent.');
  }

  async function addContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const contact: DiscoveryContact = {
      id: `discovery-${Date.now()}`,
      name: String(form.get('name') || 'Unnamed contact'),
      company: String(form.get('company') || ''),
      role: String(form.get('role') || ''),
      city: String(form.get('city') || ''),
      email: String(form.get('email') || ''),
      status: 'PROSPECT',
      callDate: '',
      pain: 0,
      notes: '',
      nextStep: 'Send interview request',
    };
    setContacts(current => [contact, ...current]);
    const result = await persist({ action: 'addContact', name: contact.name, company: contact.company, role: contact.role, city: contact.city, email: contact.email });
    if (result?.id) setContacts(current => current.map(item => item.id === contact.id ? { ...item, id: String(result.id) } : item));
    setShowContactForm(false);
    setNotice(serverBacked ? 'Discovery contact saved to Mills.' : 'Discovery contact saved locally.');
  }

  function updateContact(id: string, patch: Partial<DiscoveryContact>) {
    setContacts(current => current.map(contact => contact.id === id ? { ...contact, ...patch } : contact));
  }

  function saveContact(id: string) {
    const contact = contacts.find(item => item.id === id);
    if (!contact) return;
    void persist({ action: 'updateContact', contactId: id, status: contact.status, nextStep: contact.nextStep, notes: contact.notes });
  }

  return <div className="mills-page">
    <header className="mills-header">
      <div>
        <a className="mills-wordmark" href="/mills" aria-label="Mills home">mills<span>.</span></a>
        <div className="eyebrow"><span className="eyebrow-rule"/> AI COORDINATION FOR CONSTRUCTION TRADES</div>
        <h1>Keep every trade in sync.</h1>
        <p>When one trade slips, Mills shows who is affected next, before the GC spends the morning on the phone.</p>
      </div>
      <div className="mills-header-actions"><span className="mills-console-label">// PILOT CONSOLE · TORONTO FIRST</span><a className="mills-hq-link" href="/hq">Open Mills HQ ↗</a><span className={`badge ${serverBacked ? 'green' : 'mock'}`} aria-live="polite">{serverBacked ? 'PERSISTED PILOT' : 'LOCAL MOCK'}</span><span className="badge green"><ShieldCheck size={12}/> Approval required</span></div>
    </header>

    <div className="mills-notice" role="status" aria-live="polite"><Sparkles size={17}/><span><strong>{!workspaceReady ? 'Loading pilot workspace.' : serverBacked ? 'Pilot workspace synced.' : 'Validation mode.'}</strong> {!workspaceReady ? 'Loading the latest local data before you make changes.' : serverBacked ? 'Changes are saved to the local Mills workspace. The browser fallback stays available if the server is offline.' : 'Pilot data is saved in this browser until the local workspace is available.'} No SMS or email is sent.</span></div>
    {notice && <div className="notice" role="status" aria-live="polite">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}

    <nav className="mills-tabs" aria-label="Mills workspace sections">
      <button className={tab === 'board' ? 'active' : ''} aria-pressed={tab === 'board'} onClick={() => setTab('board')}><ClipboardList size={16}/> Pilot board</button>
      <button className={tab === 'discovery' ? 'active' : ''} aria-pressed={tab === 'discovery'} onClick={() => setTab('discovery')}><Users size={16}/> Customer discovery <span>{contacts.length}</span></button>
      <button className={tab === 'pricing' ? 'active' : ''} aria-pressed={tab === 'pricing'} onClick={() => setTab('pricing')}><CalendarDays size={16}/> Pricing experiments</button>
    </nav>

    {tab === 'board' && <>
      <section className="mills-stats">
        <article><small>Active pilot jobs</small><strong>1</strong><span>Bloor renovation · 4 trades</span></article>
        <article><small>Updates needed</small><strong>{trades.filter(trade => trade.status !== 'ON_TRACK').length}</strong><span>Trade statuses to review</span></article>
        <article><small>Downstream impact</small><strong>{impacted.length}</strong><span>Tasks potentially at risk</span></article>
        <article><small>Messages sent</small><strong>{Object.values(sent).filter(Boolean).length}</strong><span>Mock only</span></article>
      </section>
      <div className="mills-layout">
        <section className="panel mills-panel">
          <div className="section-heading"><div><h2>Bloor renovation pilot</h2><p className="muted">Toronto, ON · Start date Nov 10 · Last update just now</p></div><span className="badge">ONE ACTIVE JOB</span></div>
          <div className="mills-job-meta"><span><strong>GC</strong> Cheney / Mills pilot</span><span><strong>Goal</strong> Catch handoff delays before crews arrive</span></div>
          <h3>Trade check-ins</h3>
          <div className="mills-trades">{trades.map(trade => <article className="mills-trade" key={trade.id}>
            <div className="mills-trade-icon"><Hammer size={17}/></div><div className="mills-trade-copy"><strong>{trade.trade}</strong><small>{trade.company} · {trade.contact}</small></div>
            <select aria-label={`${trade.trade} status`} value={trade.status} disabled={!workspaceReady} onChange={event => updateTrade(trade.id, event.target.value as TradeStatus)}><option value="ON_TRACK">On track</option><option value="AT_RISK">At risk</option><option value="DELAYED">Delayed</option><option value="BLOCKED">Blocked</option></select>
            <span className={`badge ${statusClass(trade.status)}`}>{statusLabel[trade.status]}</span>
          </article>)}</div>
          <h3 className="mills-section-gap">Dependency schedule</h3>
          <div className="mills-task-list">{tasks.map(task => { const trade = trades.find(item => item.id === task.tradeId); const isImpacted = impacted.some(item => item.task.id === task.id); return <article className={`mills-task ${isImpacted ? 'impacted' : ''}`} key={task.id}>
            <div className="mills-task-date"><strong>{new Date(`${task.due}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</strong><small>{task.due < '2026-11-15' ? 'This week' : 'Next week'}</small></div>
            <div className="mills-task-copy"><strong>{task.title}</strong><small>{trade?.trade} · {task.dependsOn.length ? `After ${tasks.find(item => item.id === task.dependsOn[0])?.title}` : 'No dependency'}</small></div>
            {isImpacted ? <span className="badge red">Impact detected</span> : <span className="badge green">Planned</span>}
          </article>; })}</div>
        </section>
        <aside className="mills-side-stack">
          <section className="panel mills-panel"><div className="section-heading"><div><h2>Impact queue</h2><p className="muted">Every message stays under GC control.</p></div><MessageSquare size={18}/></div>
            {!impacted.length && <div className="mills-empty"><Check size={24}/><strong>No downstream conflicts</strong><span>Change a trade to delayed or blocked to test the loop.</span></div>}
            {impacted.map(({ task, causedBy }) => { const trade = trades.find(item => item.id === task.tradeId); const causeTrade = trades.find(item => item.id === causedBy.tradeId); const id = task.id; return <article className="mills-impact" key={id}>
              <div className="mills-impact-title"><span className="badge red">Needs review</span><small>{trade?.trade} may be affected</small></div>
              <strong>{task.title}</strong><p>{causeTrade?.trade} is marked {statusLabel[causeTrade?.status ?? 'DELAYED'].toLowerCase()}. Review the handoff before the next crew arrives.</p>
              <pre>Hi {trade?.contact}, {causeTrade?.trade} is currently {statusLabel[causeTrade?.status ?? 'DELAYED'].toLowerCase()} on the Bloor renovation. Can you confirm whether {task.title.toLowerCase()} is still on track for {task.due}?</pre>
              <label className="checkbox"><input type="checkbox" checked={Boolean(approved[id])} onChange={() => approveMessage(id)}/> I reviewed this draft and approve the wording</label>
              <div className="mills-impact-actions"><button type="button" className="secondary" onClick={() => void copyDraft(id)}><Clipboard size={14}/> {copiedDraft === id ? 'Draft copied' : 'Copy draft'}</button><button className="primary" disabled={!approved[id] || sent[id]} onClick={() => sendMockMessage(id)}>{sent[id] ? <><Check size={14}/> Mock update recorded</> : <>Record mock send</>}</button></div>
            </article>; })}
          </section>
          <section className="panel mills-panel"><div className="section-heading"><div><h2>Founder prompt</h2><p className="muted">Use this in the next interview.</p></div><Sparkles size={17}/></div><p className="mills-quote">“When a trade is late, how do you decide who needs to know, and how do you know the next crew actually saw the change?”</p><small>Ask for the last real example, not a general opinion.</small></section>
        </aside>
      </div>
    </>}

    {tab === 'discovery' && <section className="mills-discovery-grid">
      <section className="panel mills-panel"><div className="section-heading"><div><h2>Customer discovery pipeline</h2><p className="muted">Track conversations before they become sales.</p></div><button className="primary" disabled={!workspaceReady} onClick={() => setShowContactForm(true)}><Plus size={15}/> Add inquiry</button></div>
        {showContactForm && <form className="mills-form" onSubmit={addContact}><div className="form-grid"><label>Name<input name="name" required placeholder="Owner or project manager"/></label><label>Company<input name="company" required placeholder="Company name"/></label><label>Role<input name="role" placeholder="Owner, GC, PM…"/></label><label>City<input name="city" placeholder="Toronto"/></label><label>Email<input name="email" type="email" placeholder="Public work email"/></label></div><div className="mills-form-actions"><button type="button" onClick={() => setShowContactForm(false)}>Cancel</button><button className="primary">Save inquiry</button></div></form>}
        <div className="mills-contact-list">{contacts.map(contact => <article className="mills-contact" key={contact.id}><div className="mills-contact-avatar">{contact.company.slice(0, 1).toUpperCase()}</div><div className="mills-contact-copy"><strong>{contact.company}</strong><small>{contact.name} · {contact.role || 'Role unknown'} · {contact.city || 'Canada'}</small><p>{contact.notes || 'No notes yet. Capture the last coordination failure they experienced.'}</p></div><div className="mills-contact-controls"><select aria-label={`${contact.company} discovery status`} value={contact.status} onChange={event => { const status = event.target.value as DiscoveryStatus; updateContact(contact.id, { status }); void persist({ action: 'updateContact', contactId: contact.id, status, nextStep: contact.nextStep, notes: contact.notes }); }}>{Object.entries(discoveryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label={`${contact.company} next step`} value={contact.nextStep} onChange={event => updateContact(contact.id, { nextStep: event.target.value })} onBlur={() => saveContact(contact.id)}/></div></article>)}</div>
      </section>
      <aside className="mills-side-stack"><section className="panel mills-panel"><div className="section-heading"><div><h2>Interview questions</h2><p className="muted">Learn before you pitch.</p></div><MessageSquare size={18}/></div><ol className="mills-questions"><li>Walk me through the last time a trade was late.</li><li>How did you find out?</li><li>Who had to call or text whom?</li><li>What downstream work was affected?</li><li>How many jobs are active at once?</li><li>Where does the schedule live today?</li><li>What would make a new tool unacceptable?</li><li>Would SMS updates work for your crews?</li><li>What would a successful pilot save?</li><li>Who else needs to approve a purchase?</li></ol></section><section className="panel mills-panel"><h2>Validation targets</h2><div className="mills-target"><strong>10</strong><span>interviews this week</span></div><div className="mills-target"><strong>2</strong><span>live-job design partners</span></div><div className="mills-target"><strong>1</strong><span>paid pilot before broadening scope</span></div></section></aside>
    </section>}

    {tab === 'pricing' && <section className="mills-pricing-grid"><section className="panel mills-panel"><div className="section-heading"><div><h2>Pricing experiments</h2><p className="muted">Test willingness to pay before polishing billing.</p></div><span className="badge green">RECOMMENDED</span></div><div className="mills-price-card recommended"><div><span className="badge green">Founding plan</span><h3>CAD $149 / month</h3><p>One GC workspace · unlimited subcontractor invites · up to 5 active jobs.</p></div><ul><li>Includes the coordination workflow</li><li>SMS usage included up to a fair limit</li><li>Human-approved messages only</li><li>Founding price locked for 12 months</li></ul></div><div className="mills-price-card"><div><span className="badge">Usage add-on</span><h3>Base + metered SMS</h3><p>CAD $99/month plus usage after the included allowance.</p></div><ul><li>Good for heavy users later</li><li>Harder to explain during discovery</li><li>Do not lead with this in the first pilots</li></ul></div></section><aside className="panel mills-panel"><h2>Recommendation</h2><p>Start with a simple subscription. It is easier for a GC to understand and gives you predictable revenue while you learn how much SMS each job actually uses.</p><div className="mills-callout"><strong>Do not sell tokens yet.</strong><span>Tokens make sense for expensive AI actions later, not for the core coordination loop.</span></div><h3>Pricing questions to ask</h3><ul className="mills-questions"><li>What does one missed trade day cost you?</li><li>Would preventing one delay justify $149/month?</li><li>Would you prefer per-job or per-company pricing?</li><li>What would make you cancel after a pilot?</li></ul></aside></section>}
    <footer className="mills-footer"><span>Mills validation workspace</span><span>Mock data · no outbound messages · human approval required</span></footer>
  </div>;
}
