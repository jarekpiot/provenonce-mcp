import type {
  RegisterResult,
  AgentStatus,
  HeartbeatResult,
  PassportResult,
  SigilResult,
  VerifyAgentResult,
  LineageResult,
  SpawnResult,
  AnchorResponse,
  WorkProofReceipt,
  FeeSchedule,
} from './types.js';

const REGISTRY_URL = process.env.PROVENONCE_REGISTRY_URL || 'https://provenonce.io';
const BEATS_URL = process.env.PROVENONCE_BEATS_URL || 'https://beats.provenonce.dev';

async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; apiKey?: string; isPublic?: boolean } = {},
): Promise<{ data: T | null; error: string | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;

  try {
    const res = await fetch(`${REGISTRY_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    const json = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const msg = (json.error as string) ?? `HTTP ${res.status}`;
      return { data: null, error: msg };
    }

    return { data: json as T, error: null };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}

/** Fetch the latest global anchor from the Registry */
export async function fetchAnchor(): Promise<{ data: AnchorResponse | null; error: string | null }> {
  return apiFetch<AnchorResponse>('/api/v1/beat/anchor');
}

/** Fetch fee schedule and payment address (cached 5 min) */
let feeCache: { data: FeeSchedule; ts: number } | null = null;
const FEE_CACHE_TTL = 5 * 60 * 1000;

export async function fetchFees(): Promise<{ data: FeeSchedule | null; error: string | null }> {
  if (feeCache && Date.now() - feeCache.ts < FEE_CACHE_TTL) {
    return { data: feeCache.data, error: null };
  }
  const res = await apiFetch<FeeSchedule>('/api/v1/fees/summary');
  if (res.data) {
    feeCache = { data: res.data, ts: Date.now() };
  }
  return res;
}

/** Submit a work-proof to the Beats service for a signed receipt */
export async function submitWorkProof(proof: {
  from_hash: string;
  to_hash: string;
  beats_computed: number;
  difficulty: number;
  anchor_index: number;
  anchor_hash?: string;
  spot_checks: { index: number; hash: string; prev: string }[];
}): Promise<{ data: { valid: boolean; receipt?: WorkProofReceipt; reason?: string } | null; error: string | null }> {
  try {
    const res = await fetch(`${BEATS_URL}/api/v1/beat/work-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_proof: proof }),
    });

    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const msg = (json.error as string) ?? `HTTP ${res.status}`;
      return { data: null, error: msg };
    }

    return { data: json as { valid: boolean; receipt?: WorkProofReceipt; reason?: string }, error: null };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}

/** Register a new agent (no-wallet path) */
export async function registerAgent(opts: {
  name?: string;
  skillRef?: string;
}): Promise<{ data: RegisterResult | null; error: string | null }> {
  // Fast path: admin-minted invite (15-min TTL, single-use, bypasses self-service rate limit)
  const invite = process.env.PROVENONCE_INVITE;
  if (invite) {
    try {
      const res = await fetch(`${REGISTRY_URL}/api/v1/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-registration-invite': invite },
        body: JSON.stringify({ name: opts.name, wallet: 'none', ...(opts.skillRef ? { ref: opts.skillRef } : {}) }),
      });
      const json = await res.json() as Record<string, unknown>;
      if (!res.ok) return { data: null, error: (json.error as string) ?? `HTTP ${res.status}` };
      return { data: json as RegisterResult, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  }

  // Fallback: self-service registration token (RFC-010, 5-min TTL)
  const tokenRes = await apiFetch<{ token: string }>('/api/v1/register/token', {
    method: 'POST',
    body: {},
  });
  if (tokenRes.error || !tokenRes.data?.token) {
    return { data: null, error: tokenRes.error ?? 'Failed to obtain registration token' };
  }

  // Step 2: Register with the token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-registration-token': tokenRes.data.token,
  };
  try {
    const res = await fetch(`${REGISTRY_URL}/api/v1/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: opts.name,
        wallet: 'none',
        ...(opts.skillRef ? { ref: opts.skillRef } : {}),
      }),
    });
    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      return { data: null, error: (json.error as string) ?? `HTTP ${res.status}` };
    }
    return { data: json as RegisterResult, error: null };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}

/** Get full agent status */
export async function getStatus(apiKey: string): Promise<{ data: AgentStatus | null; error: string | null }> {
  return apiFetch<AgentStatus>('/api/v1/skill/bootstrap', {
    method: 'POST',
    apiKey,
    body: {},
  });
}

/** Submit heartbeat */
export async function heartbeat(apiKey: string, paymentTx?: string): Promise<{ data: HeartbeatResult | null; error: string | null }> {
  return apiFetch<HeartbeatResult>('/api/v1/agent/heartbeat', {
    method: 'POST',
    apiKey,
    body: { payment_tx: paymentTx },
  });
}

/** Batch heartbeat */
export async function batchHeartbeat(apiKey: string, children: string[], paymentTx: string): Promise<{ data: any | null; error: string | null }> {
  return apiFetch<any>('/api/v1/agent/heartbeat/batch', {
    method: 'POST',
    apiKey,
    body: { children, payment_tx: paymentTx },
  });
}

