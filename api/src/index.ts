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

export default app
