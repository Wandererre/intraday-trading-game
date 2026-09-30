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

class RoomManager {
  constructor(wss) {
    this.wss = wss;
    this.rooms = new Map(); // roomCode (uppercase) -> GameManager
  }

  getOrCreateRoom(roomCode = 'ARENA-BTC') {
    const code = (roomCode || 'ARENA-BTC').trim().toUpperCase().slice(0, 16);
    if (!this.rooms.has(code)) {
      const roomGame = new GameManager((data) => this.broadcastToRoom(code, data), code);
      this.rooms.set(code, roomGame);
      console.log(`[RoomManager] Created room: ${code}`);
    }
    return this.rooms.get(code);
  }

  getRoom(roomCode) {
    if (!roomCode) return null;
    return this.rooms.get(roomCode.trim().toUpperCase());
  }

  deleteRoom(roomCode) {
    const code = (roomCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (room) {
      room.destroy();
      this.rooms.delete(code);
      console.log(`[RoomManager] Deleted room: ${code}. Active rooms remaining: ${this.rooms.size}`);
    }
  }

  broadcastToRoom(roomCode, data) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const json = JSON.stringify(data);
    for (const ws of room.clientSockets.values()) {
      if (ws.readyState === 1) {
        ws.send(json);
      }
    }
  }
}

const roomManager = new RoomManager(wss);

function isAuthorizedHost(boundPlayerId, game) {
  if (!boundPlayerId || !game) return false;
  if (game.hostPlayerId && game.hostPlayerId === boundPlayerId) return true;
  const hostSocket = game.hostPlayerId ? game.clientSockets.get(game.hostPlayerId) : null;
  const isHostConnected = hostSocket && hostSocket.readyState === 1;
  if (!game.hostPlayerId || !game.players.has(game.hostPlayerId) || !isHostConnected) {
    game.hostPlayerId = boundPlayerId;
    return true;
  }
  const firstPlayer = game.players.values().next().value;
  if (firstPlayer && firstPlayer.id === boundPlayerId) {
    game.hostPlayerId = boundPlayerId;
    return true;
  }
  return false;
}

