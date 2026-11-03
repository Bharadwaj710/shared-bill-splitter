import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getName(value: unknown): string | null {
  if (!isObject(value) || typeof value.name !== 'string') return null

  const name = value.name.trim()
  return name.length > 0 ? name : null
}

function getTitle(value: unknown): string | null {
  if (!isObject(value) || typeof value.title !== 'string') return null

  const title = value.title.trim()
  return title.length > 0 ? title : null
}

function getTotalCents(value: unknown): number | null {
  if (!isObject(value) || typeof value.totalCents !== 'number') return null

  return Number.isSafeInteger(value.totalCents) && value.totalCents > 0 ? value.totalCents : null
}

app.post('/api/homes', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400)
  }

  const name = getName(body)
  if (name === null) {
    return c.json({ error: 'Name must be a non-empty string' }, 422)
  }

  const id = crypto.randomUUID()
  try {
    const home = await c.env.DB.prepare(
      `INSERT INTO homes (id, name)
       VALUES (?, ?)
       RETURNING id, name`,
    )
      .bind(id, name)
      .first<{ id: string; name: string }>()

    if (home === null) {
      return c.json({ error: 'Home could not be created' }, 500)
    }

    return c.json(home, 201)
  } catch {
    return c.json({ error: 'Failed to create home' }, 500)
  }
})

app.post('/api/homes/:homeId/members', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400)
  }

  const name = getName(body)
  if (name === null) {
    return c.json({ error: 'Name must be a non-empty string' }, 422)
  }

  const homeId = c.req.param('homeId')
  const id = crypto.randomUUID()
  try {
    const member = await c.env.DB.prepare(
      `INSERT INTO members (id, home_id, name, member_order)
       SELECT
         ?,
         h.id,
         ?,
         COALESCE(
           (SELECT MAX(member_order)
            FROM members
            WHERE home_id = h.id),
           0
         ) + 1
       FROM homes h
       WHERE h.id = ?
       RETURNING id, home_id, name`,
    )
      .bind(id, name, homeId)
      .first<{ id: string; home_id: string; name: string }>()

    if (member === null) {
      return c.json({ error: 'Home not found' }, 404)
    }

    return c.json({ id: member.id, homeId: member.home_id, name: member.name }, 201)
  } catch {
    return c.json({ error: 'Failed to create member' }, 500)
  }
})

