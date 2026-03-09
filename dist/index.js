// @provenonce/mcp — Provenonce Skill for AI agents
import {
  PROVENONCE_TOOLS
} from "./chunk-HT6HDVYB.js";

// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// src/handlers.ts
import { createHash, randomBytes } from "crypto";

// src/credentials.ts
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
function getConfigDir() {
  return join(homedir(), ".provenonce");
}
function getConfigPath() {
  return join(getConfigDir(), "config.json");
}
function loadCredentials() {
  const apiKey = process.env.PROVENONCE_API_KEY;
  const agentHash = process.env.PROVENONCE_AGENT_HASH;
  if (apiKey && agentHash) {
    return { api_key: apiKey, agent_hash: agentHash };
  }
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.api_key && parsed.agent_hash) {
      return { api_key: parsed.api_key, agent_hash: parsed.agent_hash };
    }
  } catch {
  }
  return null;
}
function saveCredentials(creds) {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const configPath = getConfigPath();
  const data = {
    api_key: creds.api_key,
    agent_hash: creds.agent_hash
  };
  writeFileSync(configPath, JSON.stringify(data, null, 2), "utf-8");
  try {
    chmodSync(configPath, 384);
  } catch {
  }
}

// src/client.ts
var REGISTRY_URL = process.env.PROVENONCE_REGISTRY_URL || "https://provenonce.io";
var BEATS_URL = process.env.PROVENONCE_BEATS_URL || "https://beats.provenonce.dev";
async function apiFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (opts.apiKey) headers["Authorization"] = `Bearer ${opts.apiKey}`;
  try {
    const res = await fetch(`${REGISTRY_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : void 0
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = json.error ?? `HTTP ${res.status}`;
      return { data: null, error: msg };
    }
    return { data: json, error: null };
  } catch (err2) {
    return { data: null, error: err2.message };
  }
}
async function fetchAnchor() {
  return apiFetch("/api/v1/beat/anchor");
}
var feeCache = null;
var FEE_CACHE_TTL = 5 * 60 * 1e3;
async function fetchFees() {
  if (feeCache && Date.now() - feeCache.ts < FEE_CACHE_TTL) {
    return { data: feeCache.data, error: null };
  }
  const res = await apiFetch("/api/v1/fees/summary");
  if (res.data) {
    feeCache = { data: res.data, ts: Date.now() };
  }
  return res;
}
async function submitWorkProof(proof) {
  try {
    const res = await fetch(`${BEATS_URL}/api/v1/beat/work-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_proof: proof })
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = json.error ?? `HTTP ${res.status}`;
      return { data: null, error: msg };
    }
    return { data: json, error: null };
  } catch (err2) {
    return { data: null, error: err2.message };
  }
}
async function registerAgent(opts) {
  const invite = process.env.PROVENONCE_INVITE;
  if (invite) {
    try {
      const res = await fetch(`${REGISTRY_URL}/api/v1/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-registration-invite": invite },
        body: JSON.stringify({ name: opts.name, wallet: "none", ...opts.skillRef ? { ref: opts.skillRef } : {} })
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error ?? `HTTP ${res.status}` };
      return { data: json, error: null };
    } catch (err2) {
      return { data: null, error: err2.message };
    }
  }
  const tokenRes = await apiFetch("/api/v1/register/token", {
    method: "POST",
    body: {}
  });
  if (tokenRes.error || !tokenRes.data?.token) {
    return { data: null, error: tokenRes.error ?? "Failed to obtain registration token" };
  }
  const headers = {
    "Content-Type": "application/json",
    "x-registration-token": tokenRes.data.token
  };
  try {
    const res = await fetch(`${REGISTRY_URL}/api/v1/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: opts.name,
        wallet: "none",
        ...opts.skillRef ? { ref: opts.skillRef } : {}
      })
    });
    const json = await res.json();
    if (!res.ok) {
      return { data: null, error: json.error ?? `HTTP ${res.status}` };
    }
    return { data: json, error: null };
  } catch (err2) {
    return { data: null, error: err2.message };
  }
}
async function getStatus(apiKey) {
  return apiFetch("/api/v1/skill/bootstrap", {
    method: "POST",
    apiKey,
    body: {}
  });
}
async function heartbeat(apiKey, paymentTx) {
  return apiFetch("/api/v1/agent/heartbeat", {
    method: "POST",
    apiKey,
    body: { payment_tx: paymentTx }
  });
}
async function batchHeartbeat(apiKey, children, paymentTx) {
  return apiFetch("/api/v1/agent/heartbeat/batch", {
    method: "POST",
    apiKey,
    body: { children, payment_tx: paymentTx }
  });
}
async function getPassport(apiKey, paymentTx) {
  return apiFetch("/api/v1/agent/reissue-proof", {
    method: "POST",
    apiKey,
    body: paymentTx ? { payment_tx: paymentTx } : {}
  });
}
async function purchaseSigil(apiKey, opts) {
  return apiFetch("/api/v1/sigil", {
    method: "POST",
    apiKey,
    body: {
      name: opts.name,
      principal: opts.principal,
      identity_class: opts.identity_class,
      tier: opts.tier,
      payment_tx: opts.payment_tx,
      ...opts.skillRef ? { ref: opts.skillRef } : {}
    }
  });
}
async function verifyAgent(hash) {
  return apiFetch(`/api/v1/verify/${encodeURIComponent(hash)}`);
}
async function getLineage(hash) {
  return apiFetch(`/api/v1/agent/lineage/${encodeURIComponent(hash)}`);
}
async function getAgentBeatState(apiKey) {
  const res = await apiFetch("/api/v1/agent/init", {
    method: "POST",
    apiKey
  });
  if (res.error || !res.data) return { data: null, error: res.error ?? "Failed to get beat state" };
  const d = res.data;
  const genesisHash = d.genesis_hash || d.genesis?.hash || "";
  const latestBeatIndex = d.latest_beat || d.total_beats || 0;
  const latestBeatHash = d.latest_hash || genesisHash;
  const difficulty = d.difficulty || 1e3;
  const totalBeats = d.total_beats || 0;
  return {
    data: {
      genesis_hash: genesisHash,
      latest_beat_index: latestBeatIndex,
      latest_beat_hash: latestBeatHash,
      difficulty,
      total_beats: totalBeats
    },
    error: null
  };
}
async function submitBeatsToRegistry(apiKey, proof) {
  return apiFetch("/api/v1/agent/beats/submit", {
    method: "POST",
    apiKey,
    body: { proof }
  });
}
async function spawnChild(apiKey, opts) {
  const step1Body = { child_name: opts.childName };
  if (opts.beatsReceipt) {
    step1Body.beats_receipt = opts.beatsReceipt;
  }
  const step1 = await apiFetch("/api/v1/agent/spawn", {
    method: "POST",
    apiKey,
    body: step1Body
  });
  if (step1.error || !step1.data?.spawn_authorization) {
    return { data: null, error: step1.error ?? "Spawn step 1 failed: no authorization returned" };
  }
  const spawnAuth = step1.data.spawn_authorization;
  const reg = await apiFetch("/api/v1/register", {
    method: "POST",
    apiKey,
    body: {
      name: opts.childName,
      wallet: "none",
      spawn_authorization: spawnAuth
    }
  });
  if (reg.error || !reg.data?.hash) {
    return { data: null, error: reg.error ?? "Spawn step 2 (child registration) failed" };
  }
  const childHash = reg.data.hash;
  const childApiKey = reg.data.api_key;
  const step3 = await apiFetch("/api/v1/agent/spawn", {
    method: "POST",
    apiKey,
    body: { child_hash: childHash }
  });
  if (step3.error) {
    return { data: null, error: step3.error };
  }
  return {
    data: {
      child_hash: childHash,
      child_api_key: childApiKey,
      child_depth: reg.data.depth,
      parent_hash: opts.parentHash
    },
    error: null
  };
}

