export function formatCents(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`
}
