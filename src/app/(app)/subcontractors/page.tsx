import type { Trade } from "@prisma/client";
import { createSubcontractorAction } from "@/app/actions";
import { FilterBar, FilterSelect } from "@/components/filter-bar";
import { FormDialog } from "@/components/ui/dialog";
import { ActionForm } from "@/components/ui/forms";
import { PlusIcon } from "@/components/ui/icons";
import { Badge, EmptyState, Field, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { TRADE_LABELS, TRADES } from "@/lib/domain/trades";
import { requireUser } from "@/server/auth/current";
import { listSubcontractors } from "@/server/services/subcontractors";

export const metadata = { title: "Subcontractors" };

export default async function SubcontractorsPage({ searchParams }: { searchParams: Promise<{ trade?: string }> }) {
  const user = await requireUser();
  const requested = (await searchParams).trade;
  const trade = TRADES.includes(requested as Trade) ? (requested as Trade) : undefined;
  const [subs, all] = await Promise.all([listSubcontractors(user, trade), trade ? listSubcontractors(user) : null]);
  const total = (all ?? subs).length;

  return (
    <>
      <PageHeader
        title="Subcontractors"
        description="Your company's trade partners. Add them to individual projects from the project page."
        actions={
          <FormDialog
            trigger={
              <>
                <PlusIcon /> Add subcontractor
              </>
            }
            title="Add subcontractor"
          >
            <ActionForm action={createSubcontractorAction} submitLabel="Add subcontractor" pendingLabel="Adding…">
              <Field label="Company name" htmlFor="companyName">
                <input id="companyName" name="companyName" required className="input" />
              </Field>
              <Field label="Trade" htmlFor="trade">
                <select id="trade" name="trade" required defaultValue="" className="input">
                  <option value="" disabled>
                    Choose a trade
                  </option>
                  {TRADES.map((t) => (
                    <option key={t} value={t}>
                      {TRADE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contact name" htmlFor="contactName">
                <input id="contactName" name="contactName" required className="input" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email (optional)" htmlFor="email">
                  <input id="email" name="email" type="email" className="input" />
                </Field>
                <Field label="Phone (optional)" htmlFor="phone">
                  <input id="phone" name="phone" type="tel" className="input" />
                </Field>
              </div>
            </ActionForm>
          </FormDialog>
        }
      />
      <section className="card">
        <FilterBar action="/subcontractors" clearHref="/subcontractors" summary={`Showing ${subs.length} of ${total}`}>
          <FilterSelect
            id="f-trade"
            name="trade"
            label="Trade"
            value={trade}
            options={[{ value: "", label: "All trades" }, ...TRADES.map((t) => ({ value: t, label: TRADE_LABELS[t] }))]}
          />
        </FilterBar>
        {subs.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={trade ? `No ${TRADE_LABELS[trade].toLowerCase()} subcontractors` : "No subcontractors yet"}
            />
          </div>
        ) : (
          <Table label="Subcontractor directory" minWidth={680}>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Trade</Th>
                <Th>Contact</Th>
                <Th className="text-right">Projects</Th>
                <Th className="text-right">Tasks</Th>
              </tr>
            </thead>
            <tbody data-testid="subcontractor-table">
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-canvas/60">
                  <Td className="font-medium">{s.companyName}</Td>
                  <Td>
                    <Badge tone="primary">{TRADE_LABELS[s.trade]}</Badge>
                  </Td>
                  <Td className="text-ink-muted">
                    {s.contactName}
                    <div className="text-xs text-ink-subtle">{[s.email, s.phone].filter(Boolean).join(" · ")}</div>
                  </Td>
                  <Td className="text-right text-ink-muted tabular">{s._count.projects}</Td>
                  <Td className="text-right text-ink-muted tabular">{s._count.tasks}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </>
  );
}
