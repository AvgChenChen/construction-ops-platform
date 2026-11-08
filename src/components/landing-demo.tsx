'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';

const steps = [
  { label: 'Delay reported', time: '7:02 AM', title: 'Plumber flags a broken toilet', body: 'The part is not on the truck. A normal morning becomes a coordination problem.', status: 'DELAY REPORTED' },
  { label: 'Conflict caught', time: '7:03 AM', title: 'Mills finds the next affected crew', body: 'Electrical is waiting on the bathroom to be clear. The dependency is visible before anyone drives over.', status: 'CONFLICT CAUGHT' },
  { label: 'Resequence', time: '7:05 AM', title: 'A new order of work is drafted', body: 'Mills proposes a simple reshuffle for the GC to review instead of changing the schedule automatically.', status: 'DRAFT READY' },
  { label: 'Crews notified', time: '7:07 AM', title: 'The approved update is ready to send', body: 'One concise message replaces the chain of calls. The GC remains in control.', status: 'APPROVAL REQUIRED' },
  { label: 'Back on track', time: '8:15 AM', title: 'The next crew keeps moving', body: 'The demo ends with a clear handoff and a record of what changed.', status: 'BACK ON TRACK' },
];

export default function LandingDemo() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const current = steps[step];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStep(value => (value + 1) % steps.length), 4200);
    return () => window.clearInterval(timer);
  }, [playing]);

  return <div className="landing-demo-card" aria-label="Interactive illustrative Mills workflow demo">
    <div className="landing-demo-card-top">
      <div><span className="landing-card-kicker">ILLUSTRATIVE DEMO</span><strong>Bathroom + kitchen reno</strong><small>Tuesday · shared schedule · mock data</small></div>
      <button type="button" className="landing-demo-control" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause demo' : 'Play demo'}>{playing ? <Pause size={14}/> : <Play size={14}/>}</button>
    </div>
    <div className="landing-demo-timeline" aria-live="polite">
      <div className="landing-demo-timebar"><span>7a</span><span>9a</span><span>11a</span><span>1p</span><span>3p</span><span>5p</span></div>
      <div className="landing-demo-rows">
        <div className={`landing-demo-row ${step === 0 ? 'is-hot' : ''}`}><span className="landing-demo-time">9:15</span><div><strong>Plumbing</strong><small>Ray · 2 crew</small></div><span className="landing-demo-chip">Set toilet + vanity</span></div>
        <div className={`landing-demo-row ${step >= 1 && step < 4 ? 'is-hot' : ''}`}><span className="landing-demo-time">10:30</span><div><strong>Electrical</strong><small>Dana · 4 crew</small></div><span className="landing-demo-chip">Bath fixtures</span></div>
        <div className={`landing-demo-row ${step >= 2 ? 'is-hot' : ''}`}><span className="landing-demo-time">1:00</span><div><strong>Tile</strong><small>Marco · 2 crew</small></div><span className="landing-demo-chip">Bath floor</span></div>
      </div>
    </div>
    <div className="landing-demo-event"><span className="landing-event-dot"><Check size={12}/></span><div><span>{current.time} · {current.status}</span><strong>{current.title}</strong><p>{current.body}</p></div></div>
    <div className="landing-demo-stepbar" role="tablist" aria-label="Demo steps">{steps.map((item, index) => <button type="button" role="tab" aria-selected={index === step} className={index === step ? 'is-active' : ''} key={item.label} onClick={() => { setStep(index); setPlaying(false); }}><span>{String(index + 1).padStart(2, '0')}</span>{item.label}</button>)}</div>
    <button type="button" className="landing-demo-replay" onClick={() => { setStep(0); setPlaying(true); }}><RotateCcw size={13}/> Replay from the beginning <ChevronRight size={13}/></button>
  </div>;
}
