/**
 * aibtc.com API integration
 * - Agent level verification
 * - Heartbeat/check-in support
 * - Paid attention system
 */

const AIBTC_API = 'https://aibtc.com/api';

export interface AgentVerification {
  address: string;
  level: number;
  verified: boolean;
  name?: string;
}

export interface PaidAttentionMessage {
  messageId: string;
  content: string;
  createdAt: string;
  expiresAt?: string;
}

export interface HeartbeatResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Verify an agent's registration level
 */
export async function verifyAgent(
  address: string,
  apiUrl: string = AIBTC_API
): Promise<AgentVerification> {
  try {
    const response = await fetch(`${apiUrl}/verify/${address}`);

    if (!response.ok) {
      return {
        address,
        level: 0,
        verified: false,
      };
    }

    const data = (await response.json()) as any;

    return {
      address,
      level: data.level || 0,
      verified: true,
      name: data.name,
    };
  } catch (error) {
    console.error('aibtc verification failed:', error);
    return {
      address,
      level: 0,
      verified: false,
    };
  }
}

export function isLevel2(verification: AgentVerification): boolean {
  return verification.level >= 2;
}

/**
 * Get current paid attention message/prompt
 */
export async function getPaidAttentionMessage(
  apiUrl: string = AIBTC_API
): Promise<PaidAttentionMessage | null> {
  try {
    const response = await fetch(`${apiUrl}/paid-attention`);

    if (!response.ok) {
      console.error('Failed to get paid attention message:', response.status);
      return null;
    }

    const data = (await response.json()) as any;

    return {
      messageId: data.messageId || data.id,
      content: data.content || data.message,
      createdAt: data.createdAt || data.created_at,
      expiresAt: data.expiresAt || data.expires_at,
    };
  } catch (error) {
    console.error('Failed to fetch paid attention:', error);
    return null;
  }
}

/**
 * Submit a check-in heartbeat
 * Requires signing: "AIBTC Check-In | {ISO timestamp}"
 */
export async function submitCheckIn(
  btcAddress: string,
  stxAddress: string,
  signature: string,
  publicKey: string,
  apiUrl: string = AIBTC_API
): Promise<HeartbeatResult> {
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(`${apiUrl}/paid-attention`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'check-in',
        btcAddress,
        stxAddress,
        signature,
        publicKey,
        timestamp,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Check-in failed: ${error}`,
      };
    }

    const data = (await response.json()) as any;

    return {
      success: true,
      message: data.message || 'Check-in successful',
    };
  } catch (error) {
    return {
      success: false,
      error: `Check-in error: ${error}`,
    };
  }
}

/**
 * Submit a response to the current paid attention message
 * Requires signing: "Paid Attention | {messageId} | {response}"
 */
export async function submitPaidAttentionResponse(
  messageId: string,
  responseText: string,
  btcAddress: string,
  stxAddress: string,
  signature: string,
  publicKey: string,
  apiUrl: string = AIBTC_API
): Promise<HeartbeatResult> {
  try {
    const response = await fetch(`${apiUrl}/paid-attention`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'response',
        messageId,
        response: responseText,
        btcAddress,
        stxAddress,
        signature,
        publicKey,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Response failed: ${error}`,
      };
    }

    const data = (await response.json()) as any;

    return {
      success: true,
      message: data.message || 'Response submitted',
    };
  } catch (error) {
    return {
      success: false,
      error: `Response error: ${error}`,
    };
  }
}

/**
 * Check AIBTC platform health
 */
export async function checkHealth(
  apiUrl: string = AIBTC_API
): Promise<{ healthy: boolean; agentCount?: number }> {
  try {
    const response = await fetch(`${apiUrl}/health`);

    if (!response.ok) {
      return { healthy: false };
    }

    const data = (await response.json()) as any;

    return {
      healthy: true,
      agentCount: data.agentCount || data.agent_count,
    };
  } catch (error) {
    return { healthy: false };
  }
}

/**
 * Generate the message to sign for a check-in
 */
export function getCheckInMessageToSign(): string {
  const timestamp = new Date().toISOString();
  return `AIBTC Check-In | ${timestamp}`;
}

/**
 * Generate the message to sign for a paid attention response
 */
export function getResponseMessageToSign(
  messageId: string,
  response: string
): string {
  return `Paid Attention | ${messageId} | ${response}`;
}
