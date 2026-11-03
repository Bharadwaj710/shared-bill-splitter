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

export default app
