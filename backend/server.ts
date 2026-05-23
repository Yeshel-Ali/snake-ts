import 'dotenv/config';

import app from './app';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import leaderboardRoutes from './routes/leaderboard';
import { registerSocketHandlers } from './socket';

app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

const httpServer = createServer(app);
const PORT = Number(process.env.PORT) || 3001;

const clientUrls = (process.env.CLIENT_URL ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (clientUrls.length === 0) {
  throw new Error('CLIENT_URL is not set');
}

const io = new Server(httpServer, {
  cors: {
    origin: clientUrls,
    credentials: true,
  },
});

registerSocketHandlers(io);

io.engine.on('connection_error', (err) => {
  console.log('[socket] connection_error', {
    code: err.code,
    message: err.message,
    origin: err.req?.headers?.origin,
  });
});

const start = async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`[server] HTTP + WS on http://localhost:${PORT}`);
  });
};

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
