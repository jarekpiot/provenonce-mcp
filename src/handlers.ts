import { createHash, randomBytes } from 'crypto';
import { loadCredentials, saveCredentials } from './credentials.js';
import * as api from './client.js';
import type { WorkProofReceipt } from './types.js';

function requireCredentials() {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error(
      'Not registered. Call provenonce_register first.',
    );
  }
  return creds;
}

function ok(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function err(message: string): { content: [{ type: 'text'; text: string }]; isError: true } {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

// ── provenonce_register ───────────────────────────────────────────────────────

export async function handleRegister(args: { name?: string; skill_ref?: string }) {
  // Return existing identity if already registered
  const existing = loadCredentials();
  if (existing) {
    const { data, error } = await api.getStatus(existing.api_key);
    if (data) {
      return ok({
        registered: false,
        message: 'Already registered — returning existing identity.',
        hash: existing.agent_hash,
        sigil: data.sigil,
        identity_class: data.identity_class,
        _hint: data._hint,
      });
    }
    if (error) {
      // Credentials stale or invalid — fall through to re-register
    }
  }

  const { data, error } = await api.registerAgent({
    name: args.name,
    skillRef: args.skill_ref,
  });

  if (error || !data) return err(error ?? 'Registration failed');

  saveCredentials({ api_key: data.api_key, agent_hash: data.hash });

  return ok({
    registered: true,
    hash: data.hash,
    api_key: data.api_key,
    depth: data.depth,
    message: 'Agent registered. Credentials saved. Call provenonce_status to see your full state.',
    _warning: 'Save your api_key securely. It will not be shown again after this session.',
  });
}

// ── provenonce_status ─────────────────────────────────────────────────────────

export async function handleStatus() {
  const creds = requireCredentials();
  const { data, error } = await api.getStatus(creds.api_key);
  if (error || !data) return err(error ?? 'Failed to get status');
  return ok(data);
}

// ── provenonce_purchase_sigil ─────────────────────────────────────────────────

export async function handlePurchaseSigil(args: {
  name: string;
  principal: string;
  identity_class: string;
  tier: string;
  payment_tx?: string;
}) {
  const creds = requireCredentials();
  const skillRef = process.env.PROVENONCE_SKILL_REF;

  // If no payment_tx, return payment instructions
  if (!args.payment_tx) {
    const fees = await api.fetchFees();
    const schedule = fees.data?.schedule;
    const sigilTier = schedule?.sigil_tiers?.find(t => t.identity_class === args.identity_class);
    const feeSol = sigilTier?.sol ?? 0;
    const feeLamports = sigilTier?.lamports ?? 0;

    return ok({
      payment_required: true,
      fee_sol: feeSol,
      fee_lamports: feeLamports,
      payment_address: fees.data?.payment_address ?? null,
      payment_chain: fees.data?.payment_chain ?? 'solana',
      identity_class: args.identity_class,
      message: feeSol === 0
        ? 'Sandbox SIGIL is free. Call again with payment_tx set to "sandbox-free".'
        : `SIGIL purchase requires ${feeSol} SOL. Send ${feeSol} SOL to the payment_address, then call provenonce_purchase_sigil again with payment_tx set to the transaction signature.`,
    });
  }

  const { data, error } = await api.purchaseSigil(creds.api_key, {
    name: args.name,
    principal: args.principal,
    identity_class: args.identity_class,
    tier: args.tier,
    payment_tx: args.payment_tx,
    skillRef,
  });

  if (error || !data) return err(error ?? 'SIGIL purchase failed');

  return ok({
    ...data,
    heartbeat_unlocked: true,
    message: `SIGIL issued: ${data.sigil}. You can now call provenonce_heartbeat and provenonce_get_passport.`,
  });
}

// ── provenonce_heartbeat ──────────────────────────────────────────────────────

export async function handleHeartbeat(args: { payment_tx?: string }) {
  const creds = requireCredentials();

  // If no payment_tx, return payment instructions
  if (!args.payment_tx) {
    const fees = await api.fetchFees();
    const schedule = fees.data?.schedule;
    const tier1 = schedule?.heartbeat_tiers?.[0];
    const feeSol = tier1?.sol ?? 0;
    const feeLamports = tier1?.lamports ?? 0;

    return ok({
      payment_required: true,
      fee_sol: feeSol,
      fee_lamports: feeLamports,
      payment_address: fees.data?.payment_address ?? null,
      payment_chain: fees.data?.payment_chain ?? 'solana',
      message: `Heartbeat requires ${feeSol} SOL. Send ${feeSol} SOL to the payment_address, then call provenonce_heartbeat again with payment_tx set to the transaction signature.`,
    });
  }

  const { data, error } = await api.heartbeat(creds.api_key, args.payment_tx);
  if (error || !data) return err(error ?? 'Heartbeat failed');

  if (!data.ok && data.sigil_required) {
    return err('SIGIL required. Call provenonce_purchase_sigil first.');
  }

  return ok({
    ok: data.ok,
    message: data.ok ? 'Heartbeat recorded. Agent liveness confirmed.' : 'Heartbeat failed.',
  });
}

// ── provenonce_get_passport ───────────────────────────────────────────────────

export async function handleGetPassport(args: { payment_tx?: string }) {
  const creds = requireCredentials();

  // Try without payment first — first passport and descendant passports are free
  const { data, error } = await api.getPassport(creds.api_key, args.payment_tx);

  if (error) {
    // If it failed because payment is required, return payment instructions
    if (!args.payment_tx && (error.includes('payment') || error.includes('PAYMENT'))) {
      const fees = await api.fetchFees();
      const feeSol = fees.data?.schedule?.proof_reissuance_sol ?? 0;

      return ok({
        payment_required: true,
        fee_sol: feeSol,
        fee_lamports: Math.round(feeSol * 1_000_000_000),
        payment_address: fees.data?.payment_address ?? null,
        payment_chain: fees.data?.payment_chain ?? 'solana',
        message: `Passport reissue requires ${feeSol} SOL. Send ${feeSol} SOL to the payment_address, then call provenonce_get_passport again with payment_tx set to the transaction signature.`,
      });
    }
    return err(error);
  }

  if (!data) return err('Passport retrieval failed');

  return ok({
    passport: data.lineage_proof,
    message:
      'Passport issued. Share this signed document with any third party to prove your identity offline.',
    _verify:
      'Verify at: GET https://provenonce.io/.well-known/provenonce-authority.json for the authority public key.',
  });
}

// ── provenonce_beats_proof ────────────────────────────────────────────────────

/**
 * Compute a single beat using the canonical Provenonce formula from lib/beat.ts.
 * seed = `${prevHash}:${beatIndex}::${anchorHash}` (empty nonce)
 * hash = sha256(seed), then sha256(hash) `difficulty` times.
 */
function computeBeatHash(prevHash: string, beatIndex: number, difficulty: number, anchorHash?: string): string {
  const seed = anchorHash
    ? `${prevHash}:${beatIndex}::${anchorHash}`
    : `${prevHash}:${beatIndex}:`;

  let current = createHash('sha256').update(seed, 'utf8').digest('hex');
  for (let i = 0; i < difficulty; i++) {
    current = createHash('sha256').update(current, 'utf8').digest('hex');
  }
  return current;
}

/**
 * Compute a full beats work-proof and submit to the Beats service for a signed receipt.
 */
export async function computeWorkProof(
  count: number,
  difficulty: number,
): Promise<{ receipt: WorkProofReceipt | null; localProof: { from_hash: string; to_hash: string; beats_computed: number; duration_ms: number }; error?: string }> {
  // 1. Fetch current anchor
  const anchorRes = await api.fetchAnchor();
  const anchor = anchorRes.data?.anchor;
  const anchorHash = anchor?.hash;
  const anchorIndex = anchor?.beat_index ?? 0;

  // 2. Generate genesis hash
  const genesisInput = `provenonce:beats:${randomBytes(16).toString('hex')}`;
  const genesisHash = createHash('sha256').update(genesisInput, 'utf8').digest('hex');

  // 3. Compute beats with proper formula + collect spot checks
  const spotCheckIndices = selectSpotCheckIndices(count);
  const spotChecks: { index: number; hash: string; prev: string }[] = [];

  const start = Date.now();
  let prevHash = genesisHash;

  for (let i = 1; i <= count; i++) {
    const hash = computeBeatHash(prevHash, i, difficulty, anchorHash);

    if (spotCheckIndices.has(i)) {
      spotChecks.push({ index: i, hash, prev: prevHash });
    }

    prevHash = hash;
  }

  const duration = Date.now() - start;
  const fromHash = genesisHash;
  const toHash = prevHash;

  const localProof = {
    from_hash: fromHash,
    to_hash: toHash,
    beats_computed: count,
    duration_ms: duration,
  };

  // 4. Submit to Beats service for a signed receipt
  const submitRes = await api.submitWorkProof({
    from_hash: fromHash,
    to_hash: toHash,
    beats_computed: count,
    difficulty,
    anchor_index: anchorIndex,
    anchor_hash: anchorHash,
    spot_checks: spotChecks,
  });

  if (submitRes.error) {
    return { receipt: null, localProof, error: `Beats submission failed: ${submitRes.error}` };
  }

  if (!submitRes.data?.valid) {
    return { receipt: null, localProof, error: `Beats rejected proof: ${submitRes.data?.reason ?? 'unknown'}` };
  }

  return { receipt: submitRes.data.receipt ?? null, localProof };
}

/**
 * Select spot check indices for a given beat count.
 * Rules: first beat + last beat + evenly-spaced interior.
 * Density: 1 per 1000 beats, min 3.
 */
function selectSpotCheckIndices(count: number): Set<number> {
  const minChecks = 3;
  const density = 1000;
  const maxChecks = 25;
  const needed = Math.max(
    Math.min(count, minChecks),
    Math.min(Math.ceil(count / density), maxChecks),
  );

  const indices = new Set<number>();
  indices.add(1);       // first beat (genesis binding)
  indices.add(count);   // last beat (terminal binding)

  // Fill interior evenly
  if (needed > 2 && count > 2) {
    const interiorNeeded = needed - 2;
    for (let j = 1; j <= interiorNeeded; j++) {
      const idx = Math.round(1 + (j * (count - 1)) / (interiorNeeded + 1));
      if (idx > 1 && idx < count) {
        indices.add(idx);
      }
    }
  }

  return indices;
}

export async function handleBeatsProof(args: { count: number; difficulty?: number }) {
  const count = Math.max(10, Math.min(10000, args.count));
  const difficulty = Math.max(100, Math.min(5000, args.difficulty ?? 1000));

  const { receipt, localProof, error } = await computeWorkProof(count, difficulty);

  if (receipt) {
    return ok({
      ...localProof,
      difficulty,
      receipt,
      message: `Computed ${count} beats at difficulty ${difficulty} in ${localProof.duration_ms}ms. Signed receipt obtained from Beats service.`,
    });
  }

  return ok({
    ...localProof,
    difficulty,
    receipt: null,
    _warning: error ?? 'Could not obtain signed receipt from Beats service.',
    message: `Computed ${count} beats locally in ${localProof.duration_ms}ms but receipt not available. ${error ?? ''}`,
  });
}

// ── provenonce_submit_beats ──────────────────────────────────────────────────

/**
 * Compute VDF beats extending the agent's beat chain and submit to the Registry.
 * Credits `total_beats` — visible as "Lifetime Beats" in the Registry UI.
 */
export async function handleSubmitBeats(args: { count?: number }) {
  const creds = requireCredentials();
  const count = Math.max(10, Math.min(2000, args.count ?? 100));
  const difficulty = 1000; // Default agent difficulty

  // 1. Get current beat chain state
  const stateRes = await api.getAgentBeatState(creds.api_key);
  if (stateRes.error || !stateRes.data) {
    return err(stateRes.error ?? 'Failed to get agent beat state. Call provenonce_register first.');
  }

  const { latest_beat_index: fromBeat, latest_beat_hash: fromHash, difficulty: agentDifficulty } = stateRes.data;
  const effectiveDifficulty = agentDifficulty || difficulty;

  // 2. Fetch current anchor
  const anchorRes = await api.fetchAnchor();
  const anchor = anchorRes.data?.anchor;
  if (!anchor) {
    return err('Could not fetch global anchor. Try again.');
  }
  const anchorHash = anchor.hash;
  const anchorIndex = anchor.beat_index;

  // 3. Compute beats from chain head with spot checks
  const spotCheckIndices = selectSpotCheckIndices(count);
  const spotChecks: { index: number; hash: string; prev: string }[] = [];

  const start = Date.now();
  let prevHash = fromHash;

  for (let i = 1; i <= count; i++) {
    const beatIndex = fromBeat + i;
    const hash = computeBeatHash(prevHash, beatIndex, effectiveDifficulty, anchorHash);

    if (spotCheckIndices.has(i)) {
      spotChecks.push({ index: beatIndex, hash, prev: prevHash });
    }

    prevHash = hash;
  }

  const duration = Date.now() - start;
  const toBeat = fromBeat + count;
  const toHash = prevHash;

  // 4. Submit to Registry
  const submitRes = await api.submitBeatsToRegistry(creds.api_key, {
    from_beat: fromBeat,
    to_beat: toBeat,
    from_hash: fromHash,
    to_hash: toHash,
    beats_computed: count,
    global_anchor: anchorIndex,
    anchor_hash: anchorHash,
    spot_checks: spotChecks,
  });

  if (submitRes.error || !submitRes.data) {
    return err(submitRes.error ?? 'Registry rejected beat submission.');
  }

  return ok({
    beats_accepted: submitRes.data.beats_accepted,
    total_beats: submitRes.data.total_beats,
    duration_ms: duration,
    difficulty: effectiveDifficulty,
    message: `Submitted ${count} beats to Registry in ${duration}ms. Total lifetime beats: ${submitRes.data.total_beats}.`,
  });
}

// ── provenonce_batch_heartbeat ────────────────────────────────────────────────

export async function handleBatchHeartbeat(args: { children: string[]; payment_tx?: string }) {
  const creds = requireCredentials();

  if (!args.payment_tx) {
    const fees = await api.fetchFees();
    const schedule = fees.data?.schedule;
    const tier1 = schedule?.heartbeat_tiers?.[0];
    const feePerChild = tier1?.lamports ?? 0;
    const totalFee = feePerChild * args.children.length;

    return ok({
      payment_required: true,
      fee_per_child_lamports: feePerChild,
      total_fee_lamports: totalFee,
      total_fee_sol: totalFee / 1_000_000_000,
      children_count: args.children.length,
      payment_address: fees.data?.payment_address ?? null,
      payment_chain: fees.data?.payment_chain ?? 'solana',
      message: `Batch heartbeat for ${args.children.length} children requires ${totalFee / 1_000_000_000} SOL total. Send to the payment_address, then call again with payment_tx.`,
    });
  }

  const { data, error } = await api.batchHeartbeat(creds.api_key, args.children, args.payment_tx);
  if (error || !data) return err(error ?? 'Batch heartbeat failed');

  return ok({
    ok: data.ok,
    summary: data.summary,
    results: data.results,
    message: data.ok
      ? `Batch heartbeat: ${data.summary.succeeded}/${data.summary.total} succeeded.`
      : 'Batch heartbeat failed for all children.',
  });
}

// ── provenonce_verify_agent ───────────────────────────────────────────────────

export async function handleVerifyAgent(args: { hash: string }) {
  const { data, error } = await api.verifyAgent(args.hash);
  if (error || !data) return err(error ?? 'Verification failed');
  return ok(data);
}

// ── provenonce_spawn ──────────────────────────────────────────────────────────

export async function handleSpawn(args: { child_name: string }) {
  const creds = requireCredentials();

  // Auto-compute a work-proof receipt for spawn authorization.
  // Spawn cost at depth 0 / 0 siblings = 1000 beats. We compute 1050 for margin.
  // The spawn endpoint will reject without a receipt when BEATS_REQUIRED=true.
  const SPAWN_BEATS = 1050;
  const SPAWN_DIFFICULTY = 1000;

  const { receipt, error: proofError } = await computeWorkProof(SPAWN_BEATS, SPAWN_DIFFICULTY);

  if (!receipt) {
    return err(
      `Failed to obtain Beats work-proof receipt for spawn. ${proofError ?? 'Unknown error'}. ` +
      'You can try calling provenonce_beats_proof with count=1050 manually, then retry spawn.',
    );
  }

  const { data, error } = await api.spawnChild(creds.api_key, {
    childName: args.child_name,
    parentHash: creds.agent_hash,
    beatsReceipt: receipt,
  });

  if (error || !data) return err(error ?? 'Spawn failed');

  return ok({
    ...data,
    message: `Child agent spawned: ${data.child_hash}. Save the child_api_key — it will not be shown again.`,
    _warning: 'The child agent has its own identity. Configure it with PROVENONCE_API_KEY + PROVENONCE_AGENT_HASH.',
  });
}

// ── provenonce_get_lineage ────────────────────────────────────────────────────

export async function handleGetLineage(args: { hash?: string }) {
  const creds = loadCredentials();
  const targetHash = args.hash ?? creds?.agent_hash;

  if (!targetHash) {
    return err('No hash provided and agent is not registered. Call provenonce_register first or provide a hash.');
  }

  const { data, error } = await api.getLineage(targetHash);
  if (error || !data) return err(error ?? 'Lineage retrieval failed');
  return ok(data);
}
