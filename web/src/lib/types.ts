export type Share = {
  id: string
  memberId: string
  amountCents: number
  paidAt: string | null
}

export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}

export type Balance = {
  memberId: string
  name: string
  outstandingCents: number
}

export type BillsResponse = { bills: Bill[] }
export type BalancesResponse = { balances: Balance[] }
