import { Socket } from "socket.io";
import { ClientToServerEvents, ServerToClientEventNames, ServerToClientEvents } from "./event-names.js";
import { QueryResult, QueryResultRow } from 'pg';
import { Database } from "./database.js";
import { AppSocket, UserMetadata } from "./common-types.js";
import config from "./config.js";
import createHash from "sha.js";

const sha256hash = (data: string) => createHash('sha256').update(data, 'utf8').digest('hex');

export const handleQuery = <ResultType extends QueryResultRow>(f: (results: QueryResult<ResultType>['rows']) => void) =>
  (err: Error, result: QueryResult<ResultType>) => {
    if (err) {
      return console.error('error running query', err);
    }
    f(result.rows);
  };

export const decodeJson = <T extends object>(data: string | T): T => typeof data === 'string' ? JSON.parse(data) : data;

export const findAuthCookie = (socket: Socket) => {
  if (!socket.handshake.headers.cookie || !socket.handshake.headers.cookie.length)
    return;
  let cookieArray = socket.handshake.headers.cookie.split('; '),
    cookies: Record<string, string> = {};
  for (let i = 0; i < cookieArray.length; i++) {
    let split = cookieArray[i].split('=');
    cookies[split[0]] = split[1];
  }
  return cookies.access;
};
export const getGuestID = (socket: Socket) => `Guest#${socket.id}`;

export function sendNotificationCount(socket: Pick<Socket<ClientToServerEvents, ServerToClientEvents>, 'emit'>, userId: string) {
  Database.query('SELECT COUNT(*) as cnt FROM notifications WHERE recipient_id = $1 AND read_at IS NULL', [userId], handleQuery<{ cnt: string }>(result => {
    if (typeof result[0] !== 'object')
      return;

    socket.emit(ServerToClientEventNames.NOTIFICATION_COUNT, { success: true, cnt: parseInt(result[0].cnt, 10) });
  }));
}

export function authGuest(socket: AppSocket) {
  socket.emit(ServerToClientEventNames.AUTH_GUEST, { success: true, clientid: socket.id });
}

export function joinRoom(socket: AppSocket, room: string) {
  socket.join(room);
  if (socket.data.rooms) {
    socket.data.rooms[room] = true;
  }
}

export function leaveRoom(socket: AppSocket, room: string) {
  socket.leave(room);
  if (socket.data.rooms) {
    delete socket.data.rooms[room];
  }
}

export function authByCookie(socket: AppSocket, userLog: (str: string) => void) {
  let access = findAuthCookie(socket);
  if (access === config.WS_SERVER_KEY) {
    socket.data.user = { id: 'Web Server', role: 'server' };
    userLog('> Authenticated');
  } else if (typeof access === 'string' && access.length) {
    let token = sha256hash(access);
    Database.query('SELECT u.* FROM users u LEFT JOIN sessions s ON s.user_id = u.id WHERE s.token = $1', [token], handleQuery<UserMetadata>(result => {
      if (typeof result[0] !== 'object') {
        authGuest(socket);
        return;
      }

      socket.data.user = result[0];

      joinRoom(socket, socket.data.user.id);
      socket.emit(ServerToClientEventNames.AUTH, { success: true, name: socket.data.user.name, clientid: socket.id });
      sendNotificationCount(socket, socket.data.user.id);
    }));
  } else authGuest(socket);
}

/**
 * Luna's front end gives its visitors a one time token (POST /users/me/socket-token) and sends it when it connects; Luna says who it belongs to.
 * A socket without a valid token stays a guest, like a missing or expired cookie of Winterchilla
 */
export async function authByLunaToken(socket: AppSocket, token: string, userLog: (str: string) => void) {
  if (!config.LUNA_URL) {
    userLog('> A token was sent but LUNA_URL is not set');
    return authGuest(socket);
  }

  try {
    const response = await fetch(`${config.LUNA_URL}/internal/websocket/validate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.WS_SERVER_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      userLog(`> Luna did not accept the token (${response.status})`);
      return authGuest(socket);
    }

    const user = await response.json() as { id: number | string; name: string; role: string };
    const id = String(user.id);
    // The socket may have gone away, or identified itself some other way, while Luna was asked
    if (socket.disconnected)
      return;

    socket.data.user = { id, name: user.name, role: user.role };
    joinRoom(socket, id);
    userLog(`> Authenticated by token as ${user.name}`);
    socket.emit(ServerToClientEventNames.AUTH, { success: true, name: user.name, clientid: socket.id });
    sendNotificationCount(socket, id);
  } catch (e) {
    userLog(`> Could not check the token with Luna (${e})`);
    authGuest(socket);
  }
}
