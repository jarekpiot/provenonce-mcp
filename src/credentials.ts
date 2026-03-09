import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { StoredCredentials } from './types.js';

function getConfigDir(): string {
  return join(homedir(), '.provenonce');
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

/** Load credentials — env vars take priority over config file */
export function loadCredentials(): StoredCredentials | null {
  const apiKey = process.env.PROVENONCE_API_KEY;
  const agentHash = process.env.PROVENONCE_AGENT_HASH;

  if (apiKey && agentHash) {
    return { api_key: apiKey, agent_hash: agentHash };
  }

  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredCredentials>;
    if (parsed.api_key && parsed.agent_hash) {
      return { api_key: parsed.api_key, agent_hash: parsed.agent_hash };
    }
  } catch {
    // Corrupt config — treat as missing
  }

  return null;
}

/** Persist credentials to ~/.provenonce/config.json (chmod 600) */
export function saveCredentials(creds: StoredCredentials): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const configPath = getConfigPath();
  const data: StoredCredentials = {
    api_key: creds.api_key,
    agent_hash: creds.agent_hash,
  };

  writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');

  // chmod 600 — owner read/write only (Unix only; no-op on Windows)
  try {
    chmodSync(configPath, 0o600);
  } catch {
    // Windows — chmod not supported; recommend env var instead
  }
}

/** Clear stored credentials */
export function clearCredentials(): void {
  const configPath = getConfigPath();
  if (existsSync(configPath)) {
    writeFileSync(configPath, '{}', 'utf-8');
  }
}
