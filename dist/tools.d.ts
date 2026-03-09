/** Provenonce Skill — 11 MCP tool definitions (JSON Schema) */
declare const PROVENONCE_TOOLS: readonly [{
    readonly name: "provenonce_register";
    readonly title: "Register Agent Identity";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly name: {
                readonly type: "string";
                readonly description: "Human-readable name for this agent (optional, max 64 chars)";
                readonly maxLength: 64;
            };
            readonly skill_ref: {
                readonly type: "string";
                readonly description: "16-character hex ref token of the skill that deployed you — for rev-share attribution (optional)";
                readonly pattern: "^[0-9a-f]{16}$";
            };
        };
    };
    readonly annotations: {
        readonly destructiveHint: true;
        readonly idempotentHint: true;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_status";
    readonly title: "Get Agent Status";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {};
    };
    readonly annotations: {
        readonly readOnlyHint: true;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_purchase_sigil";
    readonly title: "Purchase SIGIL Identity";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly name: {
                readonly type: "string";
                readonly description: "SIGIL name segment — identifies this specific agent (e.g. \"my-agent\")";
            };
            readonly principal: {
                readonly type: "string";
                readonly description: "Principal segment — identifies the operator or organisation (e.g. \"acme\")";
            };
            readonly identity_class: {
                readonly type: "string";
                readonly enum: readonly ["narrow_task", "autonomous", "orchestrator"];
                readonly description: "Agent identity class (pricing axis): narrow_task=single-purpose, autonomous=independent decision-maker, orchestrator=coordinates other agents";
            };
            readonly tier: {
                readonly type: "string";
                readonly enum: readonly ["sov", "org", "ind", "eph", "sbx"];
                readonly description: "Trust governance tier: sov=sovereign/root, org=organisation, ind=individual, eph=ephemeral, sbx=sandbox";
            };
            readonly payment_tx: {
                readonly type: "string";
                readonly description: "Solana transaction signature for the SIGIL fee payment. If omitted, returns payment instructions instead.";
            };
        };
        readonly required: readonly ["name", "principal", "identity_class", "tier"];
    };
    readonly annotations: {
        readonly destructiveHint: true;
        readonly idempotentHint: false;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_heartbeat";
    readonly title: "Submit Heartbeat";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly payment_tx: {
                readonly type: "string";
                readonly description: "Solana transaction signature for the heartbeat fee payment. If omitted, returns payment instructions instead.";
            };
        };
    };
    readonly annotations: {
        readonly destructiveHint: true;
        readonly idempotentHint: false;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_get_passport";
    readonly title: "Get Signed Passport";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly payment_tx: {
                readonly type: "string";
                readonly description: "Solana transaction signature for the passport reissue fee (if applicable)";
            };
        };
    };
    readonly annotations: {
        readonly readOnlyHint: true;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_beats_proof";
    readonly title: "Compute Beats Work-Proof";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly count: {
                readonly type: "integer";
                readonly description: "Number of beats to compute (min 10, max 10000)";
                readonly minimum: 10;
                readonly maximum: 10000;
            };
            readonly difficulty: {
                readonly type: "integer";
                readonly description: "Hash iterations per beat (default 1000, min 100, max 5000). Usually auto-detected from network.";
                readonly minimum: 100;
                readonly maximum: 5000;
            };
        };
        readonly required: readonly ["count"];
    };
    readonly annotations: {
        readonly readOnlyHint: true;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_submit_beats";
    readonly title: "Submit Beats to Registry";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly count: {
                readonly type: "integer";
                readonly description: "Number of beats to compute and submit (default 100, min 10, max 2000)";
                readonly minimum: 10;
                readonly maximum: 2000;
            };
        };
    };
    readonly annotations: {
        readonly destructiveHint: true;
        readonly idempotentHint: false;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_verify_agent";
    readonly title: "Verify Agent Identity";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly hash: {
                readonly type: "string";
                readonly description: "The agent hash to verify (0x + 64 hex chars)";
                readonly pattern: "^0x[0-9a-fA-F]{64}$";
            };
        };
        readonly required: readonly ["hash"];
    };
    readonly annotations: {
        readonly readOnlyHint: true;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_spawn";
    readonly title: "Spawn Child Agent";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly child_name: {
                readonly type: "string";
                readonly description: "Name for the child agent (max 64 chars)";
                readonly maxLength: 64;
            };
        };
        readonly required: readonly ["child_name"];
    };
    readonly annotations: {
        readonly destructiveHint: true;
        readonly idempotentHint: false;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_get_lineage";
    readonly title: "Get Agent Lineage";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly hash: {
                readonly type: "string";
                readonly description: "The agent hash to get lineage for (0x + 64 hex chars). Defaults to this agent if omitted.";
                readonly pattern: "^0x[0-9a-fA-F]{64}$";
            };
        };
    };
    readonly annotations: {
        readonly readOnlyHint: true;
        readonly openWorldHint: true;
    };
}, {
    readonly name: "provenonce_batch_heartbeat";
    readonly title: "Batch Heartbeat Children";
    readonly description: string;
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly children: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                    readonly pattern: "^0x[0-9a-fA-F]{64}$";
                };
                readonly description: "Array of child agent hashes to heartbeat (max 20)";
                readonly minItems: 1;
                readonly maxItems: 20;
            };
            readonly payment_tx: {
                readonly type: "string";
                readonly description: "Solana transaction signature covering the total fee for all children. If omitted, returns payment instructions.";
            };
        };
        readonly required: readonly ["children"];
    };
    readonly annotations: {
        readonly destructiveHint: true;
        readonly idempotentHint: false;
        readonly openWorldHint: true;
    };
}];
type ToolName = (typeof PROVENONCE_TOOLS)[number]['name'];

export { PROVENONCE_TOOLS, type ToolName };
