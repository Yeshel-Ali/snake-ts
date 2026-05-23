import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { debug } from '../utils/debug';
import { ScoreModel } from '../models/Score';


export type GamePlayer = {
    socketId: string;
    userId?: string;
    username: string;
    display_name?: string;
    isAlive: boolean;
    color?: string;
    connected: boolean;
    score?: number;
}

export type GameRoomState = {
    gameId: string;
    players: GamePlayer[];
    gameState: any;
    currentTurnPlayerSocketId: string | null;
    turnEndsAt?: number | null;
    timeLeft?: number;
    started: boolean;
};

export const games = new Map<string, GameRoomState>();

const parseCookies = (cookieHeader?: string): Record<string, string> => {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, part) => {
        const [key, ...rest] = part.trim().split('=');
        if (!key) return acc;
        acc[key] = decodeURIComponent(rest.join('='));
        return acc;
    }, {} as Record<string, string>);
};

const getUserFromSocket = (socket: Socket): { id?: string; username?: string } | null => {
    const cookies = parseCookies(socket.request.headers.cookie);
    const token = cookies.token;
    if (!token) return null;
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) return null;
        return jwt.verify(token, secret) as { id?: string; username?: string };
    } catch {
        return null;
    }
};

const createRoomState = (gameId: string, players: GamePlayer[] = []): GameRoomState => ({
    gameId,
    players,
    gameState: {},
    currentTurnPlayerSocketId: players[0]?.socketId ?? null,
    turnEndsAt: null,
    timeLeft: undefined,
    started: false,
});

// Walk all rooms to find the one this socket belongs to
const findStateForSocket = (socket: Socket): GameRoomState | undefined => {
    const joined = [...socket.rooms].find(r => r !== socket.id && games.has(r));
    if (joined) return games.get(joined);
    return [...games.values()].find(g => g.players.some(p => p.socketId === socket.id));
};

// Try to match a reconnecting socket to a disconnected player slot
const rebindDisconnectedPlayer = (state: GameRoomState, socket: Socket): GamePlayer | undefined => {
    const disconnected = state.players.filter(p => !p.connected);
    if (!disconnected.length) return undefined;

    const user = getUserFromSocket(socket);

    if (user?.id) {
        const match = disconnected.find(p => p.userId === user.id);
        if (match) { match.socketId = socket.id; match.connected = true; return match; }
    }
    if (user?.username) {
        const match = disconnected.find(p => p.username === user.username);
        if (match) { match.socketId = socket.id; match.connected = true; return match; }
    }
    // Last resort: only one slot disconnected — assume it's them
    if (disconnected.length === 1) {
        disconnected[0].socketId = socket.id;
        disconnected[0].connected = true;
        return disconnected[0];
    }
    return undefined;
};

// Broadcast full room state to everyone in the room
const emitRoomState = (io: Server, state: GameRoomState) => {
    const payload = {
        gameId: state.gameId,
        players: state.players,
        gameState: state.gameState,
        currentTurnPlayerSocketId: state.currentTurnPlayerSocketId,
        started: state.started,
    };
    debug('[game] emit game_state_update to room', state.gameId, '| players:', state.players.length);
    io.to(state.gameId).emit('game_state_update', payload);
};

// Persist game end scores to MongoDB (non-blocking)
const persistToDb = async (state: GameRoomState) => {
    try {
        for (const player of state.players) {
            if (player.userId && player.score) {
                await ScoreModel.updateOne(
                    { userId: player.userId },
                    { $set: { score: player.score, username: player.username, display_name: player.display_name ?? '' } },
                    { upsert: true },
                );
            }
        }
    } catch (err) {
        console.error('[game] persistToDb error:', err);
    }
};


// ─── Public API ───────────────────────────────────────────────────────────────

// Called by lobby.ts when a game starts — sets up the initial room state.
export const initGameState = (
    gameId: string,
    players: Array<{ socketId: string; userId?: string; username: string; color?: string }>,
    dbId?: string,
) => {
    const state = createRoomState(
        gameId,
        players.map(p => ({ ...p, display_name: p.username, isAlive: true, connected: true })),
    );
    games.set(gameId, state);
    debug('[game] initGameState', { gameId, dbId, players: players.length });
    return state;
};

// ─── Socket handlers ──────────────────────────────────────────────────────────

