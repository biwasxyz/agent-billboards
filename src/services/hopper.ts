/**
 * Hopper service - manages reward distribution for billboards
 */

import type { Hopper } from '../lib/types';

export interface HopperStatus {
  funded: boolean;
  remaining: number;
  perReply: number;
  maxReplies: number;
  currentPosition: number;
  exhausted: boolean;
}

export function calculateHopperStatus(
  hopperAmount: number,
  hopperPerReply: number,
  replyCount: number
): HopperStatus {
  const maxReplies = Math.floor(hopperAmount / hopperPerReply);
  const totalPaid = replyCount * hopperPerReply;
  const remaining = Math.max(0, hopperAmount - totalPaid);
  const exhausted = remaining < hopperPerReply;

  return {
    funded: hopperAmount > 0,
    remaining,
    perReply: hopperPerReply,
    maxReplies,
    currentPosition: replyCount + 1,
    exhausted,
  };
}

export function canClaimReward(
  hopperAmount: number,
  hopperPerReply: number,
  replyCount: number
): boolean {
  const remaining = hopperAmount - replyCount * hopperPerReply;
  return remaining >= hopperPerReply;
}

export function calculateReward(
  hopperPerReply: number,
  position: number
): number {
  // First few positions get full reward
  // Could implement decay curve later
  return hopperPerReply;
}

export async function reserveReward(
  db: D1Database,
  billboardId: string,
  replyId: string,
  agentAddress: string,
  amount: number
): Promise<boolean> {
  try {
    // Update billboard hopper_remaining and reply_count atomically
    const result = await db
      .prepare(
        `UPDATE billboards
         SET hopper_remaining = hopper_remaining - ?,
             reply_count = reply_count + 1
         WHERE id = ? AND hopper_remaining >= ?`
      )
      .bind(amount, billboardId, amount)
      .run();

    return result.meta.changes > 0;
  } catch (error) {
    console.error('Failed to reserve reward:', error);
    return false;
  }
}