function generateRoomCode() {
  const words = ['BULL', 'BEAR', 'MOON', 'APEX', 'NOVA', 'PUMP', 'WAVE', 'SWAP'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${word}-${num}`;
}

wss.on('connection', (ws) => {
  let boundRoomCode = null;
  let boundPlayerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'CREATE_ROOM') {
        const rawCode = data.roomCode || generateRoomCode();
        let roomCode = rawCode.trim().toUpperCase().slice(0, 16);
        while (roomManager.rooms.has(roomCode)) {
          roomCode = generateRoomCode();
        }
        const nickname = (data.nickname || 'Trader_' + Math.floor(Math.random() * 1000)).trim().slice(0, 16);
        const socketId = 'sock_' + Math.random().toString(36).substring(2, 9);

        // Leave any previous room on this socket
        if (boundRoomCode && boundPlayerId) {
          const prevRoom = roomManager.getRoom(boundRoomCode);
          if (prevRoom) {
            if (prevRoom.hostPlayerId === boundPlayerId) {
              prevRoom.broadcast({ type: 'ROOM_CLOSED', roomCode: boundRoomCode, message: 'Host left the room. Room closed.' });
              roomManager.deleteRoom(boundRoomCode);
            } else {
              prevRoom.handlePlayerDisconnect(boundPlayerId);
              if (prevRoom.getActiveSocketCount() === 0) roomManager.deleteRoom(boundRoomCode);
            }
          }
        }

        const game = roomManager.getOrCreateRoom(roomCode);
        boundRoomCode = roomCode;
        boundPlayerId = game.addOrReconnectPlayer(socketId, nickname, ws);
        game.hostPlayerId = boundPlayerId; // Creator is ALWAYS host

        ws.send(JSON.stringify({
          type: 'JOINED',
          playerId: boundPlayerId,
          nickname,
          roomCode,
          isHost: true
        }));
        return;
      }

      if (data.type === 'JOIN_ROOM' || data.type === 'JOIN') {
        const rawCode = data.roomCode || 'ARENA-BTC';
        const roomCode = rawCode.trim().toUpperCase().slice(0, 16);
        const nickname = (data.nickname || 'Trader_' + Math.floor(Math.random() * 1000)).trim().slice(0, 16);
        const socketId = 'sock_' + Math.random().toString(36).substring(2, 9);

        let game = roomManager.getRoom(roomCode);
        if (!game) {
          if (roomCode === 'ARENA-BTC') {
            game = roomManager.getOrCreateRoom(roomCode);
          } else {
            ws.send(JSON.stringify({
              type: 'ROOM_NOT_FOUND',
              roomCode,
              message: `Room "${roomCode}" was not found or has been closed by the host.`
            }));
            return;
          }
        }

        // Leave any previous room on this socket
        if (boundRoomCode && boundPlayerId && boundRoomCode !== roomCode) {
          const prevRoom = roomManager.getRoom(boundRoomCode);
          if (prevRoom) {
            if (prevRoom.hostPlayerId === boundPlayerId) {
              prevRoom.broadcast({ type: 'ROOM_CLOSED', roomCode: boundRoomCode, message: 'Host left the room. Room closed.' });
              roomManager.deleteRoom(boundRoomCode);
            } else {
              prevRoom.handlePlayerDisconnect(boundPlayerId);
              if (prevRoom.getActiveSocketCount() === 0) roomManager.deleteRoom(boundRoomCode);
            }
          }
        }

        boundRoomCode = roomCode;
        boundPlayerId = game.addOrReconnectPlayer(socketId, nickname, ws);

        ws.send(JSON.stringify({
          type: 'JOINED',
          playerId: boundPlayerId,
          nickname,
          roomCode,
          isHost: boundPlayerId === game.hostPlayerId
        }));
        return;
      }

      if (data.type === 'LEAVE_ROOM') {
        if (boundRoomCode && boundPlayerId) {
          const game = roomManager.getRoom(boundRoomCode);
          if (game) {
            if (game.hostPlayerId === boundPlayerId) {
              console.log(`[Host Left] Host ${boundPlayerId} left room ${boundRoomCode}. Deleting room.`);
              game.broadcast({
                type: 'ROOM_CLOSED',
                roomCode: boundRoomCode,
                message: 'Host closed the room. Returning to main menu...'
              });
              roomManager.deleteRoom(boundRoomCode);
            } else {
              game.removePlayer(boundPlayerId);
              if (game.getActiveSocketCount() === 0) {
                roomManager.deleteRoom(boundRoomCode);
              }
            }
          }
          ws.send(JSON.stringify({ type: 'LEFT_ROOM' }));
          boundRoomCode = null;
          boundPlayerId = null;
        }
        return;
      }

      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }

      const game = boundRoomCode ? roomManager.getRoom(boundRoomCode) : null;
      if (!game) return;

      switch (data.type) {
        case 'HOST_CONFIG': {
          if (isAuthorizedHost(boundPlayerId, game)) {
            game.updateConfig(data.config);
          }
          break;
        }

        case 'HOST_START_GAME': {
          if (isAuthorizedHost(boundPlayerId, game)) {
            game.startGame();
          }
          break;
        }

        case 'HOST_NEXT_ROUND': {
          if (isAuthorizedHost(boundPlayerId, game)) {
            game.forceNextRound();
          }
          break;
        }

        case 'HOST_RESTART_GAME': {
          if (isAuthorizedHost(boundPlayerId, game)) {
            game.restartGame();
          }
          break;
        }

        case 'HOST_END_GAME': {
          if (isAuthorizedHost(boundPlayerId, game)) {
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

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WS message:', err.message);
    }
  });

  ws.on('close', () => {
    if (boundRoomCode && boundPlayerId) {
      const game = roomManager.getRoom(boundRoomCode);
      if (game) {
        if (game.hostPlayerId === boundPlayerId) {
          console.log(`[Host Disconnected] Host ${boundPlayerId} disconnected/refreshed in room ${boundRoomCode}. Deleting room and kicking all players.`);
          game.broadcast({
            type: 'ROOM_CLOSED',
            roomCode: boundRoomCode,
            message: 'Host left or refreshed. The room has been deleted.'
          });
          roomManager.deleteRoom(boundRoomCode);
        } else {
          game.handlePlayerDisconnect(boundPlayerId);
          if (game.getActiveSocketCount() === 0) {
            roomManager.deleteRoom(boundRoomCode);
          }
        }
      }
      boundRoomCode = null;
      boundPlayerId = null;
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
