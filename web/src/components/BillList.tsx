import { formatCents } from '../lib/currency'
import type { Balance, Bill } from '../lib/types'

type BillListProps = {
  bills: Bill[]
  balances: Balance[]
  payingShareId: string | null
  paymentErrors: Record<string, string>
  paymentSuccesses: Record<string, string>
  onPay: (billId: string, shareId: string) => void
}

export function BillList({
  bills,
  balances,
  payingShareId,
  paymentErrors,
  paymentSuccesses,
  onPay,
}: BillListProps) {
  const memberNames = new Map(balances.map((balance) => [balance.memberId, balance.name]))

  if (bills.length === 0) {
    return <p className="empty-message panel">No bills have been added to this home yet.</p>
  }

  return (
    <section className="bill-list" aria-label="Bills">
      {bills.map((bill) => (
        <article className="panel bill-card" key={bill.id}>
          <div className="bill-card__header">
            <div>
              <p className="eyebrow">Bill</p>
              <h2>{bill.title}</h2>
              <small>{bill.id}</small>
            </div>
            <strong className="bill-total">{formatCents(bill.totalCents)}</strong>
          </div>
          <ul className="share-list">
            {bill.shares.map((share) => {
              const isPaying = payingShareId === share.id
              const error = paymentErrors[share.id]
              const success = paymentSuccesses[share.id]
              return (
                <li className="share-row" key={share.id}>
                  <span>
                    <strong>{memberNames.get(share.memberId) ?? 'Member'}</strong>
                    <small>{share.memberId}</small>
                  </span>
                  <span className="share-row__amount">{formatCents(share.amountCents)}</span>
                  {share.paidAt ? (
                    <span className="status status--paid">Paid</span>
                  ) : (
                    <button
                      type="button"
                      className="button--small"
                      disabled={isPaying}
                      onClick={() => onPay(bill.id, share.id)}
                    >
                      {isPaying ? 'Paying…' : 'Pay'}
                    </button>
                  )}
                  {error && <span className="share-message share-message--error">{error}</span>}
                  {!error && (success || share.paidAt) && (
                    <span className="share-message share-message--success">
                      {success ?? 'Payment confirmed'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </article>
      ))}
    </section>
  )
}
