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
