# ScrapeGraphAI on your Mac

This standalone helper uses the open-source `scrapegraphai==2.3.1` library and your installed Ollama `qwen3:4b`. No ScrapeGraph subscription, OpenAI key, or Google account is needed. It extracts one internship page into a local review file. It does not search the entire web, run the 12-worker pipeline, import records, allocate applications, or submit forms.

## Run

Open a terminal in the project:

```bash
cd '/Users/cheneyzhao/Documents/New project/recruiting-os'
npm run model:start
```

Keep it open. In a second terminal in the same folder:

```bash
# Fictional sample, extracted by the REAL local model
.local/scrapegraph-venv/bin/python tools/scrapegraph/job_page.py --demo

# Replace the example with a public, individual job-posting URL
.local/scrapegraph-venv/bin/python tools/scrapegraph/job_page.py --url 'https://company.example/careers/internship'

# Or use an HTML job description you saved locally
.local/scrapegraph-venv/bin/python tools/scrapegraph/job_page.py --file '/absolute/path/job.html'
```

The command prints the fields and the JSON file path in `.local/scrapegraph-results/`. Optional `--out /absolute/path/new-file.json` selects a new file. Existing files are never overwritten. Treat `UNVERIFIED_REQUIRES_REVIEW` literally: compare fields with `source_text` and the original posting. Missing fields are null; the model can still misread or invent information. The sample is fictional and must not become a real opportunity.

Run this helper while the RecruitingOS background worker is stopped. The 8 GB Mac uses one Ollama inference at a time, but this standalone experiment does not participate in the app's database task leases. A later integration must route it through those leases and the existing staged-import review service.

## What pages work?

Public HTTPS pages whose job description is present in the returned HTML. The helper uses a plain read-only HTTP request, then supplies the cleaned page to `SmartScraperGraph`. It does not require Chromium, execute page scripts, use your logins, follow redirects, or bypass access checks. For a redirect, supply the final public URL. For JavaScript-only pages, save the visible job description as HTML and use `--file`. Never use a login page or include credentials in a URL.

Limits: 2 MB downloaded HTML, 12,000 cleaned text characters, 180-second model request timeout, no automatic retry. Large pages fail instead of silently truncating the job description. A failed run creates no application. The URL checks are guardrails for a local operator tool, not a hardened server-side fetch service; do not expose this script as a public endpoint.

## Reinstall / test

Python 3.13 was used on this Mac. Dependencies are isolated from the Next.js app:

```bash
uv venv .local/scrapegraph-venv --python python3
uv pip install --python .local/scrapegraph-venv/bin/python -r tools/scrapegraph/requirements.lock
.local/scrapegraph-venv/bin/python -m unittest discover -s tools/scrapegraph -p 'test_*.py' -v
```

These unit tests use mocked inference. `--demo` separately verifies actual local inference. The app's mock mode and its equal executor allocation / human approval rules remain unchanged.

Upstream: https://github.com/ScrapeGraphAI/Scrapegraph-ai
