import { Socket } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "./event-names.js";

export interface ResponseWithStatus {
  success: boolean;
  message?: string;
}

export type ObjectResponse<T> = ResponseWithStatus & T;

export interface UserMetadata {
  id: string;
  role?: string;
  name?: string;
}

export interface SocketMetadata {
  current: boolean;
  rooms: Record<string, boolean>;
  network: string | null;
  connected: Date;
  page: string;
  /** The Origin header of the connection's handshake: which site (old or new front end) the visitor is on */
  origin?: string;
  user: UserMetadata;
}

export interface ClientMetadata extends SocketMetadata {
  connectedSince?: string;
}

export interface InterServerEvents {
  ping: () => void;
}

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketMetadata>;
