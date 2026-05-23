import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/axios';
import { socket } from '../api/socket';
import '../assets/snake.css';

type User = { username: string; display_name: string; score: number };
type Coord = { x: number; y: number };
type Phase = 'code-entry' | 'waiting' | 'playing' | 'over';

const BOARD_SIZE = 15;
const TICK_MS = 120;

const P1_SNAKE: Coord[] = [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }];
const P2_SNAKE: Coord[] = [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 13, y: 11 }];
const P1_DIR: Coord = { x: 1, y: 0 };
const P2_DIR: Coord = { x: -1, y: 0 };

const KEY_TO_DIR: Record<string, Coord> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

const toKey = (p: Coord) => `${p.x},${p.y}`;

const spawnFood = (occupied: Coord[]): Coord => {
  const occupiedSet = new Set(occupied.map(toKey));
  const open: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (!occupiedSet.has(`${x},${y}`)) open.push({ x, y });
    }
  }
  return open.length ? open[Math.floor(Math.random() * open.length)] : { x: 7, y: 7 };
};

const generateCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const Multiplayer = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('code-entry');
  const [codeInput, setCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [opponentUsername, setOpponentUsername] = useState('');

  const [mySnake, setMySnake] = useState<Coord[]>([]);
  const [opponentSnake, setOpponentSnake] = useState<Coord[]>([]);
  const [food, setFood] = useState<Coord>({ x: 7, y: 7 });
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [iAmDead, setIAmDead] = useState(false);
  const [opponentDead, setOpponentDead] = useState(false);

  const phaseRef = useRef<Phase>('code-entry');
  const mySnakeRef = useRef<Coord[]>([]);
  const opponentSnakeRef = useRef<Coord[]>([]);
  const foodRef = useRef<Coord>({ x: 7, y: 7 });
  const dirRef = useRef<Coord>(P1_DIR);
  const pendingDirRef = useRef<Coord>(P1_DIR);
  const socketIdRef = useRef('');
  const roomCodeRef = useRef('');
  const iAmDeadRef = useRef(false);
  const opponentDeadRef = useRef(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { iAmDeadRef.current = iAmDead; }, [iAmDead]);
  useEffect(() => { opponentDeadRef.current = opponentDead; }, [opponentDead]);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        const { data } = await api.get<User>('/auth/me');
        if (mounted) setUser(data);
      } catch {
        if (mounted) navigate('/login');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    if (isAuthenticated) fetchUser();
    return () => { mounted = false; };
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    socket.connect();

    const onConnect = () => {
      socketIdRef.current = socket.id ?? '';
    };
    socket.on('connect', onConnect);

    socket.on('game_state_update', (state: any) => {
      const players: any[] = state.players ?? [];
      const gs = state.gameState ?? {};
      const myId = socketIdRef.current;
      const opponent = players.find((p) => p.socketId !== myId);

      if (opponent) {
        setOpponentUsername(opponent.display_name || opponent.username);

        const oppSnake: Coord[] = gs[`snake_${opponent.socketId}`];
        if (Array.isArray(oppSnake) && oppSnake.length > 0) {
          const prevLen = opponentSnakeRef.current.length;
          if (prevLen > 0 && oppSnake.length > prevLen) {
            setOpponentScore((s) => s + 1);
          }
          setOpponentSnake(oppSnake);
          opponentSnakeRef.current = oppSnake;
        }

        if (gs[`dead_${opponent.socketId}`] === true && !opponentDeadRef.current) {
          opponentDeadRef.current = true;
          setOpponentDead(true);
          phaseRef.current = 'over';
          setPhase('over');
        }
      }

      if (gs.food) {
        foodRef.current = gs.food;
        setFood(gs.food);
      }

      if (phaseRef.current === 'waiting' && players.length >= 2) {
        const idx = players.findIndex((p) => p.socketId === myId);
        const initialSnake = idx === 0 ? P1_SNAKE : P2_SNAKE;
        const initialDir = idx === 0 ? P1_DIR : P2_DIR;
        const initialOppSnake = idx === 0 ? P2_SNAKE : P1_SNAKE;
        const initialFood: Coord = gs.food ?? spawnFood([...P1_SNAKE, ...P2_SNAKE]);

        mySnakeRef.current = initialSnake;
        opponentSnakeRef.current = initialOppSnake;
        foodRef.current = initialFood;
        dirRef.current = initialDir;
        pendingDirRef.current = initialDir;

        setMySnake(initialSnake);
        setOpponentSnake(initialOppSnake);
        setFood(initialFood);

        if (idx === 0) {
          socket.emit('game_action', roomCodeRef.current, 'PATCH_STATE', { food: initialFood });
        }

        phaseRef.current = 'playing';
        setPhase('playing');
      }
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('game_state_update');
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'playing' || iAmDead) return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const next = KEY_TO_DIR[key];
      if (!next) return;
      const cur = dirRef.current;
      if (cur.x + next.x === 0 && cur.y + next.y === 0) return;
      pendingDirRef.current = next;
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, iAmDead]);

  useEffect(() => {
    if (phase !== 'playing' || iAmDead || opponentDead) return;

    const id = setInterval(() => {
      const prev = mySnakeRef.current;
      const dir = pendingDirRef.current;
      dirRef.current = dir;
      const head = prev[0];
      if (!head) return;

      const nextHead = { x: head.x + dir.x, y: head.y + dir.y };

      const hitWall =
        nextHead.x < 0 || nextHead.x >= BOARD_SIZE || nextHead.y < 0 || nextHead.y >= BOARD_SIZE;
      const hitSelf = prev.slice(0, -1).some((p) => p.x === nextHead.x && p.y === nextHead.y);
      const hitOpponent = opponentSnakeRef.current.some(
        (p) => p.x === nextHead.x && p.y === nextHead.y,
      );

      if (hitWall || hitSelf || hitOpponent) {
        iAmDeadRef.current = true;
        setIAmDead(true);
        phaseRef.current = 'over';
        setPhase('over');
        socket.emit('game_action', roomCodeRef.current, 'PATCH_STATE', {
          [`dead_${socketIdRef.current}`]: true,
        });
        return;
      }

      const ate = nextHead.x === foodRef.current.x && nextHead.y === foodRef.current.y;
      const nextSnake = ate ? [nextHead, ...prev] : [nextHead, ...prev.slice(0, -1)];

      const patch: Record<string, unknown> = { [`snake_${socketIdRef.current}`]: nextSnake };
      if (ate) {
        setMyScore((s) => s + 1);
        const newFood = spawnFood([...nextSnake, ...opponentSnakeRef.current]);
        foodRef.current = newFood;
        setFood(newFood);
        patch.food = newFood;
      }

      socket.emit('game_action', roomCodeRef.current, 'PATCH_STATE', patch);
      mySnakeRef.current = nextSnake;
      setMySnake(nextSnake);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [phase, iAmDead, opponentDead]);

  const handleJoin = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    roomCodeRef.current = trimmed;
    setRoomCode(trimmed);
    phaseRef.current = 'waiting';
    setPhase('waiting');
    socket.emit('game:join', { gameId: trimmed });
  };

  if (isLoading || !user) return null;

  if (phase === 'code-entry') {
    return (
      <div>
        <title>snk – 1v1</title>
        <main className="game-page">
          <header className="game-header">
            <h1 className="game-title">SNAKE</h1>
            <p className="game-subtitle">1v1 – Room Code</p>
          </header>
          <form
            className="join-form"
            onSubmit={(e) => { e.preventDefault(); handleJoin(codeInput); }}
          >
            <input
              className="join-input"
              type="text"
              placeholder="Room code (e.g. ABC123)"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <button className="join-button" type="submit" disabled={!codeInput.trim()}>
              Join Room
            </button>
            <p className="form-footer">– or –</p>
            <button
              className="join-button"
              type="button"
              onClick={() => { const c = generateCode(); setCodeInput(c); handleJoin(c); }}
            >
              Create New Room
            </button>
            <button
              className="join-button"
              type="button"
              style={{ background: 'transparent', border: '1px solid var(--grid-line)' }}
              onClick={() => navigate('/lobby')}
            >
              Back to Lobby
            </button>
          </form>
        </main>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div>
        <title>snk – 1v1</title>
        <main className="game-page">
          <header className="game-header">
            <h1 className="game-title">SNAKE</h1>
            <p className="game-subtitle">Waiting for opponent…</p>
          </header>
          <div className="join-form">
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Share this code with your opponent:
            </p>
            <p style={{ color: 'var(--accent)', fontSize: '2.4rem', fontWeight: 700, letterSpacing: '0.4em', margin: '8px 0' }}>
              {roomCode}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Waiting for 2nd player to join…
            </p>
            <button
              className="join-button"
              style={{ background: 'transparent', border: '1px solid var(--grid-line)', marginTop: 8 }}
              onClick={() => navigate('/lobby')}
            >
              Cancel
            </button>
          </div>
        </main>
      </div>
    );
  }

  const myHead = mySnake[0] ?? { x: -1, y: -1 };
  const oppHead = opponentSnake[0] ?? { x: -1, y: -1 };
  const myBodySet = new Set(mySnake.slice(1).map(toKey));
  const oppBodySet = new Set(opponentSnake.slice(1).map(toKey));

  const gameOverTitle = iAmDead ? (opponentDead ? 'Tie!' : 'You lost!') : 'You win!';

  return (
    <div>
      <title>snk – 1v1</title>
      <main className="game-page">
        <header className="game-header">
          <h1 className="game-title">SNAKE</h1>
          <p className="game-subtitle">1v1 · Room: {roomCode}</p>
        </header>
        <section className="game-layout">
          <section className="board-panel">
            <div className="board" role="grid" aria-label="Snake game board">
              {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
                const x = i % BOARD_SIZE;
                const y = Math.floor(i / BOARD_SIZE);
                const key = `${x},${y}`;
                const isMyHead = myHead.x === x && myHead.y === y;
                const isMyBody = myBodySet.has(key);
                const isOppHead = oppHead.x === x && oppHead.y === y;
                const isOppBody = oppBodySet.has(key);
                const isFood = food.x === x && food.y === y;

                let className = 'cell empty';
                if (isFood) className = 'cell food';
                if (isOppBody) className = 'cell snake-2-body';
                if (isOppHead) className = 'cell snake-2-head';
                if (isMyBody) className = 'cell snake-1-body';
                if (isMyHead) className = 'cell snake-1-head';

                return <div key={key} className={className} />;
              })}
            </div>
            {phase === 'over' ? (
              <div className="game-over-overlay">
                <p className="game-over-title">{gameOverTitle}</p>
                <p className="game-over-score">Your score: {myScore} pts</p>
                <button className="join-button" onClick={() => navigate('/lobby')}>
                  Back to Lobby
                </button>
              </div>
            ) : null}
          </section>
          <aside className="players-panel">
            <h2 className="panel-title">Players</h2>
            <ul className="player-list">
              <li className="player-card">
                <span className="player-color player-color--1" aria-hidden="true" />
                <div className="player-info">
                  <span className="player-name">{user.display_name || user.username} (You)</span>
                  <span className={`player-status ${iAmDead ? 'status-dead' : 'status-alive'}`}>
                    {iAmDead ? 'DEAD' : 'Alive'}
                  </span>
                  <span className="player-score">Score: {myScore}</span>
                </div>
              </li>
              <li className="player-card">
                <span className="player-color player-color--2" aria-hidden="true" />
                <div className="player-info">
                  <span className="player-name">{opponentUsername || 'Waiting…'}</span>
                  <span
                    className={`player-status ${opponentDead ? 'status-dead' : phase === 'waiting' ? 'status-ready' : 'status-alive'}`}
                  >
                    {opponentDead ? 'DEAD' : phase === 'waiting' ? 'Joining…' : 'Alive'}
                  </span>
                  <span className="player-score">Score: {opponentScore}</span>
                </div>
              </li>
            </ul>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default Multiplayer;