// src/handlers.ts
function requireCredentials() {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error(
      "Not registered. Call provenonce_register first."
    );
  }
  return creds;
}
function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function err(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}
async function handleRegister(args) {
  const existing = loadCredentials();
  if (existing) {
    const { data: data2, error: error2 } = await getStatus(existing.api_key);
    if (data2) {
      return ok({
        registered: false,
        message: "Already registered \u2014 returning existing identity.",
        hash: existing.agent_hash,
        sigil: data2.sigil,
        identity_class: data2.identity_class,
        _hint: data2._hint
      });
    }
    if (error2) {
    }
  }
  const { data, error } = await registerAgent({
    name: args.name,
    skillRef: args.skill_ref
  });
  if (error || !data) return err(error ?? "Registration failed");
  saveCredentials({ api_key: data.api_key, agent_hash: data.hash });
  return ok({
    registered: true,
    hash: data.hash,
    api_key: data.api_key,
    depth: data.depth,
    message: "Agent registered. Credentials saved. Call provenonce_status to see your full state.",
    _warning: "Save your api_key securely. It will not be shown again after this session."
  });
}
async function handleStatus() {
  const creds = requireCredentials();
  const { data, error } = await getStatus(creds.api_key);
  if (error || !data) return err(error ?? "Failed to get status");
  return ok(data);
}
async function handlePurchaseSigil(args) {
  const creds = requireCredentials();
  const skillRef = process.env.PROVENONCE_SKILL_REF;
  if (!args.payment_tx) {
    const fees = await fetchFees();
    const schedule = fees.data?.schedule;
    const sigilTier = schedule?.sigil_tiers?.find((t) => t.identity_class === args.identity_class);
    const feeSol = sigilTier?.sol ?? 0;
    const feeLamports = sigilTier?.lamports ?? 0;
    return ok({
      payment_required: true,
      fee_sol: feeSol,
      fee_lamports: feeLamports,
      payment_address: fees.data?.payment_address ?? null,
      payment_chain: fees.data?.payment_chain ?? "solana",
      identity_class: args.identity_class,
      message: feeSol === 0 ? 'Sandbox SIGIL is free. Call again with payment_tx set to "sandbox-free".' : `SIGIL purchase requires ${feeSol} SOL. Send ${feeSol} SOL to the payment_address, then call provenonce_purchase_sigil again with payment_tx set to the transaction signature.`
    });
  }
  const { data, error } = await purchaseSigil(creds.api_key, {
    name: args.name,
    principal: args.principal,
    identity_class: args.identity_class,
    tier: args.tier,
    payment_tx: args.payment_tx,
    skillRef
  });
  if (error || !data) return err(error ?? "SIGIL purchase failed");
  return ok({
    ...data,
    heartbeat_unlocked: true,
    message: `SIGIL issued: ${data.sigil}. You can now call provenonce_heartbeat and provenonce_get_passport.`
  });
}
async function handleHeartbeat(args) {
  const creds = requireCredentials();
  if (!args.payment_tx) {
    const fees = await fetchFees();
    const schedule = fees.data?.schedule;
    const tier1 = schedule?.heartbeat_tiers?.[0];
    const feeSol = tier1?.sol ?? 0;
    const feeLamports = tier1?.lamports ?? 0;
    return ok({
      payment_required: true,
      fee_sol: feeSol,
      fee_lamports: feeLamports,
      payment_address: fees.data?.payment_address ?? null,
      payment_chain: fees.data?.payment_chain ?? "solana",
      message: `Heartbeat requires ${feeSol} SOL. Send ${feeSol} SOL to the payment_address, then call provenonce_heartbeat again with payment_tx set to the transaction signature.`
    });
  }
  const { data, error } = await heartbeat(creds.api_key, args.payment_tx);
  if (error || !data) return err(error ?? "Heartbeat failed");
  if (!data.ok && data.sigil_required) {
    return err("SIGIL required. Call provenonce_purchase_sigil first.");
  }
  return ok({
    ok: data.ok,
    message: data.ok ? "Heartbeat recorded. Agent liveness confirmed." : "Heartbeat failed."
  });
}
async function handleGetPassport(args) {
  const creds = requireCredentials();
  const { data, error } = await getPassport(creds.api_key, args.payment_tx);
  if (error) {
    if (!args.payment_tx && (error.includes("payment") || error.includes("PAYMENT"))) {
      const fees = await fetchFees();
      const feeSol = fees.data?.schedule?.proof_reissuance_sol ?? 0;
      return ok({
        payment_required: true,
        fee_sol: feeSol,
        fee_lamports: Math.round(feeSol * 1e9),
        payment_address: fees.data?.payment_address ?? null,
        payment_chain: fees.data?.payment_chain ?? "solana",
        message: `Passport reissue requires ${feeSol} SOL. Send ${feeSol} SOL to the payment_address, then call provenonce_get_passport again with payment_tx set to the transaction signature.`
      });
    }
    return err(error);
  }
  if (!data) return err("Passport retrieval failed");
  return ok({
    passport: data.lineage_proof,
    message: "Passport issued. Share this signed document with any third party to prove your identity offline.",
    _verify: "Verify at: GET https://provenonce.io/.well-known/provenonce-authority.json for the authority public key."
  });
}
function computeBeatHash(prevHash, beatIndex, difficulty, anchorHash) {
  const seed = anchorHash ? `${prevHash}:${beatIndex}::${anchorHash}` : `${prevHash}:${beatIndex}:`;
  let current = createHash("sha256").update(seed, "utf8").digest("hex");
  for (let i = 0; i < difficulty; i++) {
    current = createHash("sha256").update(current, "utf8").digest("hex");
  }
  return current;
}
async function computeWorkProof(count, difficulty) {
  const anchorRes = await fetchAnchor();
  const anchor = anchorRes.data?.anchor;
  const anchorHash = anchor?.hash;
  const anchorIndex = anchor?.beat_index ?? 0;
  const genesisInput = `provenonce:beats:${randomBytes(16).toString("hex")}`;
  const genesisHash = createHash("sha256").update(genesisInput, "utf8").digest("hex");
  const spotCheckIndices = selectSpotCheckIndices(count);
  const spotChecks = [];
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
    duration_ms: duration
  };
  const submitRes = await submitWorkProof({
    from_hash: fromHash,
    to_hash: toHash,
    beats_computed: count,
    difficulty,
    anchor_index: anchorIndex,
    anchor_hash: anchorHash,
    spot_checks: spotChecks
  });
  if (submitRes.error) {
    return { receipt: null, localProof, error: `Beats submission failed: ${submitRes.error}` };
  }
  if (!submitRes.data?.valid) {
    return { receipt: null, localProof, error: `Beats rejected proof: ${submitRes.data?.reason ?? "unknown"}` };
  }
  return { receipt: submitRes.data.receipt ?? null, localProof };
}
function selectSpotCheckIndices(count) {
  const minChecks = 3;
  const density = 1e3;
  const maxChecks = 25;
  const needed = Math.max(
    Math.min(count, minChecks),
    Math.min(Math.ceil(count / density), maxChecks)
  );
  const indices = /* @__PURE__ */ new Set();
  indices.add(1);
  indices.add(count);
  if (needed > 2 && count > 2) {
    const interiorNeeded = needed - 2;
    for (let j = 1; j <= interiorNeeded; j++) {
      const idx = Math.round(1 + j * (count - 1) / (interiorNeeded + 1));
      if (idx > 1 && idx < count) {
        indices.add(idx);
      }
    }
  }
  return indices;
}
async function handleBeatsProof(args) {
  const count = Math.max(10, Math.min(1e4, args.count));
  const difficulty = Math.max(100, Math.min(5e3, args.difficulty ?? 1e3));
  const { receipt, localProof, error } = await computeWorkProof(count, difficulty);
  if (receipt) {
    return ok({
      ...localProof,
      difficulty,
      receipt,
      message: `Computed ${count} beats at difficulty ${difficulty} in ${localProof.duration_ms}ms. Signed receipt obtained from Beats service.`
    });
  }
  return ok({
    ...localProof,
    difficulty,
    receipt: null,
    _warning: error ?? "Could not obtain signed receipt from Beats service.",
    message: `Computed ${count} beats locally in ${localProof.duration_ms}ms but receipt not available. ${error ?? ""}`
  });
}
async function handleSubmitBeats(args) {
  const creds = requireCredentials();
  const count = Math.max(10, Math.min(2e3, args.count ?? 100));
  const difficulty = 1e3;
  const stateRes = await getAgentBeatState(creds.api_key);
  if (stateRes.error || !stateRes.data) {
    return err(stateRes.error ?? "Failed to get agent beat state. Call provenonce_register first.");
  }
  const { latest_beat_index: fromBeat, latest_beat_hash: fromHash, difficulty: agentDifficulty } = stateRes.data;
  const effectiveDifficulty = agentDifficulty || difficulty;
  const anchorRes = await fetchAnchor();
  const anchor = anchorRes.data?.anchor;
  if (!anchor) {
    return err("Could not fetch global anchor. Try again.");
  }
  const anchorHash = anchor.hash;
  const anchorIndex = anchor.beat_index;
  const spotCheckIndices = selectSpotCheckIndices(count);
  const spotChecks = [];
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
  const submitRes = await submitBeatsToRegistry(creds.api_key, {
    from_beat: fromBeat,
    to_beat: toBeat,
    from_hash: fromHash,
    to_hash: toHash,
    beats_computed: count,
    global_anchor: anchorIndex,
    anchor_hash: anchorHash,
    spot_checks: spotChecks
  });
  if (submitRes.error || !submitRes.data) {
    return err(submitRes.error ?? "Registry rejected beat submission.");
  }
  return ok({
    beats_accepted: submitRes.data.beats_accepted,
    total_beats: submitRes.data.total_beats,
    duration_ms: duration,
    difficulty: effectiveDifficulty,
    message: `Submitted ${count} beats to Registry in ${duration}ms. Total lifetime beats: ${submitRes.data.total_beats}.`
  });
}
async function handleBatchHeartbeat(args) {
  const creds = requireCredentials();
  if (!args.payment_tx) {
    const fees = await fetchFees();
    const schedule = fees.data?.schedule;
    const tier1 = schedule?.heartbeat_tiers?.[0];
    const feePerChild = tier1?.lamports ?? 0;
    const totalFee = feePerChild * args.children.length;
    return ok({
      payment_required: true,
      fee_per_child_lamports: feePerChild,
      total_fee_lamports: totalFee,
      total_fee_sol: totalFee / 1e9,
      children_count: args.children.length,
      payment_address: fees.data?.payment_address ?? null,
      payment_chain: fees.data?.payment_chain ?? "solana",
      message: `Batch heartbeat for ${args.children.length} children requires ${totalFee / 1e9} SOL total. Send to the payment_address, then call again with payment_tx.`
    });
  }
  const { data, error } = await batchHeartbeat(creds.api_key, args.children, args.payment_tx);
  if (error || !data) return err(error ?? "Batch heartbeat failed");
  return ok({
    ok: data.ok,
    summary: data.summary,
    results: data.results,
    message: data.ok ? `Batch heartbeat: ${data.summary.succeeded}/${data.summary.total} succeeded.` : "Batch heartbeat failed for all children."
  });
}
async function handleVerifyAgent(args) {
  const { data, error } = await verifyAgent(args.hash);
  if (error || !data) return err(error ?? "Verification failed");
  return ok(data);
}
async function handleSpawn(args) {
  const creds = requireCredentials();
  const SPAWN_BEATS = 1050;
  const SPAWN_DIFFICULTY = 1e3;
  const { receipt, error: proofError } = await computeWorkProof(SPAWN_BEATS, SPAWN_DIFFICULTY);
  if (!receipt) {
    return err(
      `Failed to obtain Beats work-proof receipt for spawn. ${proofError ?? "Unknown error"}. You can try calling provenonce_beats_proof with count=1050 manually, then retry spawn.`
    );
  }
  const { data, error } = await spawnChild(creds.api_key, {
    childName: args.child_name,
    parentHash: creds.agent_hash,
    beatsReceipt: receipt
  });
  if (error || !data) return err(error ?? "Spawn failed");
  return ok({
    ...data,
    message: `Child agent spawned: ${data.child_hash}. Save the child_api_key \u2014 it will not be shown again.`,
    _warning: "The child agent has its own identity. Configure it with PROVENONCE_API_KEY + PROVENONCE_AGENT_HASH."
  });
}
async function handleGetLineage(args) {
  const creds = loadCredentials();
  const targetHash = args.hash ?? creds?.agent_hash;
  if (!targetHash) {
    return err("No hash provided and agent is not registered. Call provenonce_register first or provide a hash.");
  }
  const { data, error } = await getLineage(targetHash);
  if (error || !data) return err(error ?? "Lineage retrieval failed");
  return ok(data);
}