app.post('/api/homes/:homeId/bills', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400)
  }

  const title = getTitle(body)
  const totalCents = getTotalCents(body)
  if (title === null) {
    return c.json({ error: 'Title must be a non-empty string' }, 422)
  }
  if (totalCents === null) {
    return c.json({ error: 'Total cents must be a positive safe integer' }, 422)
  }

  const homeId = c.req.param('homeId')
  try {
    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?')
      .bind(homeId)
      .first<{ id: string }>()
    if (home === null) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const members = await c.env.DB.prepare(
      `SELECT id
       FROM members
       WHERE home_id = ?
       ORDER BY member_order ASC`,
    )
      .bind(homeId)
      .all<{ id: string }>()

    if (members.results.length === 0) {
      return c.json({ error: 'Home has no members' }, 422)
    }

    const billId = crypto.randomUUID()
    const memberCount = members.results.length
    const baseAmount = Math.floor(totalCents / memberCount)
    const remainder = totalCents % memberCount
    const shares = members.results.map((member, index) => ({
      id: crypto.randomUUID(),
      memberId: member.id,
      amountCents: baseAmount + (index < remainder ? 1 : 0),
    }))
    const billStatement = c.env.DB.prepare(
      `INSERT INTO bills (id, home_id, title, total_cents)
       VALUES (?, ?, ?, ?)`,
    ).bind(billId, homeId, title, totalCents)
    const shareStatements = shares.map((share) => {
      return c.env.DB.prepare(
        `INSERT INTO shares (id, bill_id, member_id, home_id, amount_cents)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(share.id, billId, share.memberId, homeId, share.amountCents)
    })

    await c.env.DB.batch([billStatement, ...shareStatements])

    return c.json(
      {
        id: billId,
        homeId,
        title,
        totalCents,
        shares: shares.map((share) => ({
          id: share.id,
          memberId: share.memberId,
          amountCents: share.amountCents,
          paidAt: null,
        })),
      },
      201,
    )
  } catch {
    return c.json({ error: 'Failed to create bill' }, 500)
  }
})

app.get('/api/homes/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')

  try {
    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?')
      .bind(homeId)
      .first<{ id: string }>()
    if (home === null) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const bills = await c.env.DB.prepare(
      `SELECT id, home_id, title, total_cents
       FROM bills
       WHERE home_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
      .bind(homeId)
      .all<{
        id: string
        home_id: string
        title: string
        total_cents: number
      }>()

    const shares = await c.env.DB.prepare(
      `SELECT
         s.id,
         s.bill_id,
         s.member_id,
         s.amount_cents,
         s.paid_at,
         m.member_order
       FROM shares s
       JOIN members m
         ON m.id = s.member_id
        AND m.home_id = s.home_id
       WHERE s.home_id = ?
       ORDER BY s.bill_id ASC, m.member_order ASC, s.id ASC`,
    )
      .bind(homeId)
      .all<{
        id: string
        bill_id: string
        member_id: string
        amount_cents: number
        paid_at: string | null
        member_order: number
      }>()

    const sharesByBill = new Map<
      string,
      Array<{
        id: string
        memberId: string
        amountCents: number
        paidAt: string | null
      }>
    >()
    for (const share of shares.results) {
      const billShares = sharesByBill.get(share.bill_id) ?? []
      billShares.push({
        id: share.id,
        memberId: share.member_id,
        amountCents: share.amount_cents,
        paidAt: share.paid_at,
      })
      sharesByBill.set(share.bill_id, billShares)
    }

    return c.json(
      {
        bills: bills.results.map((bill) => ({
          id: bill.id,
          homeId: bill.home_id,
          title: bill.title,
          totalCents: bill.total_cents,
          shares: sharesByBill.get(bill.id) ?? [],
        })),
      },
      200,
    )
  } catch {
    return c.json({ error: 'Failed to retrieve bills' }, 500)
  }
})

app.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  const idempotencyKey = c.req.header('Idempotency-Key')?.trim()
  if (!idempotencyKey) {
    return c.json({ error: 'Idempotency-Key header is required' }, 400)
  }

  const billId = c.req.param('billId')
  const shareId = c.req.param('shareId')
  const paidAt = new Date().toISOString()

  try {
    const paidShare = await c.env.DB.prepare(
      `UPDATE shares
       SET paid_at = ?, idempotency_key = ?
       WHERE id = ?
         AND bill_id = ?
         AND paid_at IS NULL
       RETURNING id, member_id, amount_cents, paid_at`,
    )
      .bind(paidAt, idempotencyKey, shareId, billId)
      .first<{
        id: string
        member_id: string
        amount_cents: number
        paid_at: string
      }>()

    if (paidShare !== null) {
      return c.json(
        {
          id: paidShare.id,
          memberId: paidShare.member_id,
          amountCents: paidShare.amount_cents,
          paidAt: paidShare.paid_at,
        },
        200,
      )
    }

    const existingShare = await c.env.DB.prepare(
      `SELECT id, member_id, amount_cents, paid_at, idempotency_key
       FROM shares
       WHERE id = ?
         AND bill_id = ?`,
    )
      .bind(shareId, billId)
      .first<{
        id: string
        member_id: string
        amount_cents: number
        paid_at: string | null
        idempotency_key: string | null
      }>()

    if (existingShare === null) {
      return c.json({ error: 'Bill or share not found' }, 404)
    }

    if (existingShare.idempotency_key === idempotencyKey) {
      return c.json(
        {
          id: existingShare.id,
          memberId: existingShare.member_id,
          amountCents: existingShare.amount_cents,
          paidAt: existingShare.paid_at,
        },
        200,
      )
    }

    return c.json({ error: 'Share has already been paid' }, 409)
  } catch {
    return c.json({ error: 'Failed to pay share' }, 500)
  }
})

app.get('/api/homes/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')

  try {
    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?')
      .bind(homeId)
      .first<{ id: string }>()
    if (home === null) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const result = await c.env.DB.prepare(
      `SELECT
         m.id AS memberId,
         m.name AS name,
         COALESCE(SUM(s.amount_cents), 0) AS outstandingCents
       FROM members m
       LEFT JOIN shares s
         ON s.member_id = m.id
        AND s.home_id = m.home_id
        AND s.paid_at IS NULL
       WHERE m.home_id = ?
       GROUP BY m.id, m.name, m.member_order
       ORDER BY m.member_order ASC`,
    )
      .bind(homeId)
      .all<{
        memberId: string
        name: string
        outstandingCents: number
      }>()

    return c.json({ balances: result.results }, 200)
  } catch {
    return c.json({ error: 'Failed to retrieve balances' }, 500)
  }
})

export default app