export const registerGameHandlers = ({ io, socket }: { io: Server; socket: Socket }) => {

    // ── game:join ─────────────────────────────────────────────────────────────
    // Fired by the client when it navigates to the game page (including page refresh).
    // Late-join: immediately pushes current state so the player doesn't see a blank screen.
    socket.on('game:join', ({ gameId }: { gameId: string }) => {
        debug('[game] game:join', { gameId, socketId: socket.id });

        const state = games.get(gameId) ?? createRoomState(gameId);
        games.set(gameId, state);

        socket.join(gameId);

        // Reconnect or new join
        let player = state.players.find(p => p.socketId === socket.id);
        if (player) {
            player.connected = true;
            debug('[game] player reconnected', { socketId: socket.id, username: player.username });
        } else {
            player = rebindDisconnectedPlayer(state, socket);
            if (!player) {
                const user = getUserFromSocket(socket);
                player = {
                    socketId: socket.id,
                    userId: user?.id,
                    username: user?.username ?? `Player-${socket.id.slice(0, 4)}`,
                    display_name: user?.username ?? `Player-${socket.id.slice(0, 4)}`,
                    isAlive: true,
                    connected: true,
                };
                state.players.push(player);
                debug('[game] new player added', { socketId: socket.id, username: player.username });
            }
        }

        if (!state.currentTurnPlayerSocketId) {
            state.currentTurnPlayerSocketId = state.players[0]?.socketId ?? null;
        }
        state.started = true;

        // ★ Late-join: send state immediately to THIS socket so a page refresh
        //   doesn't leave the player staring at a blank board.
        socket.emit('game_state_update', {
            gameId: state.gameId,
            players: state.players,
            gameState: state.gameState,
            currentTurnPlayerSocketId: state.currentTurnPlayerSocketId,
            started: state.started,
        });
        debug('[game] late-join state sent to', socket.id);

        // Also broadcast to rest of room so player cards refresh
        emitRoomState(io, state);
    });

    // ── game_action ───────────────────────────────────────────────────────────
    // Single entry point for ALL game moves.
    // Client calls: sendGameAction('YOUR_ACTION_TYPE', { ...payload })
    socket.on('game_action', async (roomId: string | null, actionType: string, payload?: any) => {
        debug('[game] game_action received', { roomId, actionType, payload });
        console.debug('[game] game_action →', actionType, payload);

        const state = (typeof roomId === 'string' && games.has(roomId))
            ? games.get(roomId)!
            : findStateForSocket(socket);

        if (!state) {
            console.warn('[game] game_action: no state found for socket', socket.id, 'roomId:', roomId);
            return;
        }

        switch (actionType) {

            // ── Built-in utility actions ──────────────────────────────────────

            case 'SET_STATE': {
                // Completely replace gameState — useful for testing
                state.gameState = payload ?? {};
                debug('[game] SET_STATE applied');
                break;
            }

            case 'PATCH_STATE': {
                // Shallow-merge a partial update into gameState
                state.gameState = { ...(state.gameState ?? {}), ...(payload ?? {}) };
                debug('[game] PATCH_STATE applied', Object.keys(payload ?? {}));
                break;
            }

            case 'SET_TURN': {
                // Advance turn to a specific player
                state.currentTurnPlayerSocketId = payload?.socketId ?? null;
                state.turnEndsAt = typeof payload?.turnEndsAt === 'number' ? payload.turnEndsAt : null;
                state.timeLeft = typeof payload?.timeLeft === 'number' ? payload.timeLeft : state.timeLeft;
                debug('[game] SET_TURN → ', state.currentTurnPlayerSocketId);
                break;
            }


            default: {
                // Catch-all: stores last action in gameState so the client still gets an update.
                // Remove this once you've added your real cases above.
                debug('[game] unhandled action type:', actionType, '— storing as lastAction');
                state.gameState = {
                    ...(state.gameState ?? {}),
                    lastAction: { actionType, payload, at: Date.now() },
                };
                break;
            }
        }

        // EXAM TODO: Call your win-check function here after every move.
        // Example:
        //   const result = checkWin(state.gameState.board);
        //   if (result.winner) {
        //       state.gameState.winner = result.winner;
        //       const standings = state.players.map((p, i) => ({ ...p, rank: i + 1, score: p.score ?? 0 }));
        //       io.to(state.gameId).emit('game:over', { standings });
        //   }

        // Broadcast updated state to all clients in the room
        emitRoomState(io, state);

        // Persist to MongoDB (non-blocking — don't await on the hot path)
        // markModified is called inside persistToDb so 2D arrays save correctly
        persistToDb(state);
    });

    // ── chat:message ──────────────────────────────────────────────────────────
    socket.on('chat:message', ({ text }: { text: string }) => {
        const state = findStateForSocket(socket);
        if (!state) return;
        const player = state.players.find(p => p.socketId === socket.id);
        if (!player) return;

        const safe = String(text).slice(0, 200);
        debug('[game] chat from', player.username, ':', safe);
        io.to(state.gameId).emit('chat:message', {
            username: player.username,
            color: player.color,
            text: safe,
            timestamp: Date.now(),
        });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        const state = findStateForSocket(socket);
        if (!state) return;
        const player = state.players.find(p => p.socketId === socket.id);
        if (player) {
            player.connected = false;
            debug('[game] player disconnected', { socketId: socket.id, username: player.username });
            emitRoomState(io, state);
        }
    });
};
