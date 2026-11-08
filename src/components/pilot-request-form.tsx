'use client';

import { Check, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

type PilotRequest = {
  company: string;
  role: string;
  city: string;
  activeJobs: string;
  pain: string;
  email: string;
  createdAt: string;
};

const storageKey = 'mills-pilot-requests-v1';

export default function PilotRequestForm() {
  const [submitted, setSubmitted] = useState<PilotRequest | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request: PilotRequest = {
      company: String(form.get('company') || '').trim(),
      role: String(form.get('role') || '').trim(),
      city: String(form.get('city') || '').trim(),
      activeJobs: String(form.get('activeJobs') || '').trim(),
      pain: String(form.get('pain') || '').trim(),
      email: String(form.get('email') || '').trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(window.localStorage.getItem(storageKey) || '[]') as PilotRequest[];
      window.localStorage.setItem(storageKey, JSON.stringify([request, ...existing]));
    } catch {
      // The confirmation still gives the visitor a useful next step when storage is unavailable.
    }
    setSubmitted(request);
  }

  if (submitted) {
    return <div className="pilot-request-success" role="status" aria-live="polite">
      <div className="pilot-request-success-icon"><Check size={20}/></div>
      <div>
        <span className="landing-card-kicker">Pilot request saved</span>
        <h3>We have the shape of the first job.</h3>
        <p>{submitted.company} · {submitted.city} · {submitted.activeJobs} active jobs</p>
        <small>This is a local mock intake. No email was sent and no external account was contacted.</small>
      </div>
      <button className="pilot-request-reset" type="button" onClick={() => setSubmitted(null)}>Add another request</button>
    </div>;
  }

  return <div className="pilot-request-card">
    <div className="pilot-request-intro">
      <div className="pilot-request-intro-icon"><ClipboardCheck size={18}/></div>
      <div>
        <h3>Request a focused pilot</h3>
        <p>Tell us about one real workflow. We will use it to shape a short, hands-on walkthrough.</p>
      </div>
    </div>
    <form className="pilot-request-form" onSubmit={handleSubmit}>
      <div className="pilot-request-fields">
        <label>Company<input name="company" required placeholder="Northline Build Group" autoComplete="organization"/></label>
        <label>Your role<select name="role" required defaultValue=""><option value="" disabled>Select one</option><option>Owner / GC</option><option>Operations manager</option><option>Project manager</option><option>Estimator</option><option>Other</option></select></label>
        <label>City<input name="city" required placeholder="Toronto" autoComplete="address-level2"/></label>
        <label>Active jobs<select name="activeJobs" required defaultValue=""><option value="" disabled>Choose a range</option><option>1 active job</option><option>2 to 5 active jobs</option><option>6 to 10 active jobs</option><option>More than 10 active jobs</option></select></label>
        <label className="pilot-request-wide">What keeps creating coordination work?<textarea name="pain" required placeholder="For example: chasing delivery dates or finding out a trade is blocked too late."/></label>
        <label className="pilot-request-wide">Work email<input name="email" required type="email" placeholder="you@company.ca" autoComplete="email"/></label>
      </div>
      <div className="pilot-request-footer">
        <div className="pilot-request-safety"><ShieldCheck size={15}/><span>Local mock intake · no outbound messages</span></div>
        <button className="ui-button ui-button-primary ui-button-lg" type="submit">Save pilot request <Check size={15}/></button>
      </div>
    </form>
  </div>;
}
