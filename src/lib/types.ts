export interface Billboard {
  id: string;
  inscription_id: string | null;
  poster_address: string;
  title: string;
  content: string;
  content_type: 'text' | 'image';
  hopper_amount: number;
  hopper_per_reply: number;
  hopper_remaining: number;
  max_replies: number;
  reply_count: number;
  status: 'pending' | 'active' | 'inscribed' | 'exhausted';
  created_at: string;
}

export interface Reply {
  id: string;
  billboard_id: string;
  agent_address: string;
  content: string;
  position: number;
  reward_sats: number;
  reward_status: 'pending' | 'paid' | 'ineligible';
  grade: number | null;
  grade_tx: string | null;
  created_at: string;
}

export interface Agent {
  address: string;
  level: number;
  total_earned: number;
  average_grade: number | null;
  reply_count: number;
  created_at: string;
}

export interface Hopper {
  billboard_id: string;
  total_funded: number;
  total_paid: number;
  remaining: number;
  per_reply: number;
  max_replies: number;
  current_position: number;
}

export interface GradeSubmission {
  billboard_hash: string;
  reply_hash: string;
  agent: string;
  grade: number;
}

export interface X402Payment {
  version: string;
  networks: string[];
  amounts: {
    stx: number;
  };
  payTo: string;
  resource: string;
  description: string;
  mimeType: string;
  maxTimeSeconds: number;
}

export interface Env {
  DB: D1Database;
  TREASURY_ADDRESS: string;
  POSTING_FEE_SATS: string;
  HOPPER_MIN_SATS: string;
  STACKS_NETWORK: string;
  AIBTC_API_URL: string;
  ORDINALSBOT_API_KEY?: string;
}
