import { describe, expect, it } from 'vitest'
import { type Bill, call, createBill, createHome } from './helpers'

describe('retrieve bills', () => {
  it('returns bills and shares in bill and member order', async () => {
    const { homeId, members } = await createHome(['Asha', 'Ben'])
    const first = await createBill(homeId, 1000)
    const second = await createBill(homeId, 300)

    const result = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)

    expect(result.status).toBe(200)
    expect(result.body.bills.map((bill) => bill.id).sort()).toEqual(
      [first.body.id, second.body.id].sort(),
    )
    const firstRetrievedBill = result.body.bills.find((bill) => bill.id === first.body.id)
    expect(firstRetrievedBill?.shares.map((share) => share.memberId)).toEqual([
      members[0]?.id,
      members[1]?.id,
    ])
    expect(firstRetrievedBill?.shares.map((share) => share.paidAt)).toEqual([null, null])
  })

  it('returns an empty list for an existing home without bills', async () => {
    const { homeId } = await createHome([])

    const result = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ bills: [] })
  })

  it('returns 404 for an unknown home', async () => {
    const result = await call<{ error: string }>('GET', '/api/homes/unknown-home/bills')

    expect(result.status).toBe(404)
    expect(result.body).toEqual({ error: 'Home not found' })
  })
})
