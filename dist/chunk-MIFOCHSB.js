// @provenonce/mcp — Provenonce Skill for AI agents

// src/tools.ts
var PROVENONCE_TOOLS = [
  {
    name: "provenonce_register",
    title: "Register Agent Identity",
    description: "Register this agent with Provenonce to get a cryptographic identity (hash + API key). Safe to call multiple times \u2014 returns existing identity if already registered. No wallet required. Free.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Human-readable name for this agent (optional, max 64 chars)",
          maxLength: 64
        },
        skill_ref: {
          type: "string",
          description: "16-character hex ref token of the skill that deployed you \u2014 for rev-share attribution (optional)",
          pattern: "^[0-9a-f]{16}$"
        }
      }
    },
    annotations: {
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_status",
    title: "Get Agent Status",
    description: "Get this agent's current Provenonce status: identity, SIGIL, beats balance, and next steps. Requires prior provenonce_register call.",
    inputSchema: {
      type: "object",
      properties: {}
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_purchase_sigil",
    title: "Purchase SIGIL Identity",
    description: "Purchase a Provenonce SIGIL to unlock full provenance: heartbeat access, signed passport, and a permanent identity record. If payment_tx is omitted, returns payment instructions (fee amount + address). SIGIL format: name*principal*tier (e.g. my-agent*acme*ind).",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: 'SIGIL name segment \u2014 identifies this specific agent (e.g. "my-agent")'
        },
        principal: {
          type: "string",
          description: 'Principal segment \u2014 identifies the operator or organisation (e.g. "acme")'
        },
        identity_class: {
          type: "string",
          enum: ["narrow_task", "autonomous", "orchestrator"],
          description: "Agent identity class (pricing axis): narrow_task=single-purpose, autonomous=independent decision-maker, orchestrator=coordinates other agents"
        },
        tier: {
          type: "string",
          enum: ["sov", "org", "ind", "eph", "sbx"],
          description: "Trust governance tier: sov=sovereign/root, org=organisation, ind=individual, eph=ephemeral, sbx=sandbox"
        },
        payment_tx: {
          type: "string",
          description: "Solana transaction signature for the SIGIL fee payment. If omitted, returns payment instructions instead."
        }
      },
      required: ["name", "principal", "identity_class", "tier"]
    },
    annotations: {
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_heartbeat",
    title: "Submit Heartbeat",
    description: "Submit a heartbeat to prove this agent is alive. Root agents (depth 0) require a SIGIL first; child agents (depth > 0) can heartbeat without a SIGIL. If payment_tx is omitted, returns payment instructions (fee amount + address).",
    inputSchema: {
      type: "object",
      properties: {
        payment_tx: {
          type: "string",
          description: "Solana transaction signature for the heartbeat fee payment. If omitted, returns payment instructions instead."
        }
      }
    },
    annotations: {
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_get_passport",
    title: "Get Signed Passport",
    description: "Get this agent's cryptographically signed Passport \u2014 a verifiable identity document any third party can verify offline using the Provenonce authority public key. Root agents (depth 0) require an active SIGIL; child agents (depth > 0) only need at least one heartbeat.",
    inputSchema: {
      type: "object",
      properties: {
        payment_tx: {
          type: "string",
          description: "Solana transaction signature for the passport reissue fee (if applicable)"
        }
      }
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_beats_proof",
    title: "Compute Beats Work-Proof",
    description: "Compute a Beats work-proof \u2014 cryptographic evidence of computational effort by this agent. Computes sequential hash chains at the current network difficulty, submits to the Beats service for a signed receipt. The receipt can be used for spawn authorization and other operations.",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "integer",
          description: "Number of beats to compute (min 10, max 10000)",
          minimum: 10,
          maximum: 1e4
        },
        difficulty: {
          type: "integer",
          description: "Hash iterations per beat (default 1000, min 100, max 5000). Usually auto-detected from network.",
          minimum: 100,
          maximum: 5e3
        }
      },
      required: ["count"]
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_submit_beats",
    title: "Submit Beats to Registry",
    description: `Compute VDF beats and submit to the Registry to credit this agent's lifetime beat count. Unlike provenonce_beats_proof (which gets a receipt for spawn/resync), this extends the agent's persistent beat chain and increases the "Lifetime Beats" metric visible in the Registry.`,
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "integer",
          description: "Number of beats to compute and submit (default 100, min 10, max 2000)",
          minimum: 10,
          maximum: 2e3
        }
      }
    },
    annotations: {
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_verify_agent",
    title: "Verify Agent Identity",
    description: "Verify another agent's Provenonce identity. Returns their SIGIL, identity class, and registration status. Public \u2014 no authentication required.",
    inputSchema: {
      type: "object",
      properties: {
        hash: {
          type: "string",
          description: "The agent hash to verify (0x + 64 hex chars)",
          pattern: "^0x[0-9a-fA-F]{64}$"
        }
      },
      required: ["hash"]
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_spawn",
    title: "Spawn Child Agent",
    description: "Spawn a child agent under this agent's identity. The child inherits lineage from the parent. Returns the child's hash and API key. Requires sufficient beats balance or a work-proof receipt.",
    inputSchema: {
      type: "object",
      properties: {
        child_name: {
          type: "string",
          description: "Name for the child agent (max 64 chars)",
          maxLength: 64
        }
      },
      required: ["child_name"]
    },
    annotations: {
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_get_lineage",
    title: "Get Agent Lineage",
    description: "Get the full lineage chain for an agent \u2014 all events in its provenance history (registration, SIGIL issuance, heartbeats, spawns). Public \u2014 no authentication required.",
    inputSchema: {
      type: "object",
      properties: {
        hash: {
          type: "string",
          description: "The agent hash to get lineage for (0x + 64 hex chars). Defaults to this agent if omitted.",
          pattern: "^0x[0-9a-fA-F]{64}$"
        }
      }
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true
    }
  },
  {
    name: "provenonce_batch_heartbeat",
    title: "Batch Heartbeat Children",
    description: "Submit heartbeats for multiple child agents in a single call. One payment covers all children. Requires active sponsorships for each child. Max 20 children per batch.",
    inputSchema: {
      type: "object",
      properties: {
        children: {
          type: "array",
          items: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
          description: "Array of child agent hashes to heartbeat (max 20)",
          minItems: 1,
          maxItems: 20
        },
        payment_tx: {
          type: "string",
          description: "Solana transaction signature covering the total fee for all children. If omitted, returns payment instructions."
        }
      },
      required: ["children"]
    },
    annotations: {
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    }
  }
];

export {
  PROVENONCE_TOOLS
};
//# sourceMappingURL=chunk-MIFOCHSB.js.map