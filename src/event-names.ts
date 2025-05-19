import { ClientMetadata, ObjectResponse, ResponseWithStatus } from "./common-types.js";

export enum ClientToServerEventNames {
  DEV_QUERY = 'devquery',
  NAVIGATE = 'navigate',
  NOTIFICATION_COUNT = 'notif-cnt',
  SEND_NOTIFICATION = 'notify-pls',
  STATUS = 'status',
  UNAUTH = 'unauth',
  UPDATE = 'update',
}

export type ClientToServerEvents = {
  [ClientToServerEventNames.DEV_QUERY]: (data: { what: 'status' }, callback: (r: ObjectResponse<{ clients: Record<string, ClientMetadata> }> | ResponseWithStatus) => void) => void;
  [ClientToServerEventNames.NAVIGATE]: (data: { page: string }) => void;
  [ClientToServerEventNames.NOTIFICATION_COUNT]: () => void;
  [ClientToServerEventNames.SEND_NOTIFICATION]: (data: { user: string }) => void;
  [ClientToServerEventNames.STATUS]: () => void;
  [ClientToServerEventNames.UNAUTH]: () => void;
  [ClientToServerEventNames.UPDATE]: (data: unknown) => void;
}

export enum ServerToClientEventNames {
  AUTH = 'auth',
  AUTH_GUEST = 'auth-guest',
  HELLO = 'hello',
  NOTIFICATION_COUNT = 'notif-cnt',
  UPDATE = 'update',
}

export type ServerToClientEvents = {
  [ServerToClientEventNames.AUTH]: (data: ObjectResponse<{ name?: string, clientid: string }>) => void;
  [ServerToClientEventNames.AUTH_GUEST]: (data: ObjectResponse<{ clientid: string }>) => void;
  [ServerToClientEventNames.HELLO]: (data: ObjectResponse<{ priv: string }>) => void;
  [ServerToClientEventNames.NOTIFICATION_COUNT]: (data: ObjectResponse<{ cnt: number }>) => void;
  [ServerToClientEventNames.UPDATE]: (data: unknown) => void;
}
