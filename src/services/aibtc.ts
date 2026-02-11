/**
 * aibtc.com API integration
 * Verifies agent levels for reward eligibility
 */

export interface AgentVerification {
  address: string;
  level: number;
  verified: boolean;
  name?: string;
}

export async function verifyAgent(
  address: string,
  apiUrl: string
): Promise<AgentVerification> {
  try {
    const response = await fetch(`${apiUrl}/verify/${address}`);

    if (!response.ok) {
      // Agent not registered - default to level 0
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
    // Return unverified on error
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
