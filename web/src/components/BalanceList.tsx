import { formatCents } from '../lib/currency'
import type { Balance } from '../lib/types'

type BalanceListProps = {
  balances: Balance[]
  loading: boolean
}

export function BalanceList({ balances, loading }: BalanceListProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Outstanding</p>
          <h2>Member balances</h2>
        </div>
        {loading && <span className="muted">Updating…</span>}
      </div>
      {balances.length === 0 ? (
        <p className="empty-message">No members or balances to display.</p>
      ) : (
        <ul className="balance-list">
          {balances.map((balance) => (
            <li key={balance.memberId}>
              <span>
                <strong>{balance.name}</strong>
                <small>{balance.memberId}</small>
              </span>
              <strong>{formatCents(balance.outstandingCents)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
