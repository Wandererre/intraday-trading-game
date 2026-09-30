import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { GameManager } from '../server/game.js';

class RoomManager {
  constructor(wss) {
    this.wss = wss;
    this.rooms = new Map();
  }

  getOrCreateRoom(roomCode) {
    const code = (roomCode || 'ARENA-BTC').trim().toUpperCase();
    if (!this.rooms.has(code)) {
      this.rooms.set(code, new GameManager(this.wss, code));
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
    }
  }
}

async function runTest() {
  console.log('[Test] Running real-time disconnect & room deletion verification...');
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const roomManager = new RoomManager(wss);

  wss.on('connection', (ws) => {
    let boundRoomCode = null;
    let boundPlayerId = null;

    ws.on('message', (message) => {
      const data = JSON.parse(message.toString());
      if (data.type === 'JOIN') {
        const roomCode = (data.roomCode || 'ARENA-BTC').trim().toUpperCase();
        const nickname = data.nickname;
        const socketId = 'sock_' + Math.random().toString(36).substring(2, 9);
        const game = roomManager.getOrCreateRoom(roomCode);
        boundRoomCode = roomCode;
        boundPlayerId = game.addOrReconnectPlayer(socketId, nickname, ws);
        ws.send(JSON.stringify({ type: 'JOINED', playerId: boundPlayerId, nickname, roomCode }));
      } else if (data.type === 'LEAVE_ROOM') {
        if (boundRoomCode && boundPlayerId) {
          const game = roomManager.getRoom(boundRoomCode);
          if (game) {
            game.removePlayer(boundPlayerId);
            if (game.getActiveSocketCount() === 0) {
              roomManager.deleteRoom(boundRoomCode);
            }
          }
          ws.send(JSON.stringify({ type: 'LEFT_ROOM' }));
          boundRoomCode = null;
          boundPlayerId = null;
        }
      }
    });

    ws.on('close', () => {
      if (boundRoomCode && boundPlayerId) {
        const game = roomManager.getRoom(boundRoomCode);
        if (game) {
          game.handlePlayerDisconnect(boundPlayerId);
          if (game.getActiveSocketCount() === 0) {
            roomManager.deleteRoom(boundRoomCode);
          }
        }
        boundRoomCode = null;
        boundPlayerId = null;
      }
    });
  });

  await new Promise(r => server.listen(4001, r));

  const p1 = new WebSocket('ws://localhost:4001');
  await new Promise(r => p1.on('open', r));

  let p1Players = [];
  p1.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.type === 'GAME_STATE') {
      p1Players = data.game.players;
    }
  });

  // P1 joins ROOM-ALPHA
  p1.send(JSON.stringify({ type: 'JOIN', nickname: 'Alice', roomCode: 'ROOM-ALPHA' }));
  await new Promise(r => setTimeout(r, 80));
  if (p1Players.length !== 1 || p1Players[0].nickname !== 'Alice') {
    throw new Error(`Expected 1 player Alice, got: ${JSON.stringify(p1Players)}`);
  }
  console.log('✓ Alice successfully in ROOM-ALPHA');

  // P2 joins ROOM-ALPHA
  const p2 = new WebSocket('ws://localhost:4001');
  await new Promise(r => p2.on('open', r));
  p2.send(JSON.stringify({ type: 'JOIN', nickname: 'Bob', roomCode: 'ROOM-ALPHA' }));
  await new Promise(r => setTimeout(r, 80));
  if (p1Players.length !== 2) {
    throw new Error(`Expected 2 players (Alice, Bob), got: ${JSON.stringify(p1Players)}`);
  }
  console.log('✓ Bob successfully joined, Alice sees 2 players');

  // P2 closes tab/socket: Ghost check
  p2.close();
  await new Promise(r => setTimeout(r, 80));
  if (p1Players.length !== 1 || p1Players[0].nickname !== 'Alice') {
    throw new Error(`Ghost player detected! Alice sees: ${JSON.stringify(p1Players)}`);
  }
  console.log('✓ Ghost player prevented! Bob removed immediately from lobby when tab closed');

  // P1 leaves room: Room deletion check
  p1.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
  await new Promise(r => setTimeout(r, 80));
  if (roomManager.getRoom('ROOM-ALPHA')) {
    throw new Error('Expected ROOM-ALPHA to be deleted after last player left!');
  }
  console.log('✓ Empty room ROOM-ALPHA deleted from memory on LEAVE_ROOM');

  // P3 creates ROOM-BETA then abruptly closes tab
  const p3 = new WebSocket('ws://localhost:4001');
  await new Promise(r => p3.on('open', r));
  p3.send(JSON.stringify({ type: 'JOIN', nickname: 'Charlie', roomCode: 'ROOM-BETA' }));
  await new Promise(r => setTimeout(r, 80));
  if (!roomManager.getRoom('ROOM-BETA')) {
    throw new Error('ROOM-BETA should exist while Charlie is connected');
  }
  p3.close();
  await new Promise(r => setTimeout(r, 80));
  if (roomManager.getRoom('ROOM-BETA')) {
    throw new Error('Expected ROOM-BETA to be deleted after Charlie closed tab!');
  }
  console.log('✓ Abrupt tab closure deleted empty room ROOM-BETA cleanly');

  p1.close();
  server.close();
  console.log('ALL DISCONNECT & ROOM LIFECYCLE TESTS PASSED!');
}

runTest().catch((err) => {
  console.error('[Test Failed]:', err);
  process.exit(1);
});
