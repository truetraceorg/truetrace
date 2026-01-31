import type { Server as SocketIOServer } from "socket.io";

// Use Node.js global object to ensure the instance is shared across all modules
// This is necessary because Next.js API routes may run in different module contexts
declare global {
  // eslint-disable-next-line no-var
  var __socketIOServer: SocketIOServer | undefined;
}

export function setSocketIOServer(io: SocketIOServer) {
  global.__socketIOServer = io;
}

export function getSocketIOServer(): SocketIOServer | null {
  return global.__socketIOServer || null;
}
