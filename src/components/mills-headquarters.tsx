'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, Bell, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck, Download, Gauge, Handshake, LayoutDashboard, Link2, Megaphone, MessageSquare, Plus, RefreshCw, Search, Send, ShieldCheck, Target, Users, Video, X } from 'lucide-react';
import { discoveryContactsToCsv, type DiscoveryCsvContact } from '@/lib/mills/csv';

type Section = 'overview' | 'customers' | 'discovery' | 'onboarding' | 'growth';
type CustomerHealth = 'HEALTHY' | 'WATCH' | 'AT_RISK';

type Customer = {
  name: string;
  location: string;
  jobs: number;
  plan: string;
  health: CustomerHealth;
  lastActivity: string;
  nextStep: string;
};

type WorkspaceSnapshot = {
  job: { id: string; name: string; address: string | null; status: string };
  trades: Array<{ id: string; trade: string; company: string; contact: string; status: string }>;
  tasks: Array<{ id: string; title: string; tradeId: string; due: string; dependsOn: string[] }>;
  contacts: Array<{ id: string; name: string; company: string; role: string; city: string; email: string; status: string; notes: string; nextStep: string }>;
  messages: Array<{ id: string; sourceTaskId: string; body: string; status: string; createdAt: string }>;
};

type SyncState = 'loading' | 'ready' | 'error';
const hqStorageVersion = 'mills-hq-v1';

function readStoredRecord(key: string, fallback: Record<string, boolean>) {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(`${hqStorageVersion}-${key}`);
    return stored ? JSON.parse(stored) as Record<string, boolean> : fallback;
  } catch {
    return fallback;
  }
}

