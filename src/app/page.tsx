import { ArrowRight, CalendarClock, Check, Hammer, MessageSquareText, Network, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import LandingDemo from '@/components/landing-demo';
import PilotRequestForm from '@/components/pilot-request-form';

export const dynamic = 'force-static';

export default function Page() {
  return <main className="landing-page" id="top">
    <header className="landing-nav">
      <a className="landing-wordmark" href="#top" aria-label="Mills home">mills<span>.</span></a>
      <nav className="landing-nav-links" aria-label="Primary navigation">
        <a href="#demo">Demo</a>
        <a href="#how">How it works</a>
        <a href="#who">For GCs &amp; trades</a>
        <a href="#pilot">Pilot request</a>
        <a href="/contractor">Contractor preview</a>
      </nav>
      <a className="ui-button ui-button-primary ui-button-sm" href="/mills">Open pilot console <ArrowRight size={14}/></a>
    </header>

    <section className="landing-hero" aria-labelledby="hero-title">
      <div className="landing-hero-copy">
        <div className="landing-eyebrow"><span/> AI COORDINATION FOR CONSTRUCTION TRADES</div>
        <h1 id="hero-title">A day late is a dollar short.</h1>
        <p>Mills keeps general contractors and subcontractors on the same schedule. When one trade slips, Mills shows who is affected next and gives the GC a clear next move.</p>
        <div className="landing-actions">
          <a className="ui-button ui-button-primary ui-button-lg" href="#pilot">Book a pilot <ArrowRight size={16}/></a>
          <a className="ui-button ui-button-secondary ui-button-lg" href="#demo">See the workflow <span aria-hidden="true">↓</span></a>
        </div>
        <p className="landing-note">// ILLUSTRATIVE PILOT CONSOLE · MOCK MODE · HUMAN APPROVALS</p>
      </div>
      <div className="landing-hero-card" aria-label="Illustrative Mills schedule preview">
        <div className="landing-card-top"><span>ILLUSTRATIVE DEMO</span><Badge tone="accent">ONE JOB</Badge></div>
        <h2>Bathroom + kitchen reno</h2>
        <p className="landing-card-muted">Tuesday · Shared schedule</p>
        <div className="landing-schedule">
          <div className="landing-schedule-row"><span>9:15</span><div><strong>Plumbing</strong><small>Set toilet + vanity</small></div><Badge tone="success">On track</Badge></div>
          <div className="landing-schedule-row is-active"><span>10:30</span><div><strong>Electrical</strong><small>Bath fixtures · dependency check</small></div><Badge tone="accent">Review</Badge></div>
          <div className="landing-schedule-row"><span>1:00</span><div><strong>Tile</strong><small>Bath floor · after electrical</small></div><Badge>Planned</Badge></div>
        </div>
        <div className="landing-hero-callout"><Network size={17}/><span><strong>One change, visible downstream.</strong> Mills drafts the update. The GC approves it.</span></div>
      </div>
    </section>

    <section className="landing-section landing-demo" id="demo" aria-labelledby="demo-title">
      <div className="landing-section-kicker">ILLUSTRATIVE DEMO</div>
      <div className="landing-section-heading"><div><h2 id="demo-title">One dropped toilet. Zero lost days.</h2><p>See the coordination loop Mills is built to validate. This is mock data, and no trade is contacted.</p></div><Badge tone="accent">LOCAL MOCK</Badge></div>
      <LandingDemo />
    </section>

    <section className="landing-section" id="how" aria-labelledby="how-title">
      <div className="landing-section-kicker">HOW IT WORKS</div>
      <h2 id="how-title">One place for the schedule, the checklist, and the conversation.</h2>
      <div className="landing-feature-grid">
        <Card className="landing-feature-card"><CardHeader><span className="landing-feature-icon"><CalendarClock size={18}/></span><span className="landing-feature-index">01 / SCHEDULE</span></CardHeader><CardContent><h3>One shared schedule.</h3><p>Every trade on the job, on one timeline. Start with the workflow you already use.</p></CardContent></Card>
        <Card className="landing-feature-card"><CardHeader><span className="landing-feature-icon"><Hammer size={18}/></span><span className="landing-feature-index">02 / CHECKLISTS</span></CardHeader><CardContent><h3>The right parts on the truck.</h3><p>Keep the next visit concrete: tools, materials, dependencies, and the handoff that matters.</p></CardContent></Card>
        <Card className="landing-feature-card"><CardHeader><span className="landing-feature-icon"><MessageSquareText size={18}/></span><span className="landing-feature-index">03 / APPROVALS</span></CardHeader><CardContent><h3>Updates the GC controls.</h3><p>Mills can draft the message, but a human reviews and approves it before anything is sent.</p></CardContent></Card>
      </div>
    </section>

    <section className="landing-section landing-who" id="who" aria-labelledby="who-title">
      <div className="landing-section-kicker">WHO IT'S FOR</div>
      <h2 id="who-title">The GC pays. Every trade on the job benefits.</h2>
      <div className="landing-who-grid">
        <Card className="landing-who-card"><CardHeader><span className="landing-who-label">GENERAL CONTRACTORS</span><h3>See the knock-on before it costs a day.</h3></CardHeader><CardContent><ul><li><Check size={15}/> Keep the active job in one view</li><li><Check size={15}/> Review downstream impact before rebooking</li><li><Check size={15}/> Approve a concise update instead of ten calls</li></ul><a href="/mills">Open the pilot console <ArrowRight size={14}/></a></CardContent></Card>
        <Card className="landing-who-card"><CardHeader><span className="landing-who-label">SUBCONTRACTORS</span><h3>Know when the room is ready.</h3></CardHeader><CardContent><ul><li><Check size={15}/> Fewer surprise trips to a blocked job</li><li><Check size={15}/> Clear handoffs from the GC</li><li><Check size={15}/> Start with a link or text instead of a new portal</li></ul><a href="#pilot">Join a pilot conversation <ArrowRight size={14}/></a></CardContent></Card>
      </div>
    </section>

    <section className="landing-section landing-contact" id="contact" aria-labelledby="contact-title">
      <div className="landing-contact-copy"><div className="landing-section-kicker">EARLY PILOT</div><h2 id="contact-title">See Mills on one of your jobs.</h2><p>We are validating the workflow with a small group of GCs and trades. Open the local pilot console to walk through the mock flow, then bring us the last coordination failure you remember.</p></div>
      <div className="landing-contact-actions"><a className="ui-button ui-button-primary ui-button-lg" href="/mills">Open pilot console <ArrowRight size={16}/></a><div className="landing-safety"><ShieldCheck size={16}/><span>Mock data only · no outbound messages</span></div></div>
    </section>

    <section className="landing-section landing-pilot-request" id="pilot" aria-labelledby="pilot-request-title">
      <div className="landing-section-heading"><div><div className="landing-section-kicker">PILOT REQUEST</div><h2 id="pilot-request-title">Bring us one active job.</h2><p>A short intake gives us enough context to show the workflow without asking you to change systems first.</p></div><Badge tone="success">LOCAL MOCK</Badge></div>
      <PilotRequestForm />
    </section>

    <footer className="landing-footer"><span>mills · AI coordination for construction trades</span><span>Toronto, Canada · 2026</span></footer>
  </main>;
}
