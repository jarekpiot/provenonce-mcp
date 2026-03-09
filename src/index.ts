import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { PROVENONCE_TOOLS } from './tools.js';
import {
  handleRegister,
  handleStatus,
  handlePurchaseSigil,
  handleHeartbeat,
  handleGetPassport,
  handleBeatsProof,
  handleSubmitBeats,
  handleVerifyAgent,
  handleSpawn,
  handleGetLineage,
  handleBatchHeartbeat,
} from './handlers.js';

const server = new Server(
  { name: 'provenonce', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: PROVENONCE_TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  })),
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;

  switch (name) {
    case 'provenonce_register':
      return handleRegister({
        name: a.name as string | undefined,
        skill_ref: a.skill_ref as string | undefined,
      });

    case 'provenonce_status':
      return handleStatus();

    case 'provenonce_purchase_sigil':
      return handlePurchaseSigil({
        name: a.name as string,
        principal: a.principal as string,
        identity_class: a.identity_class as string,
        tier: a.tier as string,
        payment_tx: a.payment_tx as string,
      });

    case 'provenonce_heartbeat':
      return handleHeartbeat({ payment_tx: a.payment_tx as string });

    case 'provenonce_get_passport':
      return handleGetPassport({ payment_tx: a.payment_tx as string | undefined });

    case 'provenonce_beats_proof':
      return handleBeatsProof({
        count: a.count as number,
        difficulty: a.difficulty as number | undefined,
      });

    case 'provenonce_submit_beats':
      return handleSubmitBeats({
        count: a.count as number | undefined,
      });

    case 'provenonce_verify_agent':
      return handleVerifyAgent({ hash: a.hash as string });

    case 'provenonce_spawn':
      return handleSpawn({ child_name: a.child_name as string });

    case 'provenonce_get_lineage':
      return handleGetLineage({ hash: a.hash as string | undefined });

    case 'provenonce_batch_heartbeat':
      return handleBatchHeartbeat({
        children: a.children as string[],
        payment_tx: a.payment_tx as string | undefined,
      });

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// Start stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
