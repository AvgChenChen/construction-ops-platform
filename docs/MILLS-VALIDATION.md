# Mills validation plan

Mills is being validated as a narrow coordination layer for small residential GCs and remodelers. The first job is not to replace construction management software. It is to catch a downstream scheduling problem early and help the GC coordinate the next trade.

## First workflow

1. The GC imports one active job schedule.
2. Trades receive a lightweight status request by SMS or link.
3. A trade reports `on track`, `at risk`, `delayed`, or `blocked`.
4. Mills walks the dependency graph and identifies downstream work.
5. Mills drafts a concise update for affected trades.
6. The GC reviews and approves the exact message.
7. The approved update is sent and recorded in the job history.

The dependency walk is deterministic. AI can summarize the situation and draft language, but it cannot approve or send a message.

## Design-partner profile

- Owner-led residential GC or remodeler
- Toronto first, Vancouver second
- 3–15 active jobs
- 5–20 recurring subcontractors
- Uses spreadsheets, group chats, or phone calls today
- Has experienced a missed handoff or idle crew in the last 90 days

Start with five design partners, each using Mills on one live job for four weeks.

## Discovery cadence

Each week:

- 10 discovery conversations
- 5 product walkthroughs
- 2 pilot invitations
- 1 request for a referral

Ask for the last real example, not a general opinion. Record the company, role, job type, current workflow, delay story, current tools, willingness to run a pilot, and the next step.

## Pilot success criteria

- 80% or more of scheduled check-ins receive a response
- An alert is drafted within 10 minutes of a delay update
- At least two real dependency conflicts are caught per job
- Manual coordination calls or texts fall by 30–50%
- Three of five pilots convert to paid accounts
- Each successful pilot produces a measurable result and a testimonial request

## Initial pricing experiment

Lead with a simple founding subscription rather than tokens:

- CAD $149/month per GC workspace
- Up to five active jobs during the pilot period
- Unlimited subcontractor invites
- SMS allowance included; usage is measured but not metered initially
- Founding price locked for 12 months

Test CAD $99 and CAD $199 with different segments. Only introduce metered usage after observing real message volume. Tokens should be reserved for optional high-cost AI actions, not the core coordination workflow.

## Outreach guardrails

Use public professional contact information and targeted, human-reviewed outreach. Do not mass-send scraped records, guess personal addresses, or let an agent send messages without approval. Every pilot invitation should identify Mills, explain why the company was selected, provide a clear opt-out, and be logged in the discovery tracker.

## Go-to-market validation loop

Use the public landing page to explain the outcome, not the underlying AI. The first message should be about fewer missed handoffs, fewer delivery surprises, and a clear owner for the next action.

- LinkedIn is the primary sales channel. Publish founder-led observations from real discovery calls, then invite a small number of owners, operations managers, project managers, and estimators to a 15-minute schedule stress test.
- Instagram is the awareness channel. Short vertical videos can dramatize a missed delivery, a no-show subcontractor, or a downstream schedule conflict. Label fictional or AI-generated scenes clearly, do not imply a real customer endorsed Mills, and do not use a company logo or likeness without permission.
- Associations and software partners are the trust channel. Offer a short, practical session on reducing schedule fire drills, then invite three companies into a concierge pilot.

Every campaign should use one call to action: `Book a 15-minute schedule stress test`. Track the source, company, role, pain hypothesis, next step, and whether the person consented to a follow-up. Keep the queue small enough to review by hand.

The safe local workflow is:

1. Create a draft or mock queue.
2. Review the contact, source, personalization, and send time.
3. Require explicit human approval.
4. Record the outcome locally.
5. Do not send email, SMS, LinkedIn messages, or social posts from local development.

The marketing surface is only successful when it produces a real conversation, a pilot, and eventually a measurable saved coordination action. Track those outcomes instead of optimizing for views alone.

## Ownership

- Anson: customer discovery, site visits, pilot onboarding, trade relationships
- Cheney: product, engineering, data model, analytics, and approval workflow
- Both founders: attend the first onboarding and review pilot outcomes together

The local app has three validation surfaces: `/hq` for Mills operations, `/mills` for the operator pilot console, and `/contractor` for a contractor workspace preview. They share the seeded pilot data in local PostgreSQL, with browser storage as a fallback; they do not send SMS or email. The contractor view is intentionally a single-operator demo until account membership and tenant isolation are implemented.

The public landing page also includes a local-only pilot request form for company, role, city, active-job range, coordination pain, and work email. It saves the request in the browser and shows a confirmation, but it does not submit data to a remote service. The HQ `Growth` tab is the internal planning surface for the LinkedIn, Instagram, and partner channels. Its content and follow-up approvals are local mock states only; approval never publishes a post or sends a message.