// src/index.ts
var server = new Server(
  { name: "provenonce", version: "1.0.0" },
  { capabilities: { tools: {} } }
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: PROVENONCE_TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations
  }))
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args;
  switch (name) {
    case "provenonce_register":
      return handleRegister({
        name: a.name,
        skill_ref: a.skill_ref
      });
    case "provenonce_status":
      return handleStatus();
    case "provenonce_purchase_sigil":
      return handlePurchaseSigil({
        name: a.name,
        principal: a.principal,
        identity_class: a.identity_class,
        tier: a.tier,
        payment_tx: a.payment_tx
      });
    case "provenonce_heartbeat":
      return handleHeartbeat({ payment_tx: a.payment_tx });
    case "provenonce_get_passport":
      return handleGetPassport({ payment_tx: a.payment_tx });
    case "provenonce_beats_proof":
      return handleBeatsProof({
        count: a.count,
        difficulty: a.difficulty
      });
    case "provenonce_submit_beats":
      return handleSubmitBeats({
        count: a.count
      });
    case "provenonce_verify_agent":
      return handleVerifyAgent({ hash: a.hash });
    case "provenonce_spawn":
      return handleSpawn({ child_name: a.child_name });
    case "provenonce_get_lineage":
      return handleGetLineage({ hash: a.hash });
    case "provenonce_batch_heartbeat":
      return handleBatchHeartbeat({
        children: a.children,
        payment_tx: a.payment_tx
      });
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true
      };
  }
});
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((err2) => {
  process.stderr.write(`Fatal: ${err2.message}
`);
  process.exit(1);
});
//# sourceMappingURL=index.js.map