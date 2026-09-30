import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { GameManager } from '../server/game.js';
import { STARTER_TEMPLATES } from '../server/engine/strategy-interpreter.js';
import { RULE_TEMPLATES } from '../server/engine/rules.js';

async function testFullGameLoop() {
  console.log('[E2E] Starting multi-client WebSocket end-to-end test...');
  const server = http.createServer();
  const wss = new WebSocketServer({ server });

  function broadcast(data) {
    const json = JSON.stringify(data);
    for (const c of wss.clients) {
      if (c.readyState === 1) c.send(json);
    }
  }

  const game = new GameManager(broadcast);
  game.config.numberOfRounds = 2;
  game.config.roundDurationSec = 4;
  game.config.tickIntervalMs = 50;

  wss.on('connection', (ws) => {
    let boundId = null;
    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'JOIN') {
        boundId = game.addOrReconnectPlayer('sock_' + Math.random(), data.nickname, ws);
      } else if (data.type === 'HOST_START_GAME') {
        game.startGame();
      } else if (data.type === 'HOST_NEXT_ROUND') {
        game.forceNextRound();
      } else if (data.type === 'PLACE_ORDER') {
        game.executeImmediateOrder(boundId, data.side, data.sizePct, data.leverage);
      } else if (data.type === 'CLOSE_POSITION') {
        game.executeImmediateClose(boundId);
      } else if (data.type === 'SET_RULES') {
        game.updatePlayerRules(boundId, data.rules);
      } else if (data.type === 'SET_STRATEGY') {
        const res = game.setPlayerStrategy(boundId, data.strategy, data.enabled);
        ws.send(JSON.stringify({ type: 'STRATEGY_SET_RESULT', ...res }));
      } else if (data.type === 'TOGGLE_STRATEGY') {
        game.togglePlayerStrategy(boundId, data.enabled);
        ws.send(JSON.stringify({ type: 'STRATEGY_TOGGLED', enabled: data.enabled }));
      } else if (data.type === 'TEST_STRATEGY') {
        const res = game.testPlayerStrategy(boundId, data.strategy);
        ws.send(JSON.stringify({ type: 'STRATEGY_TEST_RESULT', result: res }));
      } else if (data.type === 'HOST_RESTART_GAME') {
        game.restartGame();
      } else if (data.type === 'HOST_END_GAME') {
        game.endGame();
      }
    });
  });

  await new Promise(r => server.listen(3998, r));
  console.log('[E2E] Test server listening on port 3998');

  // Client 1: Host
  const hostWs = new WebSocket('ws://localhost:3998');
  await new Promise(r => hostWs.on('open', r));
  hostWs.send(JSON.stringify({ type: 'JOIN', nickname: 'Host' }));

  // Client 2: Alice
  const aliceWs = new WebSocket('ws://localhost:3998');
  await new Promise(r => aliceWs.on('open', r));
  aliceWs.send(JSON.stringify({ type: 'JOIN', nickname: 'Alice' }));

  // Client 3: Bob
  const bobWs = new WebSocket('ws://localhost:3998');
  await new Promise(r => bobWs.on('open', r));
  bobWs.send(JSON.stringify({ type: 'JOIN', nickname: 'Bob' }));

  await new Promise(r => setTimeout(r, 200));

  console.log('[E2E] Connected players:', game.players.size);
  if (game.players.size !== 3) throw new Error('Expected 3 players');

  // Alice dry-runs strategy on last round data
  console.log('[E2E] Alice testing TEST_STRATEGY dry-run...');
  const testPromise = new Promise((resolve) => {
    aliceWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'STRATEGY_TEST_RESULT') {
          resolve(msg.result);
        }
      } catch (e) {}
    });
  });

  aliceWs.send(JSON.stringify({
    type: 'TEST_STRATEGY',
    strategy: STARTER_TEMPLATES.ma_crossover.blocks
  }));

  const backtestResult = await testPromise;
  if (!backtestResult.success) throw new Error('Dry run failed: ' + backtestResult.error);
  console.log(`[E2E] Alice dry-run succeeded! Simulated trades: ${backtestResult.tradesCount}, PnL: ${backtestResult.pnl}`);

  // Alice deploys Blockly automated strategy
  console.log('[E2E] Alice deploying SET_STRATEGY (MA Crossover)...');
  aliceWs.send(JSON.stringify({
    type: 'SET_STRATEGY',
    strategy: STARTER_TEMPLATES.ma_crossover.blocks,
    enabled: true
  }));

  // Alice tests TOGGLE_STRATEGY mid-round pause/resume
  aliceWs.send(JSON.stringify({
    type: 'TOGGLE_STRATEGY',
    enabled: true
  }));

  // Bob deploys 5-rule automation (RSI Dip template)
  console.log('[E2E] Bob deploying SET_RULES (RSI Dip)...');
  bobWs.send(JSON.stringify({
    type: 'SET_RULES',
    rules: RULE_TEMPLATES.rsi_dip
  }));

  // Host starts the game
  console.log('[E2E] Host starting game...');
  hostWs.send(JSON.stringify({ type: 'HOST_START_GAME' }));

  // Listen on Host WS for events
  const gameOverPromise = new Promise((resolve) => {
    hostWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ROUND_FINISHED') {
          console.log('[E2E] Round 1 finished! Host forcing round 2 immediately...');
          hostWs.send(JSON.stringify({ type: 'HOST_NEXT_ROUND' }));
        } else if (msg.type === 'GAME_OVER') {
          console.log('[E2E] Received GAME_OVER packet!');
          resolve(msg);
        }
      } catch (e) {}
    });
  });

  // Bob executes manual 10x trade
  await new Promise(r => setTimeout(r, 80));
  bobWs.send(JSON.stringify({
    type: 'PLACE_ORDER',
    side: 'LONG',
    sizePct: 50,
    leverage: 10
  }));

  // Bob tests immediate position close!
  await new Promise(r => setTimeout(r, 60));
  bobWs.send(JSON.stringify({
    type: 'CLOSE_POSITION'
  }));

  const gameOverMsg = await Promise.race([
    gameOverPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Game over timeout')), 8000))
  ]);

  console.log('[E2E] GAME_OVER received successfully!');
  console.log('[E2E] Revealed historical event:', gameOverMsg.revealedDate);
  console.log('[E2E] Player equity histories recorded:', Object.keys(gameOverMsg.allHistories));

  for (const nick of ['Host', 'Alice', 'Bob']) {
    const hist = gameOverMsg.allHistories[nick];
    if (!hist || hist.length === 0) throw new Error('Missing history for ' + nick);
    console.log(`[E2E] ${nick}: ${hist.length} equity points recorded`);
  }

  // Test HOST_RESTART_GAME keeping everyone connected
  console.log('[E2E] Testing HOST_RESTART_GAME...');
  const restartPromise = new Promise((resolve) => {
    aliceWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'GAME_RESTARTED') {
          resolve(msg);
        }
      } catch (e) {}
    });
  });

  hostWs.send(JSON.stringify({ type: 'HOST_RESTART_GAME' }));
  await restartPromise;
  console.log('[E2E] Received GAME_RESTARTED on Alice socket! Connected players:', game.players.size);
  if (game.state !== 'LOBBY') throw new Error('Expected state to be LOBBY after restart');
  if (game.players.size !== 3) throw new Error('Expected 3 players still connected after restart');

  hostWs.close();
  aliceWs.close();
  bobWs.close();
  server.close();
  console.log('[E2E] All multi-client E2E tests PASSED!');
  process.exit(0);
}

testFullGameLoop().catch(err => {
  console.error('[E2E] TEST FAILED:', err);
  process.exit(1);
});
