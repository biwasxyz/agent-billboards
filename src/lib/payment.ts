import type { X402Payment, Env } from './types';

export function createX402Response(
  env: Env,
  resource: string,
  description: string,
  postingFee: number,
  hopperMin: number
): X402Payment {
  return {
    version: '1',
    networks: ['stacks-testnet'],
    amounts: {
      stx: postingFee + hopperMin,
    },
    payTo: env.TREASURY_ADDRESS,
    resource,
    description,
    mimeType: 'application/json',
    maxTimeSeconds: 300,
  };
}

export function parsePaymentHeader(header: string | undefined): {
  txId: string;
  amount: number;
} | null {
  if (!header) return null;

  try {
    const parsed = JSON.parse(header);
    return {
      txId: parsed.txId || parsed.tx_id,
      amount: parsed.amount || 0,
    };
  } catch {
    // Might be just a txId string
    if (header.match(/^0x[a-fA-F0-9]{64}$/)) {
      return { txId: header, amount: 0 };
    }
    return null;
  }
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function hashContent(content: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  return Array.from(new Uint8Array(data))
    .slice(0, 32)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
