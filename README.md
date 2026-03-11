# @provenonce/mcp

**Provenonce Skill** — Give any AI agent cryptographic identity in under 60 seconds.

Add this skill to your agent and it gets:
- A permanent cryptographic hash (identity)
- A SIGIL (verified identity class + tier)
- A signed Passport (verifiable offline by any third party)
- Heartbeat (continuous liveness proof)
- Beats proofs (evidence of computational work)
- Lineage (full ancestry chain)

## Quick Start

### Claude Desktop / Claude Code

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "provenonce": {
      "command": "npx",
      "args": ["-y", "@provenonce/mcp"]
    }
  }
}
```

That's it. On first use, your agent calls `provenonce_register` and gets a permanent identity.

### With pre-existing credentials

```json
{
  "mcpServers": {
    "provenonce": {
      "command": "npx",
      "args": ["-y", "@provenonce/mcp"],
      "env": {
        "PROVENONCE_API_KEY": "pvn_...",
        "PROVENONCE_AGENT_HASH": "0x..."
      }
    }
  }
}
```

### As a skill developer (earn rev share)

If you're a developer embedding this skill in your framework, include your partner ref token:

```json
{
  "env": {
    "PROVENONCE_SKILL_REF": "your16hextoken"
  }
}
```

You earn 30% of every SIGIL purchased by agents you deploy. Register at `POST /api/v1/skill/register`.

## The 11 Tools

| Tool | What it does | Auth needed |
|------|-------------|-------------|
| `provenonce_register` | Auto-register agent, get hash + API key | None |
| `provenonce_status` | Full current state (SIGIL, balance, hints) | Yes |
| `provenonce_purchase_sigil` | Buy SIGIL, unlock heartbeat + passport | Yes + SOL tx |
| `provenonce_heartbeat` | Submit liveness proof | Yes + SOL tx |
| `provenonce_batch_heartbeat` | Heartbeat multiple children in one call | Yes + SOL tx |
| `provenonce_get_passport` | Get signed identity document | Yes |
| `provenonce_beats_proof` | Compute work proof, get receipt (for spawn/resync) | None |
| `provenonce_submit_beats` | Compute VDF beats and credit lifetime beat count | Yes |
| `provenonce_verify_agent` | Check another agent's identity | None |
| `provenonce_spawn` | Spawn a child agent | Yes |
| `provenonce_get_lineage` | Get full ancestry chain | None |

## Usage Examples

### Example 1: Register and check status

**User prompt:** "Register with Provenonce and show me my identity."

**Expected behavior:**
- Agent calls `provenonce_register` with an optional name
- Receives a permanent cryptographic hash (e.g. `0xabcd...`) and API key
- Credentials are saved to `~/.provenonce/config.json`
- Agent calls `provenonce_status` to display identity, balance, and next steps
- Status response includes a `_hint` suggesting the agent purchase a SIGIL

### Example 2: Verify another agent before trusting it

**User prompt:** "Check if agent 0xf7dad8f4...b6fd is legitimate."

**Expected behavior:**
- Agent calls `provenonce_verify_agent` with the target hash
- Returns the agent's SIGIL, identity class, tier, registration date, and liveness score
- Agent reports whether the target has an active SIGIL and recent heartbeats
- No authentication needed — this is a public verification endpoint

### Example 3: Full lifecycle — SIGIL, heartbeat, and passport

**User prompt:** "Get me a SIGIL, send a heartbeat, and export my passport."

**Expected behavior:**
- Agent calls `provenonce_purchase_sigil` without `payment_tx` to get fee instructions (amount in SOL + ops wallet address)
- User sends the SOL payment and provides the transaction signature
- Agent calls `provenonce_purchase_sigil` again with the `payment_tx` to complete the purchase
- Agent calls `provenonce_heartbeat` (same payment flow) to prove liveness
- Agent calls `provenonce_get_passport` to receive a cryptographically signed identity document
- Passport can be verified offline by any third party using the Provenonce authority public key

## Agent Flow

```
Day 1:  provenonce_register      → hash minted, credentials saved
        provenonce_beats_proof   → works immediately, no SIGIL needed
        provenonce_status        → { sigil: null, _hint: "Call provenonce_purchase_sigil..." }

Day 7:  provenonce_purchase_sigil → pay SOL, SIGIL issued
        provenonce_heartbeat     → now unlocked
        provenonce_get_passport  → signed identity doc, share with anyone
        provenonce_verify_agent  → verify a counterparty before trusting them
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PROVENONCE_API_KEY` | Agent API key (pvn_...) | Read from ~/.provenonce/config.json |
| `PROVENONCE_AGENT_HASH` | Agent hash (0x...) | Read from ~/.provenonce/config.json |
| `PROVENONCE_SKILL_REF` | Your partner ref token (for rev share) | None |
| `PROVENONCE_REGISTRY_URL` | Registry URL override | https://provenonce.io |

## Framework-Agnostic Usage

```typescript
import { PROVENONCE_TOOLS } from '@provenonce/mcp/tools';

// OpenAI
const tools = PROVENONCE_TOOLS.map(t => ({ type: 'function', function: t }));

// LangChain / custom — use PROVENONCE_TOOLS for schema, implement handlers yourself
```

## Credential Storage

Credentials are stored in `~/.provenonce/config.json` with `chmod 600` permissions (Unix).

On Windows, use environment variables (`PROVENONCE_API_KEY` + `PROVENONCE_AGENT_HASH`) — file permissions are not enforced.

## Privacy Policy

Provenonce collects the minimum data necessary to provide cryptographic identity services:

- **Data collected:** Agent name (optional), cryptographic hash (generated), API key, SIGIL metadata, heartbeat timestamps, and Solana transaction signatures for payments.
- **How data is used:** To maintain the agent identity registry, verify agent liveness, and issue signed passports. No data is sold to third parties.
- **Storage:** Agent state is stored in Supabase (PostgreSQL). Tamper-proof timestamps are anchored on the Solana blockchain as SPL Memo transactions.
- **Third-party sharing:** On-chain memos (registration, SIGIL) are publicly visible on Solana. No other data is shared with third parties.
- **Retention:** Agent records persist indefinitely as part of the provenance chain. Revoked agents are marked but not deleted.
- **Contact:** ops@provenonce.io

Full privacy policy: [provenonce.dev/legal/privacy](https://provenonce.dev/legal/privacy)

## Support

- Documentation: [provenonce.dev](https://provenonce.dev)
- Issues: [github.com/ProvenonceAI/provenonce-mcp/issues](https://github.com/ProvenonceAI/provenonce-mcp/issues)
- Email: ops@provenonce.io

## What's Coming

- `provenonce_kyc` — KYC / identity class upgrade
- Auto-heartbeat timer (opt-in)
- Python SDK (`provenonce-py`)

## License

MIT — see [LICENSE](./LICENSE)

## Links

- Registry: [provenonce.io](https://provenonce.io)
- Docs: [provenonce.dev](https://provenonce.dev)
- API: [provenonce.io/openapi.yaml](https://provenonce.io/openapi.yaml)
