import type { BalancesResponse, BillsResponse } from './types'

const REQUEST_TIMEOUT_MS = 10_000

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(path, { ...init, signal: controller.signal })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : 'The request failed'
      throw new ApiError(message, response.status)
    }
    return payload as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('The request timed out. Please try again.', 408)
    }
    if (error instanceof TypeError) {
      throw new ApiError('The API is unavailable. Please try again.', 0)
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function isBillsResponse(payload: unknown): payload is BillsResponse {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'bills' in payload &&
    Array.isArray(payload.bills)
  )
}

function isBalancesResponse(payload: unknown): payload is BalancesResponse {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'balances' in payload &&
    Array.isArray(payload.balances)
  )
}

export async function getBills(homeId: string): Promise<BillsResponse> {
  const payload = await request<unknown>(`/api/homes/${encodeURIComponent(homeId)}/bills`)
  if (!isBillsResponse(payload)) throw new ApiError('The bills response was invalid.', 502)
  return payload
}

export async function getBalances(homeId: string): Promise<BalancesResponse> {
  const payload = await request<unknown>(`/api/homes/${encodeURIComponent(homeId)}/balances`)
  if (!isBalancesResponse(payload)) throw new ApiError('The balances response was invalid.', 502)
  return payload
}

export function payShare(
  billId: string,
  shareId: string,
  idempotencyKey: string,
): Promise<{ id: string; memberId: string; amountCents: number; paidAt: string }> {
  return request(
    `/api/bills/${encodeURIComponent(billId)}/shares/${encodeURIComponent(shareId)}/pay`,
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    },
  )
}
