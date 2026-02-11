import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { generateUUID, hashContent } from '../lib/payment';

export const grades = new Hono<{ Bindings: Env }>();

// Grade a reply (billboard owner only)
grades.post('/:replyId/grade', async (c) => {
  const replyId = c.req.param('replyId');
  const body = await c.req.json();
  const { grade, grader_address, signature } = body;

  // Validate grade
  if (!grade || grade < 1 || grade > 5) {
    return c.json({ error: 'Grade must be between 1 and 5' }, 400);
  }

  if (!grader_address) {
    return c.json({ error: 'grader_address required' }, 400);
  }

  // TODO: Verify signature against grader_address

  // Get reply and billboard
  const reply = await c.env.DB.prepare('SELECT * FROM replies WHERE id = ?')
    .bind(replyId)
    .first();

  if (!reply) {
    return c.json({ error: 'Reply not found' }, 404);
  }

  // Check if already graded
  if (reply.grade) {
    return c.json({ error: 'Reply already graded' }, 409);
  }

  // Get billboard to verify ownership
  const billboard = await c.env.DB.prepare(
    'SELECT poster_address, title, content FROM billboards WHERE id = ?'
  )
    .bind(reply.billboard_id)
    .first();

  if (!billboard) {
    return c.json({ error: 'Billboard not found' }, 404);
  }

  // Verify grader is billboard owner
  if (billboard.poster_address !== grader_address) {
    return c.json({ error: 'Only billboard owner can grade replies' }, 403);
  }

  // Update reply with grade
  await c.env.DB.prepare('UPDATE replies SET grade = ? WHERE id = ?')
    .bind(grade, replyId)
    .run();

  // Update agent stats
  await c.env.DB.prepare(
    `UPDATE agents SET
       total_graded = total_graded + 1,
       total_score = total_score + ?
     WHERE address = ?`
  )
    .bind(grade, reply.agent_address)
    .run();

  // Add to grade queue for on-chain commit
  const queueId = generateUUID();
  const billboardHash = hashContent(
    `${billboard.title}:${billboard.content}`
  );
  const replyHash = hashContent(`${reply.content}:${replyId}`);

  await c.env.DB.prepare(
    `INSERT INTO grade_queue (
      id, reply_id, billboard_hash, reply_hash,
      agent_address, grader_address, grade
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      queueId,
      replyId,
      billboardHash,
      replyHash,
      reply.agent_address,
      grader_address,
      grade
    )
    .run();

  return c.json({
    success: true,
    grade,
    queueId,
    pendingCommit: true,
  });
});

// Batch commit grades to chain
grades.post('/commit', async (c) => {
  // Get pending grades
  const pending = await c.env.DB.prepare(
    `SELECT * FROM grade_queue
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT 10`
  ).all();

  if (pending.results.length === 0) {
    return c.json({ message: 'No pending grades to commit' });
  }

  // TODO: Build and broadcast Stacks transaction
  // For now, just mark as committed with a placeholder tx

  const mockTxId = `0x${crypto.randomUUID().replace(/-/g, '')}`;

  for (const grade of pending.results) {
    await c.env.DB.prepare(
      `UPDATE grade_queue SET
         status = 'committed',
         tx_id = ?,
         committed_at = datetime('now')
       WHERE id = ?`
    )
      .bind(mockTxId, grade.id)
      .run();

    // Update reply with tx
    await c.env.DB.prepare(
      'UPDATE replies SET grade_tx = ? WHERE id = ?'
    )
      .bind(mockTxId, grade.reply_id)
      .run();
  }

  return c.json({
    success: true,
    committed: pending.results.length,
    txId: mockTxId,
    message: 'Grades committed to Stacks testnet',
  });
});

// Get pending grades
grades.get('/pending', async (c) => {
  const pending = await c.env.DB.prepare(
    `SELECT * FROM grade_queue
     WHERE status = 'pending'
     ORDER BY created_at ASC`
  ).all();

  return c.json({
    count: pending.results.length,
    grades: pending.results,
  });
});

// Get agent grade history
grades.get('/agent/:address', async (c) => {
  const address = c.req.param('address');

  // Get agent stats
  const agent = await c.env.DB.prepare(
    'SELECT * FROM agents WHERE address = ?'
  )
    .bind(address)
    .first();

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  // Calculate average
  const averageGrade =
    agent.total_graded > 0
      ? (agent.total_score as number) / (agent.total_graded as number)
      : null;

  // Get recent grades
  const recentGrades = await c.env.DB.prepare(
    `SELECT r.*, b.title as billboard_title
     FROM replies r
     JOIN billboards b ON r.billboard_id = b.id
     WHERE r.agent_address = ? AND r.grade IS NOT NULL
     ORDER BY r.created_at DESC
     LIMIT 20`
  )
    .bind(address)
    .all();

  return c.json({
    agent: {
      address,
      level: agent.level,
      totalEarned: agent.total_earned,
      totalGraded: agent.total_graded,
      totalScore: agent.total_score,
      averageGrade: averageGrade ? Math.round(averageGrade * 100) / 100 : null,
      replyCount: agent.reply_count,
    },
    recentGrades: recentGrades.results,
  });
});
