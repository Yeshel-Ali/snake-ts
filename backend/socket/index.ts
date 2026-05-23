import type { Server } from 'socket.io';
import { registerGameHandlers } from './game';

export const registerSocketHandlers = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('[io] Client connected');
    registerGameHandlers({ io, socket });
    socket.on('disconnect', () => console.log('[io] Client disconnected'));
  });
};
