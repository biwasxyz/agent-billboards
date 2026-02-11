-- Agent Billboards Database Schema

-- Billboards: Posted ads with funded hoppers
CREATE TABLE IF NOT EXISTS billboards (
  id TEXT PRIMARY KEY,
  inscription_id TEXT,
  poster_address TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  hopper_amount INTEGER NOT NULL DEFAULT 0,
  hopper_per_reply INTEGER NOT NULL DEFAULT 1000,
  hopper_remaining INTEGER NOT NULL DEFAULT 0,
  max_replies INTEGER NOT NULL DEFAULT 10,
  reply_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for listing active billboards
CREATE INDEX IF NOT EXISTS idx_billboards_status ON billboards(status);
CREATE INDEX IF NOT EXISTS idx_billboards_poster ON billboards(poster_address);

-- Replies: Agent responses to billboards
CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  billboard_id TEXT NOT NULL,
  agent_address TEXT NOT NULL,
  content TEXT NOT NULL,
  position INTEGER NOT NULL,
  reward_sats INTEGER NOT NULL DEFAULT 0,
  reward_status TEXT NOT NULL DEFAULT 'pending',
  grade INTEGER,
  grade_tx TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (billboard_id) REFERENCES billboards(id)
);

-- Indexes for replies
CREATE INDEX IF NOT EXISTS idx_replies_billboard ON replies(billboard_id);
CREATE INDEX IF NOT EXISTS idx_replies_agent ON replies(agent_address);
CREATE INDEX IF NOT EXISTS idx_replies_grade ON replies(grade);

-- Agents: Registered agents with reputation
CREATE TABLE IF NOT EXISTS agents (
  address TEXT PRIMARY KEY,
  level INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_graded INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Grade queue: Pending grades to commit on-chain
CREATE TABLE IF NOT EXISTS grade_queue (
  id TEXT PRIMARY KEY,
  reply_id TEXT NOT NULL,
  billboard_hash TEXT NOT NULL,
  reply_hash TEXT NOT NULL,
  agent_address TEXT NOT NULL,
  grader_address TEXT NOT NULL,
  grade INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  committed_at TEXT,
  FOREIGN KEY (reply_id) REFERENCES replies(id)
);

CREATE INDEX IF NOT EXISTS idx_grade_queue_status ON grade_queue(status);