function syncLabel(value: string | null) {
  if (!value) return 'Not synced yet';
  return `Last synced ${new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

const customers: Customer[] = [
  { name: 'Toronto Renovation Co.', location: 'Toronto, ON', jobs: 2, plan: 'Founding pilot', health: 'HEALTHY', lastActivity: '12 min ago', nextStep: 'Review first live-job walkthrough' },
  { name: 'Northline Build Group', location: 'Mississauga, ON', jobs: 1, plan: 'Design partner', health: 'WATCH', lastActivity: 'Yesterday', nextStep: 'Confirm trade roster' },
  { name: 'Cedar & Stone Homes', location: 'Vancouver, BC', jobs: 3, plan: 'Discovery', health: 'HEALTHY', lastActivity: '2 days ago', nextStep: 'Book a coordination interview' },
  { name: 'Harbourview Projects', location: 'Toronto, ON', jobs: 0, plan: 'Onboarding', health: 'AT_RISK', lastActivity: '4 days ago', nextStep: 'Send workspace invite' },
];

const discovery = [
  { name: 'Anson Plumbing', person: 'Anson Lee', role: 'Owner', stage: 'Interviewed', detail: 'Asked for a simple way to see what changes after a delay.' },
  { name: 'Northline Electrical', person: 'Maya Singh', role: 'Operations manager', stage: 'Scheduled', detail: 'Call tomorrow at 10:00 AM. Bring the handoff demo.' },
  { name: 'West End Drywall', person: 'Chris Martin', role: 'Foreman', stage: 'Prospect', detail: 'Warm introduction from a Toronto GC.' },
];

const onboardingSteps = [
  { id: 'workspace', label: 'Workspace and operator access', owner: 'Mills', done: true },
  { id: 'job', label: 'First active job added', owner: 'Customer', done: true },
  { id: 'trades', label: 'Trade roster and contacts confirmed', owner: 'Customer', done: false },
  { id: 'walkthrough', label: 'Live-job walkthrough completed', owner: 'Mills', done: false },
  { id: 'pilot', label: 'First delay loop reviewed', owner: 'Both teams', done: false },
];

const growthChannels = [
  { id: 'linkedin', name: 'LinkedIn', label: 'Primary sales channel', detail: 'Founder-led posts and careful conversations with owners, operations managers, and project managers.', target: '20 conversations / week', icon: MessageSquare, tone: 'green' },
  { id: 'instagram', name: 'Instagram', label: 'Creative awareness', detail: 'Short, clearly labelled AI dramatizations of real coordination moments from the jobsite.', target: '3 short videos / week', icon: Video, tone: 'orange' },
  { id: 'partners', name: 'Partners', label: 'Borrowed trust', detail: 'Small workshops with builder groups, trade associations, suppliers, and construction software advisors.', target: '2 introductions / week', icon: Handshake, tone: 'blue' },
];

const contentQueue = [
  { id: 'growth-linkedin-delay', channel: 'LinkedIn', format: 'Founder post', title: 'A confirmed delivery can still derail a job', cta: 'Ask for the last coordination failure', status: 'Ready', icon: MessageSquare },
  { id: 'growth-instagram-reel', channel: 'Instagram', format: 'AI video', title: 'The 7:02 AM delivery problem', cta: 'DM “MILLS” for the pilot', status: 'Draft', icon: Video },
  { id: 'growth-partner-workshop', channel: 'Partners', format: '20-minute workshop', title: 'Reduce scheduling fire drills', cta: 'Invite three contractors to test it', status: 'Draft', icon: Users },
];

const followUpQueue = [
  { id: 'growth-followup-northline', company: 'Northline Build Group', context: 'Confirm the trade roster before the walkthrough.', channel: 'Email', next: 'Review the draft, then send manually' },
  { id: 'growth-followup-cedar', company: 'Cedar & Stone Homes', context: 'Ask about the last delay across three active jobs.', channel: 'LinkedIn', next: 'Request a 15-minute conversation' },
  { id: 'growth-followup-harbourview', company: 'Harbourview Projects', context: 'Customer has been quiet for four days.', channel: 'Email', next: 'Prepare a gentle check-in' },
];

function healthLabel(health: CustomerHealth) {
  return health === 'HEALTHY' ? 'Healthy' : health === 'WATCH' ? 'Watch' : 'At risk';
}

function healthClass(health: CustomerHealth) {
  return health === 'HEALTHY' ? 'good' : health === 'WATCH' ? 'watch' : 'risk';
}

export default function MillsHeadquarters() {
  const [section, setSection] = useState<Section>('overview');
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>(() => readStoredRecord('onboarding', Object.fromEntries(onboardingSteps.map(step => [step.id, step.done]))));
  const [notice, setNotice] = useState('');
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [approvedGrowth, setApprovedGrowth] = useState<Record<string, boolean>>(() => readStoredRecord('growth-approvals', {}));
  const [syncState, setSyncState] = useState<SyncState>('loading');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  async function refreshWorkspace() {
    setSyncState('loading');
    let active = true;
    try {
      const response = await fetch('/api/mills', { cache: 'no-store' });
      if (!response.ok) throw new Error('Mills workspace unavailable');
      const data = await response.json() as WorkspaceSnapshot;
      if (!active) return;
      setWorkspace(data);
      setChecked(current => ({ ...current, workspace: true, job: Boolean(data.job), trades: data.trades.length > 0 }));
      setLastSyncedAt(new Date().toISOString());
      setSyncState('ready');
      setNotice('');
    } catch {
      if (!active) return;
      setSyncState('error');
      setNotice('Showing the local HQ mock while the pilot workspace reconnects.');
    }
    active = false;
  }

  useEffect(() => { void refreshWorkspace(); }, []);
  useEffect(() => { window.localStorage.setItem(`${hqStorageVersion}-onboarding`, JSON.stringify(checked)); }, [checked]);
  useEffect(() => { window.localStorage.setItem(`${hqStorageVersion}-growth-approvals`, JSON.stringify(approvedGrowth)); }, [approvedGrowth]);

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter(customer => `${customer.name} ${customer.location} ${customer.plan}`.toLowerCase().includes(normalized));
  }, [query]);

  const liveTrades = workspace?.trades ?? [];
  const needsAttention = liveTrades.filter(trade => trade.status !== 'ON_TRACK').length;
  const discoveryRows = workspace?.contacts.length ? workspace.contacts.map(contact => ({ name: contact.company, person: contact.name, role: contact.role || 'Role unknown', stage: contact.status, detail: contact.nextStep || contact.notes || 'No next step recorded yet.' })) : discovery;

  function toggleStep(id: string) {
    setChecked(current => ({ ...current, [id]: !current[id] }));
    setNotice('Onboarding checklist updated locally. No customer was contacted.');
  }

  function approveGrowthItem(id: string, label: string) {
    setApprovedGrowth(current => ({ ...current, [id]: !current[id] }));
    setNotice(`${label} ${approvedGrowth[id] ? 'returned to draft' : 'approved locally'}. Nothing was published or sent.`);
  }

  function exportDiscoveryContacts() {
    const contacts: DiscoveryCsvContact[] = workspace?.contacts.length
      ? workspace.contacts
      : discovery.map(item => ({ name: item.person, company: item.name, role: item.role, city: '', email: '', status: item.stage.toUpperCase(), nextStep: '', notes: item.detail }));
    const blob = new Blob([discoveryContactsToCsv(contacts)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mills-discovery-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Discovery contacts exported locally. No external account was contacted.');
  }

  return <div className="hq-page">
    <header className="hq-header">
      <div className="hq-header-inner">
        <div className="hq-brand-block">
          <a className="mills-wordmark" href="/" aria-label="Mills home">mills<span>.</span></a>
          <span className="hq-label">HEADQUARTERS</span>
          <h1>Run the company from one calm place.</h1>
          <p>Keep customer health, onboarding, discovery, and pilot activity in view while the product stays focused on the jobsite.</p>
        </div>
        <div className="hq-header-side">
          <span className="hq-console-label">// INTERNAL OPERATIONS · TORONTO FIRST</span>
          <div className="hq-header-actions"><span className="hq-badge mock"><ShieldCheck size={12}/> {workspace ? 'LOCAL DATA' : 'MOCK MODE'}</span><span className={`hq-badge ${needsAttention ? 'risk' : 'good'}`}><Activity size={12}/> {needsAttention ? `${needsAttention} trade${needsAttention === 1 ? '' : 's'} need review` : 'All systems steady'}</span><span className={`hq-badge ${syncState === 'error' ? 'risk' : syncState === 'ready' ? 'good' : 'mock'}`} role="status">{syncLabel(lastSyncedAt)}</span></div>
          <div className="hq-quick-links"><a href="/mills">Open pilot console <ArrowUpRight size={13}/></a><a href="/contractor">Preview contractor workspace <ArrowUpRight size={13}/></a></div>
        </div>
      </div>
    </header>

    <nav className="hq-nav" aria-label="Mills headquarters sections">
      <button className={section === 'overview' ? 'active' : ''} aria-pressed={section === 'overview'} onClick={() => setSection('overview')}><LayoutDashboard size={15}/> Overview</button>
      <button className={section === 'customers' ? 'active' : ''} aria-pressed={section === 'customers'} onClick={() => setSection('customers')}><BriefcaseBusiness size={15}/> Customers <span>{customers.length}</span></button>
      <button className={section === 'discovery' ? 'active' : ''} aria-pressed={section === 'discovery'} onClick={() => setSection('discovery')}><Users size={15}/> Discovery <span>{discovery.length}</span></button>
      <button className={section === 'onboarding' ? 'active' : ''} aria-pressed={section === 'onboarding'} onClick={() => setSection('onboarding')}><ClipboardCheck size={15}/> Onboarding</button>
      <button className={section === 'growth' ? 'active' : ''} aria-pressed={section === 'growth'} onClick={() => setSection('growth')}><Megaphone size={15}/> Growth <span>3</span></button>
    </nav>

    {syncState === 'error' && <div className="hq-notice hq-error-notice" role="alert"><span>Live workspace data is unavailable. You are viewing local mock data.</span><button className="hq-link-button" onClick={() => void refreshWorkspace()}><RefreshCw size={13}/> Retry</button></div>}
    {notice && <div className="hq-notice" role="status" aria-live="polite">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={14}/></button></div>}

    {section === 'overview' && <>
      <section className="hq-metrics" aria-label="Mills headquarters metrics">
        <article><span><Gauge size={15}/> Customer accounts</span><strong>4</strong><small>Tracked in HQ mock mode</small></article>
        <article><span><BriefcaseBusiness size={15}/> Jobs in view</span><strong>{workspace ? 1 : 0}</strong><small>{workspace?.job.name || 'Waiting for pilot data'}</small></article>
        <article><span><Handshake size={15}/> Trades checked in</span><strong>{liveTrades.length}</strong><small>{workspace ? `${workspace.messages.length} approved mock updates` : 'Loading local workspace'}</small></article>
        <article><span><Bell size={15}/> Needs attention</span><strong>{workspace ? needsAttention : 0}</strong><small>{needsAttention ? 'Review delayed or blocked trades' : 'No live pilot flags'}</small></article>
      </section>
      <div className="hq-grid">
        <section className="hq-panel">
          <div className="hq-section-heading"><div><span className="hq-kicker">CUSTOMER HEALTH</span><h2>Know who needs help before they ask.</h2></div><button className="hq-text-button" onClick={() => setSection('customers')}>View all <ChevronRight size={14}/></button></div>
          <div className="hq-customer-list">{customers.slice(0, 4).map(customer => <article className="hq-customer-row" key={customer.name}><div className="hq-customer-avatar">{customer.name.slice(0, 1)}</div><div className="hq-customer-main"><strong>{customer.name}</strong><small>{customer.location} · {customer.jobs} active {customer.jobs === 1 ? 'job' : 'jobs'} · {customer.plan}</small><p>{customer.name === 'Toronto Renovation Co.' && workspace ? `${workspace.job.name} · ${workspace.job.address || 'Toronto, ON'} · ${workspace.trades.length} trades` : customer.nextStep}</p></div><span className={`hq-health ${healthClass(customer.health)}`}>{healthLabel(customer.health)}</span><small className="hq-last-activity">{customer.lastActivity}</small></article>)}</div>
        </section>
        <aside className="hq-side-stack">
          <section className="hq-panel"><div className="hq-section-heading"><div><span className="hq-kicker">TODAY</span><h2>Operator queue</h2></div><MessageSquare size={17}/></div><div className="hq-queue"><button onClick={() => setSection('onboarding')}><span className="hq-queue-icon amber"><ClipboardCheck size={15}/></span><span><strong>Confirm Northline roster</strong><small>Onboarding · due today</small></span><ChevronRight size={14}/></button><button onClick={() => setSection('discovery')}><span className="hq-queue-icon green"><Users size={15}/></span><span><strong>Prepare Maya's interview</strong><small>Discovery · tomorrow at 10:00 AM</small></span><ChevronRight size={14}/></button><button onClick={() => setSection('customers')}><span className="hq-queue-icon red"><CircleHelp size={15}/></span><span><strong>Check in with Harbourview</strong><small>Customer health · 4 days quiet</small></span><ChevronRight size={14}/></button></div></section>
          <section className="hq-panel hq-principle"><span className="hq-kicker">OPERATING PRINCIPLE</span><p>Every customer conversation should teach us something about the jobsite, not just move a deal forward.</p><small>Founder note · Keep the first pilots close.</small></section>
        </aside>
      </div>
    </>}

    {section === 'customers' && <section className="hq-panel hq-full-panel"><div className="hq-section-heading"><div><span className="hq-kicker">CUSTOMER DIRECTORY</span><h2>Every account, with the next useful action.</h2></div><button className="hq-primary" onClick={() => setNotice('New customer intake is mocked for now. Start with a discovery conversation.') }><Plus size={14}/> Add customer</button></div><div className="hq-search"><Search size={15}/><input aria-label="Search customers" placeholder="Search by company, city, or plan" value={query} onChange={event => setQuery(event.target.value)}/></div><div className="hq-customer-grid">{filteredCustomers.map(customer => <article className="hq-account-card" key={customer.name}><div className="hq-account-top"><span className="hq-customer-avatar">{customer.name.slice(0, 1)}</span><span className={`hq-health ${healthClass(customer.health)}`}>{healthLabel(customer.health)}</span></div><h3>{customer.name}</h3><p>{customer.location} · {customer.plan}</p><div className="hq-account-stats"><span><strong>{customer.jobs}</strong> active jobs</span><span><strong>{customer.lastActivity}</strong> last activity</span></div><div className="hq-account-next"><small>NEXT STEP</small><strong>{customer.nextStep}</strong></div><button className="hq-link-button" onClick={() => setNotice(`${customer.name} is still in local mock mode. No message was sent.`)}>Open account <ArrowUpRight size={13}/></button></article>)}</div>{!filteredCustomers.length && <div className="hq-empty">No customers match that search.</div>}</section>}

    {section === 'discovery' && <div className="hq-grid"><section className="hq-panel"><div className="hq-section-heading"><div><span className="hq-kicker">CUSTOMER DISCOVERY</span><h2>Keep the questions close to the product.</h2></div><div className="hq-section-actions"><button className="hq-text-button" onClick={exportDiscoveryContacts}><Download size={14}/> Export CSV</button><button className="hq-primary" onClick={() => setNotice('New discovery contact intake is mocked for now.') }><Plus size={14}/> Add contact</button></div></div><div className="hq-discovery-list">{discoveryRows.map(item => <article className="hq-discovery-row" key={`${item.name}-${item.person}`}><div className="hq-customer-avatar">{item.name.slice(0, 1)}</div><div><strong>{item.name}</strong><small>{item.person} · {item.role}</small><p>{item.detail}</p></div><span className="hq-stage">{item.stage}</span></article>)}</div></section><aside className="hq-side-stack"><section className="hq-panel"><div className="hq-section-heading"><div><span className="hq-kicker">CALL GUIDE</span><h2>Ask about the last delay.</h2></div><MessageSquare size={17}/></div><ol className="hq-question-list"><li>What was the last trade delay you had to coordinate?</li><li>How did you find out, and who did you call next?</li><li>What did the delay change for the following crew?</li><li>What would make a coordination tool worth paying for?</li></ol></section><section className="hq-panel hq-callout"><strong>Research rule</strong><p>Capture the actual workflow before showing the product. A useful no is better than a polite maybe.</p></section></aside></div>}

    {section === 'onboarding' && <div className="hq-grid"><section className="hq-panel"><div className="hq-section-heading"><div><span className="hq-kicker">ONBOARDING BOARD</span><h2>Move a customer from first hello to first saved day.</h2></div><span className="hq-badge good"><Check size={12}/> Mock checklist</span></div><div className="hq-onboarding-list">{onboardingSteps.map(step => <label className={`hq-onboarding-row ${checked[step.id] ? 'done' : ''}`} key={step.id}><input type="checkbox" checked={Boolean(checked[step.id])} onChange={() => toggleStep(step.id)}/><span className="hq-checkmark">{checked[step.id] && <Check size={13}/>}</span><span><strong>{step.label}</strong><small>Owner: {step.owner}</small></span></label>)}</div></section><aside className="hq-side-stack"><section className="hq-panel"><div className="hq-section-heading"><div><span className="hq-kicker">PILOT READINESS</span><h2>Harbourview Projects</h2></div><span className="hq-health risk">At risk</span></div><div className="hq-readiness"><div><span>Workspace</span><strong>Ready</strong></div><div><span>First job</span><strong>Waiting</strong></div><div><span>Trade roster</span><strong>Needs input</strong></div><div><span>First delay loop</span><strong>Not started</strong></div></div><button className="hq-primary wide" onClick={() => setNotice('Reminder prepared locally. No customer was contacted.')}>Prepare reminder</button></section><section className="hq-panel hq-principle"><span className="hq-kicker">SUCCESS SIGNAL</span><p>The first win is not a dashboard view. It is one saved coordination call on a real job.</p></section></aside></div>}

    {section === 'growth' && <div className="hq-growth">
      <section className="hq-growth-intro">
        <div><span className="hq-kicker">GO-TO-MARKET CONSOLE</span><h2>Turn useful conversations into pilots.</h2><p>Give every channel one job. LinkedIn starts the conversation, Instagram makes the problem feel familiar, and partners bring trusted introductions. All drafts stay local until a founder approves them.</p></div>
        <span className="hq-badge mock"><ShieldCheck size={12}/> Mock mode · no outbound activity</span>
      </section>

      <section className="hq-metrics hq-growth-metrics" aria-label="Mills growth metrics">
        <article><span><Target size={15}/> Target accounts</span><strong>20</strong><small>high-fit conversations this week</small></article>
        <article><span><MessageSquare size={15}/> Replies</span><strong>6</strong><small>tracked discovery replies</small></article>
        <article><span><CalendarDays size={15}/> Calls</span><strong>5</strong><small>goal before choosing the wedge</small></article>
        <article><span><BarChart3 size={15}/> Pilot target</span><strong>1</strong><small>paid design partner</small></article>
      </section>

      <div className="hq-growth-grid">
        <section className="hq-panel"><div className="hq-section-heading"><div><span className="hq-kicker">CHANNEL PLAN</span><h2>Each channel has a clear job.</h2></div><Megaphone size={17}/></div><div className="hq-channel-grid">{growthChannels.map(channel => { const Icon = channel.icon; return <article className="hq-channel-card" key={channel.id}><div className={`hq-channel-icon ${channel.tone}`}><Icon size={17}/></div><div className="hq-channel-main"><div className="hq-channel-top"><strong>{channel.name}</strong><span className="hq-stage">{channel.label}</span></div><p>{channel.detail}</p><small>{channel.target}</small></div></article>; })}</div></section>
        <aside className="hq-panel hq-funnel-panel"><div className="hq-section-heading"><div><span className="hq-kicker">FUNNEL</span><h2>Attention to pilot.</h2></div><BarChart3 size={17}/></div><div className="hq-funnel"><div><span>Reach</span><strong>3 channels</strong></div><div><span>Conversations</span><strong>20 target</strong></div><div><span>Discovery calls</span><strong>5 goal</strong></div><div><span>Design partners</span><strong>2 target</strong></div><div><span>Paid pilot</span><strong>1 target</strong></div></div><p className="hq-funnel-note">Do not buy ads until one message earns replies organically.</p></aside>
      </div>

      <section className="hq-panel hq-growth-panel"><div className="hq-section-heading"><div><span className="hq-kicker">CONTENT QUEUE</span><h2>Publish a useful point of view.</h2></div><button className="hq-primary" onClick={() => setNotice('New content ideas stay local until a founder approves them.') }><Plus size={14}/> Add idea</button></div><div className="hq-content-list">{contentQueue.map(item => { const Icon = item.icon; const approved = Boolean(approvedGrowth[item.id]); return <article className={`hq-content-row ${approved ? 'approved' : ''}`} key={item.id}><div className="hq-content-icon"><Icon size={15}/></div><div className="hq-content-main"><div className="hq-content-meta"><span>{item.channel}</span><span>{item.format}</span></div><strong>{item.title}</strong><small>CTA: {item.cta}</small></div><span className={`hq-health ${approved ? 'good' : item.status === 'Ready' ? 'watch' : 'risk'}`}>{approved ? 'Approved' : item.status}</span><button className="hq-link-button" onClick={() => approveGrowthItem(item.id, item.title)}>{approved ? <><CheckCircle2 size={13}/> Return to draft</> : <><Check size={13}/> Approve draft</>}</button></article>; })}</div></section>

      <section className="hq-panel hq-growth-panel"><div className="hq-section-heading"><div><span className="hq-kicker">FOLLOW-UP QUEUE</span><h2>Keep the next conversation visible.</h2></div><span className="hq-badge good"><ShieldCheck size={12}/> Human approval required</span></div><div className="hq-content-list">{followUpQueue.map(item => { const approved = Boolean(approvedGrowth[item.id]); return <article className={`hq-content-row ${approved ? 'approved' : ''}`} key={item.id}><div className="hq-content-icon"><Send size={15}/></div><div className="hq-content-main"><div className="hq-content-meta"><span>{item.channel}</span><span>{item.company}</span></div><strong>{item.context}</strong><small>Next: {item.next}</small></div><span className={`hq-health ${approved ? 'good' : 'watch'}`}>{approved ? 'Ready' : 'Review'}</span><button className="hq-link-button" onClick={() => approveGrowthItem(item.id, `Follow-up for ${item.company}`)}>{approved ? <><CheckCircle2 size={13}/> Unapprove</> : <><Check size={13}/> Review draft</>}</button></article>; })}</div><p className="hq-growth-footnote"><Link2 size={13}/> This queue prepares drafts only. No email, LinkedIn message, or social post is sent from HQ.</p></section>
    </div>}

    <footer className="hq-footer"><span>Mills headquarters · internal workspace</span><span>Mock data · no external messages · approvals stay human</span></footer>
  </div>;
}
