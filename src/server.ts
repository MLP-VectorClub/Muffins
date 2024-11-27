import express from 'express';
import { Server } from 'socket.io';
import { createHash } from 'node:crypto';

import config from './config.js';
import log from './log.js';
import moment from './moment-setup.js';
import { ClientToServerEventNames, ClientToServerEvents, ServerToClientEventNames, ServerToClientEvents } from './event-names.js';
import findRealIp from './real-ip.js';
import { authByCookie, authGuest, decodeJson, getGuestID, leaveRoom, sendNotificationCount } from './utils.js';
import { Database } from './database.js';
import { AppSocket, ClientMetadata, InterServerEvents, SocketMetadata } from './common-types.js';
import { createServer } from 'http';

process.title = 'Muffins';

let app = express();

app.get('/', (req, res) => {
  res.sendStatus(403);
});

const server = createServer(app);
server.listen(config.PORT, config.HOST);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketMetadata>(server, {
  cors: {
    origin: config.ORIGIN_REGEX,
    methods: ['GET'],
    credentials: true,
  },
  allowRequest: (req, callback) => {
    const origin = req.headers.origin || '';
    if (!config.ORIGIN_REGEX.test(origin))
      return callback('origin not allowed', false);
    callback(null, true);
  },
});
log(`[Socket.io] Server listening on https://${config.HOST}:${config.PORT}`);

Database.connect(err => {
  if (err !== null) {
    log(`[Database] Connection failed, exiting (${err})`);
    return process.exit();
  }

  log('[Database] Connection successful');
});
Database.on('error', err => {
  console.log(err);
  if ('fatal' in err) process.exit();
});

const SocketMap: Record<string, AppSocket> = {};

io.on('connection', async socket => {
  socket.data.user = { id: getGuestID(socket) };
  //log('> Incoming connection');
  let isGuest = () => typeof socket.data.user?.role === 'undefined',
    userLog = (msg: string) => {
      log(`[${socket.data.user?.id};${socket.id}] ${msg}`);
    };
  socket.data.rooms = {};
  const clientRealIp = await findRealIp(socket);
  socket.data.network = clientRealIp
    ? createHash('md5').update(config.WS_SERVER_KEY).update(clientRealIp).digest().toString('base64url')
    : null;
  socket.data.connected = moment();
  SocketMap[socket.id] = socket;

  authByCookie(socket, userLog);

  socket.on(ClientToServerEventNames.NAVIGATE, ({ page }) => {
    socket.data.page = page;
  });

  socket.on(ClientToServerEventNames.SEND_NOTIFICATION, data => {
    if (socket.data.user?.role !== 'server')
      return { success: false };

    userLog(`> Sent notification count to ${data.user}`);

    data = decodeJson(data);
    sendNotificationCount(socket.in(data.user), data.user);
  });

  socket.on(ClientToServerEventNames.NOTIFICATION_COUNT, () => {
    const userId = socket.data.user?.id;
    if (userId) {
      sendNotificationCount(socket, userId);
    }
  });

  socket.on(ClientToServerEventNames.UNAUTH, () => {
    if (isGuest())
      return { success: false };

    let oldId = socket.data.user?.id;
    socket.data.user = { id: getGuestID(socket) };
    if (oldId)
      leaveRoom(socket, oldId);
    userLog(`> Unauthenticated (was ${oldId})`);
    authGuest(socket);
    return { success: true };
  });

  socket.on(ClientToServerEventNames.DEV_QUERY, async (params, fn) => {
    if (socket.data.user?.role !== 'developer')
      return { success: false };

    params = decodeJson(params);

    switch (params.what) {
      case 'status':
        const sockets = await io.fetchSockets();
        const clients = sockets.reduce((data: Record<string, ClientMetadata>, connectedSocket) => ({
          ...data,
          [connectedSocket.id]: {
            current: connectedSocket.id === socket.id,
            network: connectedSocket.data.network,
            connected: connectedSocket.data.connected,
            page: connectedSocket.data.page,
            user: {
              id: connectedSocket.data.user.id,
              role: connectedSocket.data.user.role,
              name: connectedSocket.data.user.name,
            },
            rooms: connectedSocket.data.rooms,
            connectedSince: connectedSocket.data.connected ? connectedSocket.data.connected.fromNow() : undefined,
          },
        }), {});
        fn({ success: true, clients });
        break;
      default:
        fn({ success: false, message: `Unknown type ${params.what}` });
    }
  });

  socket.on(ClientToServerEventNames.UPDATE, params => {
    if (socket.data.user?.role !== 'server')
      return { success: false };

    io.emit(ServerToClientEventNames.UPDATE, params);
  });

  socket.on('disconnect', () => {
    delete SocketMap[socket.id];

    if (isGuest() || socket.data.user?.role !== 'server')
      return;

    userLog('> Disconnected');
  });
});
