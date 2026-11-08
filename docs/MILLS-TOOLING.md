# Mills tooling decisions

The reference repositories were reviewed as product and engineering inputs. Mills adopts the useful pieces without adding unrelated runtime dependencies.

## Applied now

- **shadcn/ui patterns:** `src/components/ui/` contains small, dependency-free `Button`, `Card`, and `Badge` primitives with accessible focus states. They are intentionally local so Mills keeps its dark visual system and does not inherit a large component dependency tree.
- **Marketing skills:** the public `/` route now has a focused value proposition, illustrative schedule demo, separate GC/subcontractor sections, and a single pilot-console CTA. Claims remain labelled as illustrative/mock data.
- **gstack-style review loop:** every UI pass is checked with typecheck, production build, unit tests, and a real browser smoke check at desktop width. Human approval remains required for all mock messages.

## Kept separate for now

- **last30days-skill:** useful for founder-led market research, but it should produce reviewable research briefs rather than silently write to the Mills customer pipeline.
- **Cap:** useful for recording a product walkthrough; it is not required in the product runtime.
- **qm and Dify:** both can orchestrate agents, but introducing either now would duplicate Mills' existing mock/local/approval boundaries. Revisit them only when a real multi-tenant workflow or external agent runtime is required.

The current landing page and pilot console do not send emails, SMS, or application submissions.
