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
      this.rooms.set(code, new GameManager((data) => this.broadcastToRoom(code, data), code));
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

async function runTest() {
  console.log('[Test] Running real-time host disconnect & room deletion verification...');
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const roomManager = new RoomManager(wss);

  wss.on('connection', (ws) => {
    let boundRoomCode = null;
    let boundPlayerId = null;

    ws.on('message', (message) => {
      const data = JSON.parse(message.toString());

      if (data.type === 'CREATE_ROOM') {
        const roomCode = data.roomCode.trim().toUpperCase();
        const nickname = data.nickname;
        const socketId = 'sock_' + Math.random().toString(36).substring(2, 9);
        const game = roomManager.getOrCreateRoom(roomCode);
        boundRoomCode = roomCode;
        boundPlayerId = game.addOrReconnectPlayer(socketId, nickname, ws);
        game.hostPlayerId = boundPlayerId; // Host!
        ws.send(JSON.stringify({ type: 'JOINED', playerId: boundPlayerId, nickname, roomCode, isHost: true }));
      } else if (data.type === 'JOIN_ROOM') {
        const roomCode = data.roomCode.trim().toUpperCase();
        const game = roomManager.getRoom(roomCode);
        if (!game) {
          ws.send(JSON.stringify({ type: 'ROOM_NOT_FOUND', roomCode, message: 'Room not found.' }));
          return;
        }
        const nickname = data.nickname;
        const socketId = 'sock_' + Math.random().toString(36).substring(2, 9);
        boundRoomCode = roomCode;
        boundPlayerId = game.addOrReconnectPlayer(socketId, nickname, ws);
        ws.send(JSON.stringify({ type: 'JOINED', playerId: boundPlayerId, nickname, roomCode, isHost: false }));
      } else if (data.type === 'LEAVE_ROOM') {
        if (boundRoomCode && boundPlayerId) {
          const game = roomManager.getRoom(boundRoomCode);
          if (game) {
            if (game.hostPlayerId === boundPlayerId) {
              game.broadcast({ type: 'ROOM_CLOSED', roomCode: boundRoomCode, message: 'Host left the room. Room closed.' });
              roomManager.deleteRoom(boundRoomCode);
            } else {
              game.removePlayer(boundPlayerId);
              if (game.getActiveSocketCount() === 0) roomManager.deleteRoom(boundRoomCode);
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
          if (game.hostPlayerId === boundPlayerId) {
            game.broadcast({ type: 'ROOM_CLOSED', roomCode: boundRoomCode, message: 'Host left or refreshed. Room closed.' });
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

  await new Promise(r => server.listen(4005, r));

  // 1. Host creates room
  const host = new WebSocket('ws://localhost:4005');
  await new Promise(r => host.on('open', r));
  host.send(JSON.stringify({ type: 'CREATE_ROOM', nickname: 'Alice', roomCode: 'ROOM-HOST' }));
  await new Promise(r => setTimeout(r, 60));

  // 2. Guest joins room
  const guest = new WebSocket('ws://localhost:4005');
  await new Promise(r => guest.on('open', r));
  let guestReceivedRoomClosed = false;
  guest.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.type === 'ROOM_CLOSED') {
      guestReceivedRoomClosed = true;
    }
  });

  guest.send(JSON.stringify({ type: 'JOIN_ROOM', nickname: 'Bob', roomCode: 'ROOM-HOST' }));
  await new Promise(r => setTimeout(r, 60));

  // 3. Host refreshes (closes socket)
  host.close();
  await new Promise(r => setTimeout(r, 100));

  // Verify guest got ROOM_CLOSED packet
  if (!guestReceivedRoomClosed) {
    throw new Error('Guest did not receive ROOM_CLOSED when host disconnected/refreshed!');
  }
  console.log('✓ Guest immediately kicked with ROOM_CLOSED when host closed tab/refreshed');

  // Verify room was deleted from server
  if (roomManager.getRoom('ROOM-HOST')) {
    throw new Error('ROOM-HOST was not deleted when host disconnected!');
  }
  console.log('✓ ROOM-HOST automatically deleted from server memory when host refreshed');

  // 4. Try to join deleted room -> ROOM_NOT_FOUND
  const stranger = new WebSocket('ws://localhost:4005');
  await new Promise(r => stranger.on('open', r));
  let strangerGotNotFound = false;
  stranger.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.type === 'ROOM_NOT_FOUND') {
      strangerGotNotFound = true;
    }
  });
  stranger.send(JSON.stringify({ type: 'JOIN_ROOM', nickname: 'Charlie', roomCode: 'ROOM-HOST' }));
  await new Promise(r => setTimeout(r, 60));

  if (!strangerGotNotFound) {
    throw new Error('Stranger should receive ROOM_NOT_FOUND when joining deleted room');
  }
  console.log('✓ Joining deleted room correctly returns ROOM_NOT_FOUND');

  // 5. Test Non-host (guest) disconnect: Room stays alive for host
  const host2 = new WebSocket('ws://localhost:4005');
  await new Promise(r => host2.on('open', r));
  host2.send(JSON.stringify({ type: 'CREATE_ROOM', nickname: 'Alice2', roomCode: 'ROOM-GUEST-TEST' }));
  await new Promise(r => setTimeout(r, 60));

  let host2Players = [];
  host2.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.type === 'GAME_STATE') host2Players = data.game.players;
  });

  const guest2 = new WebSocket('ws://localhost:4005');
  await new Promise(r => guest2.on('open', r));
  guest2.send(JSON.stringify({ type: 'JOIN_ROOM', nickname: 'Bob2', roomCode: 'ROOM-GUEST-TEST' }));
  await new Promise(r => setTimeout(r, 60));

  // Guest leaves/refreshes
  guest2.close();
  await new Promise(r => setTimeout(r, 80));

  if (host2Players.length !== 1 || host2Players[0].nickname !== 'Alice2') {
    throw new Error(`Expected only Alice2 remaining, got: ${JSON.stringify(host2Players)}`);
  }
  if (!roomManager.getRoom('ROOM-GUEST-TEST')) {
    throw new Error('ROOM-GUEST-TEST should remain open when non-host guest leaves!');
  }
  console.log('✓ Non-host leaving removes player immediately without deleting room for host');

  guest.close();
  stranger.close();
  host2.close();
  server.close();
  console.log('ALL STANDARD MULTIPLAYER ROOM LIFECYCLE TESTS PASSED!');
}

runTest().catch((err) => {
  console.error('[Test Failed]:', err);
  process.exit(1);
});