/** Reissue passport / lineage proof */
export async function getPassport(apiKey: string, paymentTx?: string): Promise<{ data: { lineage_proof: PassportResult } | null; error: string | null }> {
  return apiFetch<{ lineage_proof: PassportResult }>('/api/v1/agent/reissue-proof', {
    method: 'POST',
    apiKey,
    body: paymentTx ? { payment_tx: paymentTx } : {},
  });
}

/** Purchase a SIGIL */
export async function purchaseSigil(apiKey: string, opts: {
  name: string;
  principal: string;
  identity_class: string;
  tier: string;
  payment_tx: string;
  skillRef?: string;
}): Promise<{ data: SigilResult | null; error: string | null }> {
  return apiFetch<SigilResult>('/api/v1/sigil', {
    method: 'POST',
    apiKey,
    body: {
      name: opts.name,
      principal: opts.principal,
      identity_class: opts.identity_class,
      tier: opts.tier,
      payment_tx: opts.payment_tx,
      ...(opts.skillRef ? { ref: opts.skillRef } : {}),
    },
  });
}

/** Verify another agent's identity (public) */
export async function verifyAgent(hash: string): Promise<{ data: VerifyAgentResult | null; error: string | null }> {
  return apiFetch<VerifyAgentResult>(`/api/v1/verify/${encodeURIComponent(hash)}`);
}

/** Get agent lineage chain (public) */
export async function getLineage(hash: string): Promise<{ data: LineageResult | null; error: string | null }> {
  return apiFetch<LineageResult>(`/api/v1/agent/lineage/${encodeURIComponent(hash)}`);
}

/** Get agent beat state (calls init — returns existing state if already initialized) */
export async function getAgentBeatState(apiKey: string): Promise<{
  data: {
    genesis_hash: string;
    latest_beat_index: number;
    latest_beat_hash: string;
    difficulty: number;
    total_beats: number;
  } | null;
  error: string | null;
}> {
  const res = await apiFetch<Record<string, unknown>>('/api/v1/agent/init', {
    method: 'POST',
    apiKey,
  });
  if (res.error || !res.data) return { data: null, error: res.error ?? 'Failed to get beat state' };

  const d = res.data;
  const genesisHash = (d.genesis_hash as string) || (d.genesis as any)?.hash || '';
  const latestBeatIndex = (d.latest_beat as number) || (d.total_beats as number) || 0;
  const latestBeatHash = (d.latest_hash as string) || genesisHash;
  const difficulty = (d.difficulty as number) || 1000;
  const totalBeats = (d.total_beats as number) || 0;

  return {
    data: {
      genesis_hash: genesisHash,
      latest_beat_index: latestBeatIndex,
      latest_beat_hash: latestBeatHash,
      difficulty,
      total_beats: totalBeats,
    },
    error: null,
  };
}

/** Submit beat proof to Registry to credit VDF work */
export async function submitBeatsToRegistry(apiKey: string, proof: {
  from_beat: number;
  to_beat: number;
  from_hash: string;
  to_hash: string;
  beats_computed: number;
  global_anchor: number;
  anchor_hash: string;
  spot_checks: { index: number; hash: string; prev: string }[];
}): Promise<{ data: { ok: boolean; beats_accepted: number; total_beats: number } | null; error: string | null }> {
  return apiFetch<{ ok: boolean; beats_accepted: number; total_beats: number }>('/api/v1/agent/beats/submit', {
    method: 'POST',
    apiKey,
    body: { proof },
  });
}

/** Spawn a child agent — handles full 3-step flow internally */
export async function spawnChild(apiKey: string, opts: {
  childName: string;
  parentHash: string;
  beatsReceipt?: WorkProofReceipt;
}): Promise<{ data: SpawnResult | null; error: string | null }> {
  // Step 1: Get spawn authorization (include receipt if available)
  const step1Body: Record<string, unknown> = { child_name: opts.childName };
  if (opts.beatsReceipt) {
    step1Body.beats_receipt = opts.beatsReceipt;
  }

  const step1 = await apiFetch<{
    spawn_authorization: string;
    child_name?: string;
  }>('/api/v1/agent/spawn', {
    method: 'POST',
    apiKey,
    body: step1Body,
  });

  if (step1.error || !step1.data?.spawn_authorization) {
    return { data: null, error: step1.error ?? 'Spawn step 1 failed: no authorization returned' };
  }

  const spawnAuth = step1.data.spawn_authorization;

  // Step 2: Register the child with the spawn_authorization
  const reg = await apiFetch<RegisterResult>('/api/v1/register', {
    method: 'POST',
    apiKey,
    body: {
      name: opts.childName,
      wallet: 'none',
      spawn_authorization: spawnAuth,
    },
  });

  if (reg.error || !reg.data?.hash) {
    return { data: null, error: reg.error ?? 'Spawn step 2 (child registration) failed' };
  }

  const childHash = reg.data.hash;
  const childApiKey = reg.data.api_key;

  // Step 3: Finalize the spawn
  const step3 = await apiFetch<{ ok: boolean }>('/api/v1/agent/spawn', {
    method: 'POST',
    apiKey,
    body: { child_hash: childHash },
  });

  if (step3.error) {
    return { data: null, error: step3.error };
  }

  return {
    data: {
      child_hash: childHash,
      child_api_key: childApiKey,
      child_depth: reg.data.depth,
      parent_hash: opts.parentHash,
    },
    error: null,
  };
}
