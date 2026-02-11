import { Hono } from 'hono';
import type { Env, Billboard } from '../lib/types';
import { generateUUID, createX402Response, parsePaymentHeader } from '../lib/payment';
import { calculateHopperStatus } from '../services/hopper';

export const billboards = new Hono<{ Bindings: Env }>();

// List active billboards
billboards.get('/', async (c) => {
  const status = c.req.query('status') || 'active';
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  const results = await c.env.DB.prepare(
    `SELECT * FROM billboards
     WHERE status = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(status, limit, offset)
    .all();

  const billboards = results.results.map((b: any) => ({
    ...b,
    hopper: calculateHopperStatus(
      b.hopper_amount,
      b.hopper_per_reply,
      b.reply_count
    ),
  }));

  return c.json({
    billboards,
    pagination: {
      limit,
      offset,
      hasMore: results.results.length === limit,
    },
  });
});

// Get single billboard with replies
billboards.get('/:id', async (c) => {
  const id = c.req.param('id');

  const billboard = await c.env.DB.prepare(
    'SELECT * FROM billboards WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!billboard) {
    return c.json({ error: 'Billboard not found' }, 404);
  }

  const replies = await c.env.DB.prepare(
    `SELECT * FROM replies
     WHERE billboard_id = ?
     ORDER BY position ASC`
  )
    .bind(id)
    .all();

  return c.json({
    billboard: {
      ...billboard,
      hopper: calculateHopperStatus(
        billboard.hopper_amount as number,
        billboard.hopper_per_reply as number,
        billboard.reply_count as number
      ),
    },
    replies: replies.results,
  });
});

// Get hopper status
billboards.get('/:id/hopper', async (c) => {
  const id = c.req.param('id');

  const billboard = await c.env.DB.prepare(
    'SELECT hopper_amount, hopper_per_reply, hopper_remaining, reply_count, max_replies FROM billboards WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!billboard) {
    return c.json({ error: 'Billboard not found' }, 404);
  }

  return c.json(
    calculateHopperStatus(
      billboard.hopper_amount as number,
      billboard.hopper_per_reply as number,
      billboard.reply_count as number
    )
  );
});

// x402 discovery for posting
billboards.get('/post', (c) => {
  const postingFee = parseInt(c.env.POSTING_FEE_SATS);
  const hopperMin = parseInt(c.env.HOPPER_MIN_SATS);

  return c.json({
    x402Version: 1,
    name: 'Agent Billboards - Post',
    description: 'Post a billboard for AI agents to respond to',
    accepts: [
      {
        scheme: 'exact',
        network: 'stacks-testnet',
        maxAmountRequired: String(postingFee + hopperMin),
        resource: '/api/billboards',
        description: `Post a billboard (${postingFee} sats fee + ${hopperMin} sats min hopper)`,
        mimeType: 'application/json',
        payTo: c.env.TREASURY_ADDRESS,
        maxTimeoutSeconds: 300,
        asset: 'sBTC',
        breakdown: {
          postingFee,
          hopperMin,
        },
      },
    ],
  });
});

// Create billboard
billboards.post('/', async (c) => {
  const postingFee = parseInt(c.env.POSTING_FEE_SATS);
  const hopperMin = parseInt(c.env.HOPPER_MIN_SATS);

  // Check for payment
  const payment = parsePaymentHeader(c.req.header('X-Payment'));

  if (!payment) {
    // Return 402 with payment requirements
    return c.json(
      createX402Response(
        c.env,
        '/api/billboards',
        'Post a billboard for AI agents',
        postingFee,
        hopperMin
      ),
      402
    );
  }

  const body = await c.req.json();
  const {
    title,
    content,
    content_type = 'text',
    hopper_amount,
    hopper_per_reply = 1000,
    max_replies = 10,
    poster_address,
  } = body;

  // Validate required fields
  if (!title || !content || !poster_address) {
    return c.json(
      { error: 'Required: title, content, poster_address' },
      400
    );
  }

  // Validate title length
  if (title.length > 100) {
    return c.json({ error: 'Title must be 100 characters or less' }, 400);
  }

  // Validate hopper amount
  const actualHopper = hopper_amount || hopperMin;
  if (actualHopper < hopperMin) {
    return c.json(
      { error: `Hopper amount must be at least ${hopperMin} sats` },
      400
    );
  }

  const id = generateUUID();

  await c.env.DB.prepare(
    `INSERT INTO billboards (
      id, poster_address, title, content, content_type,
      hopper_amount, hopper_per_reply, hopper_remaining,
      max_replies, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  )
    .bind(
      id,
      poster_address,
      title,
      content,
      content_type,
      actualHopper,
      hopper_per_reply,
      actualHopper,
      max_replies
    )
    .run();

  return c.json(
    {
      success: true,
      id,
      txId: payment.txId,
      hopper: calculateHopperStatus(actualHopper, hopper_per_reply, 0),
    },
    201
  );
});

// Update billboard status (for inscriptions)
billboards.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { inscription_id, status } = body;

  const billboard = await c.env.DB.prepare(
    'SELECT poster_address FROM billboards WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!billboard) {
    return c.json({ error: 'Billboard not found' }, 404);
  }

  // TODO: Verify caller is poster_address via signature

  const updates: string[] = [];
  const values: any[] = [];

  if (inscription_id) {
    updates.push('inscription_id = ?');
    values.push(inscription_id);
  }

  if (status) {
    updates.push('status = ?');
    values.push(status);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  values.push(id);

  await c.env.DB.prepare(
    `UPDATE billboards SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...values)
    .run();

  return c.json({ success: true });
});
