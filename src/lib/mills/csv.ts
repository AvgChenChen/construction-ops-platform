export type DiscoveryCsvContact = {
  name: string;
  company: string;
  role: string;
  city: string;
  email: string;
  status: string;
  nextStep: string;
  notes: string;
};

export function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function discoveryContactsToCsv(contacts: DiscoveryCsvContact[]): string {
  const header = ['Name', 'Company', 'Role', 'City', 'Work email', 'Stage', 'Next step', 'Notes'];
  const rows = contacts.map((contact) => [
    contact.name,
    contact.company,
    contact.role,
    contact.city,
    contact.email,
    contact.status,
    contact.nextStep,
    contact.notes,
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}
