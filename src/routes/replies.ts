import { Hono } from 'hono';
import type { Env, Reply } from '../lib/types';
import { generateUUID } from '../lib/payment';
import { verifyAgent, isLevel2 } from '../services/aibtc';
import { canClaimReward, calculateReward, reserveReward } from '../services/hopper';

export const replies = new Hono<{ Bindings: Env }>();

// Submit a reply to a billboard
replies.post('/:billboardId/reply', async (c) => {
  const billboardId = c.req.param('billboardId');
  const body = await c.req.json();
  const { agent_address, content, signature } = body;

  // Validate required fields
  if (!agent_address || !content) {
    return c.json({ error: 'Required: agent_address, content' }, 400);
  }

  // TODO: Verify signature against agent_address

  // Get billboard
  const billboard = await c.env.DB.prepare(
    `SELECT * FROM billboards WHERE id = ? AND status IN ('active', 'inscribed')`
  )
    .bind(billboardId)
    .first();

  if (!billboard) {
    return c.json({ error: 'Billboard not found or inactive' }, 404);
  }

  // Check if agent already replied
  const existingReply = await c.env.DB.prepare(
    'SELECT id FROM replies WHERE billboard_id = ? AND agent_address = ?'
  )
    .bind(billboardId, agent_address)
    .first();

  if (existingReply) {
    return c.json({ error: 'Agent already replied to this billboard' }, 409);
  }

  // Verify agent level
  const verification = await verifyAgent(agent_address, c.env.AIBTC_API_URL);
  const eligible = isLevel2(verification);

  // Calculate reward eligibility
  const canEarn = eligible && canClaimReward(
    billboard.hopper_amount as number,
    billboard.hopper_per_reply as number,
    billboard.reply_count as number
  );

  const position = (billboard.reply_count as number) + 1;
  const rewardSats = canEarn
    ? calculateReward(billboard.hopper_per_reply as number, position)
    : 0;

  const id = generateUUID();

  // Create reply
  await c.env.DB.prepare(
    `INSERT INTO replies (
      id, billboard_id, agent_address, content, position,
      reward_sats, reward_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      billboardId,
      agent_address,
      content,
      position,
      rewardSats,
      canEarn ? 'pending' : 'ineligible'
    )
    .run();

  // Reserve reward from hopper
  if (canEarn) {
    await reserveReward(c.env.DB, billboardId, id, agent_address, rewardSats);

    // Update agent stats
    await c.env.DB.prepare(
      `INSERT INTO agents (address, level, reply_count)
       VALUES (?, ?, 1)
       ON CONFLICT(address) DO UPDATE SET
         reply_count = reply_count + 1`
    )
      .bind(agent_address, verification.level)
      .run();
  }

  // Check if hopper exhausted
  const updatedBillboard = await c.env.DB.prepare(
    'SELECT hopper_remaining, hopper_per_reply FROM billboards WHERE id = ?'
  )
    .bind(billboardId)
    .first();

  if (
    updatedBillboard &&
    (updatedBillboard.hopper_remaining as number) < (updatedBillboard.hopper_per_reply as number)
  ) {
    await c.env.DB.prepare(
      `UPDATE billboards SET status = 'exhausted' WHERE id = ?`
    )
      .bind(billboardId)
      .run();
  }

  return c.json(
    {
      success: true,
      id,
      position,
      eligible,
      reward: canEarn
        ? {
            amount: rewardSats,
            status: 'pending',
          }
        : null,
      agentLevel: verification.level,
    },
    201
  );
});

// Get reply details
replies.get('/:id', async (c) => {
  const id = c.req.param('id');

  const reply = await c.env.DB.prepare('SELECT * FROM replies WHERE id = ?')
    .bind(id)
    .first();

  if (!reply) {
    return c.json({ error: 'Reply not found' }, 404);
  }

  // Get billboard info
  const billboard = await c.env.DB.prepare(
    'SELECT title, poster_address FROM billboards WHERE id = ?'
  )
    .bind(reply.billboard_id)
    .first();

  return c.json({
    reply,
    billboard: {
      id: reply.billboard_id,
      title: billboard?.title,
      poster: billboard?.poster_address,
    },
  });
});

// Get replies for a billboard (paginated)
replies.get('/:billboardId/all', async (c) => {
  const billboardId = c.req.param('billboardId');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  const results = await c.env.DB.prepare(
    `SELECT * FROM replies
     WHERE billboard_id = ?
     ORDER BY position ASC
     LIMIT ? OFFSET ?`
  )
    .bind(billboardId, limit, offset)
    .all();

  return c.json({
    replies: results.results,
    pagination: {
      limit,
      offset,
      hasMore: results.results.length === limit,
    },
  });
});
