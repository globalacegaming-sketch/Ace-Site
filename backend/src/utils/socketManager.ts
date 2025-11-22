import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export const setSocketServerInstance = (io: Server): void => {
  ioInstance = io;
};

export const getSocketServerInstance = (): Server => {
  if (!ioInstance) {
    throw new Error('Socket.io server instance has not been initialized');
  }

  return ioInstance;
};

