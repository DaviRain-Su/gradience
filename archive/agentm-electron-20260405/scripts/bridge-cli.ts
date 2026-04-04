#!/usr/bin/env node
/**
 * Web Entry Bridge CLI
 *
 * Command-line tool for testing and running the local bridge
 * Usage: npx bridge-cli --pair-code XXXXXXXX
 */

import { createBridgeClient, type BridgeEvent, type ChatRequest, type VoiceRequest } from '../src/main/web-entry/bridge-client.js';

interface CliOptions {
  pairCode: string;
  gatewayUrl: string;
  machineName: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: Partial<CliOptions> = {
    gatewayUrl: 'http://127.0.0.1:3939',
    machineName: 'cli-bridge',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--pair-code':
      case '-p':
        options.pairCode = args[++i];
        break;
      case '--gateway':
      case '-g':
        options.gatewayUrl = args[++i];
        break;
      case '--machine':
      case '-m':
        options.machineName = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }

  if (!options.pairCode) {
    console.error('Error: --pair-code is required');
    showHelp();
    process.exit(1);
  }

  return options as CliOptions;
}

function showHelp(): void {
  console.log(`
Web Entry Bridge CLI

Usage: bridge-cli [options]

Options:
  -p, --pair-code <code>   Pair code from web session (required)
  -g, --gateway <url>      Gateway URL (default: http://127.0.0.1:3939)
  -m, --machine <name>     Machine name (default: cli-bridge)
  -h, --help               Show this help

Examples:
  bridge-cli --pair-code ABC12345
  bridge-cli -p ABC12345 -g http://localhost:3939
`);
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('🔌 Web Entry Bridge CLI');
  console.log(`   Gateway: ${options.gatewayUrl}`);
  console.log(`   Machine: ${options.machineName}`);
  console.log(`   Pair Code: ${options.pairCode}`);
  console.log();

  const client = createBridgeClient({
    gatewayUrl: options.gatewayUrl,
    machineName: options.machineName,
    autoReconnect: true,
  });

  // Handle events
  client.onEvent((event: BridgeEvent) => {
    switch (event.type) {
      case 'connected':
        console.log('✅ Connected to gateway');
        console.log('   Waiting for chat requests...');
        console.log('   Press Ctrl+C to exit');
        console.log();
        break;

      case 'disconnected':
        console.log(`❌ Disconnected: ${event.reason}`);
        break;

      case 'reconnecting':
        console.log(`🔄 Reconnecting (attempt ${event.attempt})...`);
        break;

      case 'chat.request':
        handleChatRequest(client, event.request);
        break;

      case 'voice.request':
        handleVoiceRequest(client, event.request);
        break;

      case 'error':
        console.error(`❌ Error [${event.code}]: ${event.message}`);
        break;
    }
  });

  // Attach and connect
  try {
    console.log('📡 Attaching to session...');
    const session = await client.attach(options.pairCode);
    console.log(`✅ Attached! Bridge ID: ${session.bridgeId.slice(0, 8)}...`);
    console.log();

    // Register a demo agent
    client.registerAgents([{
      agentId: 'demo-agent',
      displayName: 'Demo Agent (CLI)',
      status: 'idle',
      capabilities: ['text'],
    }]);

    console.log('🤖 Registered agent: demo-agent');
    console.log();

    // Connect WebSocket
    client.connect();

  } catch (error) {
    console.error('❌ Failed to attach:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Keep running
  process.on('SIGINT', () => {
    console.log('\n👋 Disconnecting...');
    client.disconnect();
    process.exit(0);
  });
}

function handleChatRequest(client: ReturnType<typeof createBridgeClient>, request: ChatRequest): void {
  console.log(`💬 Chat request [${request.requestId.slice(0, 8)}]: ${request.text.slice(0, 50)}...`);

  // Simulate streaming response
  const responses = [
    'Hello! ',
    'I received your message: "',
    request.text.slice(0, 20),
    '..." ',
    'This is a demo response from the CLI bridge.',
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < responses.length - 1) {
      client.sendChatResponse({
        requestId: request.requestId,
        delta: responses[i],
      });
      i++;
    } else {
      client.sendChatResponse({
        requestId: request.requestId,
        text: responses.join(''),
        done: true,
      });
      clearInterval(interval);
      console.log('✅ Response sent');
    }
  }, 500);
}

function handleVoiceRequest(client: ReturnType<typeof createBridgeClient>, request: VoiceRequest): void {
  console.log(`🎤 Voice request [${request.requestId.slice(0, 8)}]: ${request.event}`);

  if (request.event === 'start') {
    console.log('   Voice stream started');
  } else if (request.event === 'stop') {
    console.log('   Voice stream stopped');
    // Send a mock transcript
    client.sendVoiceResponse({
      requestId: request.requestId,
      transcriptFinal: 'Voice message received (demo)',
      done: true,
    });
  }
}

main().catch(console.error);
