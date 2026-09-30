import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GameManager } from './game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const PORT = process.env.PORT || 3000;

// Mime types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>Intraday Trading Arena</title></head>
        <body style="font-family: sans-serif; background: #090b0e; color: #f3f4f6; padding: 40px; text-align: center;">
          <h2>Intraday Trading Arena Server Running</h2>
          <p>WebSocket endpoint is active on ws://localhost:${PORT}</p>
        </body>
      </html>
    `);
  }
});

const wss = new WebSocketServer({ server });

function broadcastToAll(data) {
  const json = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(json);
    }
  }
}

const game = new GameManager(broadcastToAll);

wss.on('connection', (ws) => {
  let boundPlayerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'JOIN': {
          const nickname = data.nickname || 'Trader_' + Math.floor(Math.random() * 1000);
          const socketId = 'sock_' + Math.random().toString(36).substring(2, 9);
          boundPlayerId = game.addOrReconnectPlayer(socketId, nickname, ws);
          ws.send(JSON.stringify({
            type: 'JOINED',
            playerId: boundPlayerId,
            nickname
          }));
          break;
        }

        case 'HOST_CONFIG': {
          if (boundPlayerId && boundPlayerId === game.hostPlayerId) {
            game.updateConfig(data.config);
          }
          break;
        }

        case 'HOST_START_GAME': {
          if (boundPlayerId && boundPlayerId === game.hostPlayerId) {
            game.startGame();
          }
          break;
        }

        case 'HOST_NEXT_ROUND': {
          if (boundPlayerId && boundPlayerId === game.hostPlayerId) {
            game.forceNextRound();
          }
          break;
        }

        case 'HOST_RESTART_GAME': {
          if (boundPlayerId && boundPlayerId === game.hostPlayerId) {
            game.restartGame();
          }
          break;
        }

        case 'HOST_END_GAME': {
          if (boundPlayerId && boundPlayerId === game.hostPlayerId) {
            game.endGame();
          }
          break;
        }

        case 'PLACE_ORDER': {
          if (boundPlayerId) {
            // Instant execution: zero lag
            game.executeImmediateOrder(boundPlayerId, data.side, data.sizePct, data.leverage, data.amount);
          }
          break;
        }

        case 'PLACE_LIMIT_ORDER': {
          if (boundPlayerId) {
            game.executeLimitOrder(boundPlayerId, data);
          }
          break;
        }

        case 'CANCEL_LIMIT_ORDER': {
          if (boundPlayerId) {
            game.executeCancelLimitOrder(boundPlayerId, data.orderId);
          }
          break;
        }

        case 'CLOSE_POSITION': {
          if (boundPlayerId) {
            // Instant close execution: zero lag
            game.executeImmediateClose(boundPlayerId, data.positionId);
          }
          break;
        }

        case 'BANK_BORROW': {
          if (boundPlayerId) {
            game.executeImmediateBankBorrow(boundPlayerId, data.amount);
          }
          break;
        }

        case 'BANK_REPAY': {
          if (boundPlayerId) {
            game.executeImmediateBankRepay(boundPlayerId, data.amount);
          }
          break;
        }

        case 'SET_RULES': {
          if (boundPlayerId && Array.isArray(data.rules)) {
            const res = game.updatePlayerRules(boundPlayerId, data.rules);
            const myState = game.getPlayerState(boundPlayerId);
            ws.send(JSON.stringify({
              type: 'RULES_UPDATED',
              success: res.success,
              error: res.error,
              count: res.count,
              myState
            }));
          }
          break;
        }

        case 'TOGGLE_RULES':
        case 'TOGGLE_AUTOMATION':
        case 'TOGGLE_STRATEGY': {
          if (boundPlayerId) {
            game.togglePlayerAutomation(boundPlayerId, data.enabled);
            const myState = game.getPlayerState(boundPlayerId);
            ws.send(JSON.stringify({
              type: 'STRATEGY_TOGGLED',
              enabled: data.enabled,
              myState
            }));
          }
          break;
        }

        case 'SET_STRATEGY': {
          if (boundPlayerId) {
            const res = game.setPlayerStrategy(boundPlayerId, data.strategy, data.enabled);
            const myState = game.getPlayerState(boundPlayerId);
            ws.send(JSON.stringify({
              type: 'STRATEGY_SET_RESULT',
              success: res.success,
              error: res.error,
              blockCount: res.blockCount,
              myState
            }));
          }
          break;
        }

        case 'TEST_STRATEGY': {
          if (boundPlayerId) {
            const result = game.testPlayerStrategy(boundPlayerId, data.strategy);
            ws.send(JSON.stringify({
              type: 'STRATEGY_TEST_RESULT',
              result
            }));
          }
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WS message:', err.message);
    }
  });

  ws.on('close', () => {
    if (boundPlayerId) {
      game.removeSocket(boundPlayerId);
    }
  });
});

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, () => {
  const lanIp = getLanIp();
  console.log(`\n======================================================`);
  console.log(`  INTRADAY TRADING ARENA`);
  console.log(`======================================================`);
  console.log(`  Local host:    http://localhost:${PORT}`);
  console.log(`  LAN players:   http://${lanIp}:${PORT}`);
  console.log(`  WebSocket:     ws://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
