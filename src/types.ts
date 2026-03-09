/** Stored agent credentials — written to ~/.provenonce/config.json */
export interface StoredCredentials {
  api_key: string;
  agent_hash: string;
}

/** Full agent status returned by provenonce_status */
export interface AgentStatus {
  hash: string;
  name: string | null;
  sigil: string | null;
  identity_class: string | null;
  tier: string | null;
  beats_balance: number;
  depth: number;
  parent_hash: string | null;
  registered_at: string | null;
  sigil_url: string | null;
  _hint: string | null;
}

/** Registration result from POST /api/v1/register */
export interface RegisterResult {
  hash: string;
  api_key: string;
  depth: number;
  parent: string | null;
}

/** Heartbeat result */
export interface HeartbeatResult {
  ok: boolean;
  error?: string;
  sigil_required?: boolean;
}

/** Batch heartbeat result */
export interface BatchHeartbeatResult {
  ok: boolean;
  results: Array<{
    child_hash: string;
    ok: boolean;
    error?: string;
    code?: string;
    heartbeat_count_epoch?: number;
    fee_lamports?: number;
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    total_fee_lamports: number;
  };
}

/** Passport / LineageProof */
export interface PassportResult {
  format_version?: number;
  agent_hash: string;
  agent_public_key: string | null;
  authority_key_id?: string;
  identity_class: string | null;
  registered_at_beat: number;
  sigil_issued_at_beat: number | null;
  last_heartbeat_beat: number;
  lineage_chain_hash: string;
  issued_at: number;
  valid_until: number;
  provenonce_signature: string;
}

/** Beats proof result */
export interface BeatsProofResult {
  from_hash: string;
  to_hash: string;
  beats_computed: number;
  duration_ms: number;
  receipt?: WorkProofReceipt | null;
}

/** Signed work-proof receipt from Beats service */
export interface WorkProofReceipt {
  type: 'work_proof';
  beats_verified: number;
  difficulty: number;
  anchor_index: number;
  anchor_hash: string | null;
  from_hash: string;
  to_hash: string;
  utc: string;
  signature: string;
}

/** Response from GET /api/v1/beat/anchor */
export interface AnchorResponse {
  anchor: {
    beat_index: number;
    hash: string;
    prev_hash: string;
    utc: number;
    difficulty: number;
    epoch: number;
  };
}

/** SIGIL purchase result */
export interface SigilResult {
  ok: boolean;
  sigil: string;
  identity_class: string;
  tier: string;
  heartbeat_unlocked: boolean;
}

/** Verify agent result */
export interface VerifyAgentResult {
  verified: boolean;
  hash: string;
  sigil: string | null;
  identity_class: string | null;
  tier: string | null;
  registered_at: string | null;
}

/** Lineage result */
export interface LineageResult {
  hash: string;
  events: unknown[];
  chain_hash: string;
}

/** Spawn result */
export interface SpawnResult {
  child_hash: string;
  child_api_key: string;
  child_depth: number;
  parent_hash: string;
}

/** Fee schedule from GET /api/v1/fees/summary */
export interface FeeSchedule {
  payment_address: string;
  payment_chain: string;
  schedule: {
    sigil_tiers: { identity_class: string; label: string; sol: number; lamports: number }[];
    heartbeat_tiers: { range: string; sol: number; lamports: number }[];
    proof_reissuance_sol: number;
  };
}
