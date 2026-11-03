import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { BalanceList } from '../components/BalanceList'
import { BillList } from '../components/BillList'
import { HomeSelector } from '../components/HomeSelector'
import { ApiError, getBalances, getBills, payShare } from '../lib/api'
import type { Balance, Bill } from '../lib/types'
import '../styles.css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [homeId, setHomeId] = useState(() => localStorage.getItem('selected-home-id') ?? '')
  const [inputHomeId, setInputHomeId] = useState(homeId)
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(Boolean(homeId))
  const [billsLoading, setBillsLoading] = useState(false)
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({})
  const [paymentSuccesses, setPaymentSuccesses] = useState<Record<string, string>>({})
  const [payingShareId, setPayingShareId] = useState<string | null>(null)
  const [paymentKeys] = useState(() => new Map<string, string>())

  const loadHome = useCallback(async (selectedHomeId: string) => {
    const trimmedId = selectedHomeId.trim()
    if (!trimmedId) return
    setHomeId(trimmedId)
    setInputHomeId(trimmedId)
    localStorage.setItem('selected-home-id', trimmedId)
    setError(null)
    setBills([])
    setBalances([])
    setPaymentErrors({})
    setPaymentSuccesses({})
    setLoading(true)
    setBillsLoading(true)
    setBalancesLoading(true)
    const [billsResult, balancesResult] = await Promise.allSettled([
      getBills(trimmedId),
      getBalances(trimmedId),
    ])
    setLoading(false)
    setBillsLoading(false)
    setBalancesLoading(false)

    const failures = [billsResult, balancesResult].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    if (failures.length > 0) {
      const firstError = failures[0]?.reason
      setError(
        firstError instanceof ApiError && firstError.status === 404
          ? 'Home not found. Check the ID and try again.'
          : firstError instanceof Error
            ? firstError.message
            : 'Could not load this home.',
      )
    }
    if (billsResult.status === 'fulfilled') setBills(billsResult.value.bills)
    if (balancesResult.status === 'fulfilled') setBalances(balancesResult.value.balances)
  }, [])

  useEffect(() => {
    if (homeId) void loadHome(homeId)
  }, [homeId, loadHome])

  const handlePay = async (billId: string, shareId: string) => {
    const key = paymentKeys.get(shareId) ?? crypto.randomUUID()
    paymentKeys.set(shareId, key)
    setPaymentErrors((current) => ({ ...current, [shareId]: '' }))
    setPaymentSuccesses((current) => ({ ...current, [shareId]: '' }))
    setPayingShareId(shareId)
    try {
      await payShare(billId, shareId, key)
      setPaymentSuccesses((current) => ({ ...current, [shareId]: 'Payment confirmed' }))
      if (homeId) await loadHome(homeId)
    } catch (paymentError) {
      setPaymentErrors((current) => ({
        ...current,
        [shareId]:
          paymentError instanceof Error
            ? paymentError.message
            : 'Payment failed. Please try again.',
      }))
    } finally {
      setPayingShareId(null)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Shared household payments</p>
        <h1>Shared Bill Splitter</h1>
        <p>See what is owed and keep every payment in sync.</p>
      </header>
      <main className="content">
        <div className="main-column">
          <section className="panel">
            <HomeSelector
              value={inputHomeId}
              onChange={setInputHomeId}
              onSubmit={() => void loadHome(inputHomeId)}
              disabled={loading}
            />
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </section>
          {homeId && (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Home bills</p>
                  <h2>Recent bills and shares</h2>
                </div>
                {billsLoading && <span className="muted">Loading bills…</span>}
              </div>
              {billsLoading ? (
                <p className="loading-message">Loading bills…</p>
              ) : (
                <BillList
                  bills={bills}
                  balances={balances}
                  payingShareId={payingShareId}
                  paymentErrors={paymentErrors}
                  paymentSuccesses={paymentSuccesses}
                  onPay={(billId, shareId) => void handlePay(billId, shareId)}
                />
              )}
            </>
          )}
        </div>
        {homeId && (
          <aside className="side-column">
            <BalanceList balances={balances} loading={balancesLoading} />
          </aside>
        )}
      </main>
    </div>
  )
}
