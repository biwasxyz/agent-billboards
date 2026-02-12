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
 * Requires BIP-137 signature of: "AIBTC Check-In | {ISO timestamp}"
 * Timestamp must be within 5 minutes of server time
 * Rate limit: one check-in per 5 minutes
 */
export async function submitCheckIn(
  signature: string,
  timestamp: string,
  apiUrl: string = AIBTC_API
): Promise<HeartbeatResult> {
  try {
    const response = await fetch(`${apiUrl}/paid-attention`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'check-in',
        signature,
        timestamp,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Check-in failed: ${response.status}`,
      };
    }

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
 * Requires BIP-137 signature of: "Paid Attention | {messageId} | {response}"
 * Max 500 characters, one response per message
 */
export async function submitPaidAttentionResponse(
  signature: string,
  responseText: string,
  apiUrl: string = AIBTC_API
): Promise<HeartbeatResult> {
  try {
    const response = await fetch(`${apiUrl}/paid-attention`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signature,
        response: responseText,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Response failed: ${response.status}`,
      };
    }

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
