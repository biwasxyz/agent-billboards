/**
 * Stacks service - Contract interaction for on-chain grading
 */

export interface GradeCommit {
  billboardHash: string;
  replyHash: string;
  agent: string;
  grader: string;
  grade: number;
}

export interface AgentReputation {
  totalGraded: number;
  totalScore: number;
  averageBp: number; // basis points (4000 = 4.0)
}

const TESTNET_API = 'https://api.testnet.hiro.so';
const MAINNET_API = 'https://api.hiro.so';

export function getApiUrl(network: string): string {
  return network === 'mainnet' ? MAINNET_API : TESTNET_API;
}

export async function getAccountNonce(
  address: string,
  network: string
): Promise<number> {
  const apiUrl = getApiUrl(network);
  const response = await fetch(`${apiUrl}/extended/v1/address/${address}/nonces`);

  if (!response.ok) {
    throw new Error('Failed to fetch nonce');
  }

  const data = (await response.json()) as any;
  return data.possible_next_nonce || 0;
}

export async function broadcastTransaction(
  txHex: string,
  network: string
): Promise<string> {
  const apiUrl = getApiUrl(network);
  const response = await fetch(`${apiUrl}/v2/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/hex',
    },
    body: txHex,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Broadcast failed: ${error}`);
  }

  const data = (await response.json()) as any;
  return data.txid;
}

export async function getAgentReputation(
  contractAddress: string,
  contractName: string,
  agentAddress: string,
  network: string
): Promise<AgentReputation | null> {
  const apiUrl = getApiUrl(network);
  const url = `${apiUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/get-agent-reputation`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: contractAddress,
      arguments: [cvToHex(principalCV(agentAddress))],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as any;

  if (!data.okay || data.result === '0x09') {
    // none
    return null;
  }

  // Parse the response (simplified - would need proper CV parsing)
  return {
    totalGraded: 0,
    totalScore: 0,
    averageBp: 0,
  };
}

// Simplified Clarity value helpers
function principalCV(address: string): string {
  return address;
}

function cvToHex(cv: string): string {
  // Simplified - would need proper serialization
  return '0x' + Buffer.from(cv).toString('hex');
}

export async function verifyTransaction(
  txId: string,
  network: string
): Promise<{ success: boolean; status: string }> {
  const apiUrl = getApiUrl(network);
  const response = await fetch(`${apiUrl}/extended/v1/tx/${txId}`);

  if (!response.ok) {
    return { success: false, status: 'not_found' };
  }

  const data = (await response.json()) as any;

  return {
    success: data.tx_status === 'success',
    status: data.tx_status,
  };
}
