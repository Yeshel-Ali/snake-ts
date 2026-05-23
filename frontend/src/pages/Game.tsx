import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from './../api/axios';
import './../assets/snake.css';

type User = {
  username: string;
  display_name: string;
  score: number;
};

type Coord = { x: number; y: number };

const BOARD_SIZE = 15;
const TICK_MS = 100;

const INITIAL_SNAKE: Coord[] = [
  { x: 7, y: 7 },
  { x: 6, y: 7 },
  { x: 5, y: 7 },
];
const INITIAL_BOT_SNAKE: Coord[] = [
  { x: 7, y: 8 },
  { x: 7, y: 9 },
  { x: 7, y: 10 },
];
const INITIAL_DIR: Coord = { x: 1, y: 0 };
const INITIAL_BOT_DIR: Coord = { x: 0, y: -1 };

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

const toKey = (point: Coord) => `${point.x},${point.y}`;

const spawnFood = (occupied: Coord[]): Coord => {
  const occupiedSet = new Set(occupied.map(toKey));
  const open: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!occupiedSet.has(`${x},${y}`)) open.push({ x, y });
    }
  }
  return open.length ? open[Math.floor(Math.random() * open.length)] : { x: 0, y: 0 };
};

const botPickDir = (
  head: Coord,
  currentDir: Coord,
  target: Coord,
  occupied: Set<string>,
): Coord => {
  const candidates: Coord[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ].filter((d) => !(d.x === -currentDir.x && d.y === -currentDir.y));

  const safe = candidates.filter((d) => {
    const next = { x: head.x + d.x, y: head.y + d.y };
    if (next.x < 0 || next.x >= BOARD_SIZE || next.y < 0 || next.y >= BOARD_SIZE) return false;
    if (occupied.has(toKey(next))) return false;
    return true;
  });

  const pool = safe.length ? safe : candidates;
  return pool.reduce((best, d) => {
    const next = { x: head.x + d.x, y: head.y + d.y };
    const bestNext = { x: head.x + best.x, y: head.y + best.y };
    const distA = Math.abs(next.x - target.x) + Math.abs(next.y - target.y);
    const distB = Math.abs(bestNext.x - target.x) + Math.abs(bestNext.y - target.y);
    return distA < distB ? d : best;
  });
};

const Game = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawMode = params.get('mode') || '';
  const mode = rawMode.replace(/[{}]/g, '').toLowerCase();
  const isSolo = mode === 'solo';
  const isBot = mode === 'bot';
  const isActiveGame = isSolo || isBot;

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [snake, setSnake] = useState<Coord[]>(INITIAL_SNAKE);
  const [snake2, setSnake2] = useState<Coord[]>(INITIAL_BOT_SNAKE);
  const [food, setFood] = useState<Coord>(() => spawnFood([...INITIAL_SNAKE, ...INITIAL_BOT_SNAKE]));
  const [score, setScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<'player' | 'bot' | 'tie' | null>(null);

  const snakeRef = useRef<Coord[]>(INITIAL_SNAKE);
  const snake2Ref = useRef<Coord[]>(INITIAL_BOT_SNAKE);
  const foodRef = useRef<Coord>(food);
  const scoreRef = useRef(0);
  const directionRef = useRef<Coord>(INITIAL_DIR);
  const pendingDirectionRef = useRef<Coord>(INITIAL_DIR);
  const botDirRef = useRef<Coord>(INITIAL_BOT_DIR);
  const submittedRef = useRef(false);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      try {
        const response = await api.get<User>('/auth/me');
        if (!isMounted) return;
        setUser(response.data);
      } catch {
        if (isMounted) navigate('/login');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    if (isAuthenticated) fetchUser();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isGameOver || !isSolo || submittedRef.current) return;
    submittedRef.current = true;
    api.patch('/auth/score', { score: scoreRef.current }).catch(() => {});
  }, [isGameOver, isSolo]);

  const resetGame = () => {
    const initialFood = spawnFood([...INITIAL_SNAKE, ...INITIAL_BOT_SNAKE]);
    snakeRef.current = INITIAL_SNAKE;
    snake2Ref.current = INITIAL_BOT_SNAKE;
    foodRef.current = initialFood;
    scoreRef.current = 0;
    directionRef.current = INITIAL_DIR;
    pendingDirectionRef.current = INITIAL_DIR;
    botDirRef.current = INITIAL_BOT_DIR;
    submittedRef.current = false;
    setSnake(INITIAL_SNAKE);
    setSnake2(INITIAL_BOT_SNAKE);
    setFood(initialFood);
    setScore(0);
    setBotScore(0);
    setIsGameOver(false);
    setWinner(null);
  };

  useEffect(() => {
    if (!isActiveGame || isGameOver) return;
    const handleKey = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const next = KEY_TO_DIR[key];
      if (!next) return;
      const current = directionRef.current;
      if (current.x + next.x === 0 && current.y + next.y === 0) return;
      pendingDirectionRef.current = next;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActiveGame, isGameOver]);

  useEffect(() => {
    if (!isActiveGame || isGameOver) return;

    const id = window.setInterval(() => {
      const prevSnake = snakeRef.current;
      const prevSnake2 = snake2Ref.current;

      const dir = pendingDirectionRef.current;
      directionRef.current = dir;
      const head = prevSnake[0];
      const nextHead = { x: head.x + dir.x, y: head.y + dir.y };

      const playerHitsWall =
        nextHead.x < 0 || nextHead.x >= BOARD_SIZE || nextHead.y < 0 || nextHead.y >= BOARD_SIZE;
      const playerHitsSelf = prevSnake.slice(0, -1).some((p) => p.x === nextHead.x && p.y === nextHead.y);
      const playerHitsBot = isBot && prevSnake2.some((p) => p.x === nextHead.x && p.y === nextHead.y);
      const playerDies = playerHitsWall || playerHitsSelf || playerHitsBot;

      let botDies = false;
      let nextSnake2 = prevSnake2;
      let botAteFood = false;

      if (isBot) {
        const botOccupied = new Set([...prevSnake2.slice(0, -1), ...prevSnake].map(toKey));
        const botDir = botPickDir(prevSnake2[0], botDirRef.current, foodRef.current, botOccupied);
        botDirRef.current = botDir;
        const head2 = prevSnake2[0];
        const nextHead2 = { x: head2.x + botDir.x, y: head2.y + botDir.y };

        const botHitsWall =
          nextHead2.x < 0 || nextHead2.x >= BOARD_SIZE || nextHead2.y < 0 || nextHead2.y >= BOARD_SIZE;
        const botHitsSelf = prevSnake2.slice(0, -1).some((p) => p.x === nextHead2.x && p.y === nextHead2.y);
        botDies = botHitsWall || botHitsSelf;

        if (!botDies) {
          botAteFood = nextHead2.x === foodRef.current.x && nextHead2.y === foodRef.current.y;
          nextSnake2 = botAteFood ? [nextHead2, ...prevSnake2] : [nextHead2, ...prevSnake2.slice(0, -1)];
        }
      }

      if (playerDies || botDies) {
        setIsGameOver(true);
        if (isBot) {
          if (playerDies && botDies) setWinner('tie');
          else if (playerDies) setWinner('bot');
          else setWinner('player');
        }
        return;
      }

      const playerAteFood =
        nextHead.x === foodRef.current.x && nextHead.y === foodRef.current.y;
      const nextSnake = playerAteFood ? [nextHead, ...prevSnake] : [nextHead, ...prevSnake.slice(0, -1)];

      if (playerAteFood) setScore((v) => v + 1);
      if (botAteFood) setBotScore((v) => v + 1);

      if (playerAteFood || botAteFood) {
        const newFood = spawnFood([...nextSnake, ...nextSnake2]);
        setFood(newFood);
        foodRef.current = newFood;
      }

      setSnake(nextSnake);
      snakeRef.current = nextSnake;

      if (isBot) {
        setSnake2(nextSnake2);
        snake2Ref.current = nextSnake2;
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [isActiveGame, isGameOver, isBot]);

  if (isLoading) return null;

  const head = snake[0] ?? { x: -1, y: -1 };
  const head2 = snake2[0] ?? { x: -1, y: -1 };
  const bodySet = new Set(snake.slice(1).map(toKey));
  const bodySet2 = new Set(snake2.slice(1).map(toKey));

  const gameOverTitle = isBot
    ? winner === 'player'
      ? 'You win!'
      : winner === 'bot'
        ? 'Bot wins!'
        : 'Tie!'
    : 'Game over';

  return (
    <div>
      <title>snk</title>
      <main className="game-page">
        <header className="game-header">
          <h1 className="game-title">SNAKE</h1>
          <p className="game-subtitle">{isBot ? 'vs Bot' : 'Solo Mode'}</p>
        </header>
        <section className="game-layout">
          <section className="board-panel">
            <div className="board" role="grid" aria-label="Snake game board">
              {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
                const x = index % BOARD_SIZE;
                const y = Math.floor(index / BOARD_SIZE);
                const key = `${x},${y}`;
                const isHead = head.x === x && head.y === y;
                const isBody = bodySet.has(key);
                const isHead2 = isBot && head2.x === x && head2.y === y;
                const isBody2 = isBot && bodySet2.has(key);
                const isFood = food.x === x && food.y === y;

                let className = 'cell empty';
                if (isFood) className = 'cell food';
                if (isBody2) className = 'cell snake-2-body';
                if (isHead2) className = 'cell snake-2-head';
                if (isBody) className = 'cell snake-1-body';
                if (isHead) className = 'cell snake-1-head';

                return <div key={key} className={className} />;
              })}
            </div>
            {isGameOver ? (
              <div className="game-over-overlay">
                <p className="game-over-title">{gameOverTitle}</p>
                <p className="game-over-score">Score: {score} pts</p>
                <button className="join-button" onClick={resetGame}>
                  Play again
                </button>
                <button
                  className="join-button"
                  style={{ background: 'transparent', border: '1px solid var(--grid-line)', marginTop: 4 }}
                  onClick={() => navigate('/lobby')}
                >
                  Return to Lobby
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
                  <span className="player-name">{user?.display_name || user?.username || 'Player'}</span>
                  <span
                    className={`player-status ${isGameOver && winner !== 'player' ? 'status-dead' : 'status-alive'}`}
                  >
                    {isGameOver && winner !== 'player' ? 'DEAD' : 'Alive'}
                  </span>
                  <span className="player-score">Score: {score}</span>
                </div>
              </li>
              {isBot ? (
                <li className="player-card">
                  <span className="player-color player-color--2" aria-hidden="true" />
                  <div className="player-info">
                    <span className="player-name">Bot</span>
                    <span
                      className={`player-status ${isGameOver && winner !== 'bot' ? 'status-dead' : 'status-alive'}`}
                    >
                      {isGameOver && winner !== 'bot' ? 'DEAD' : 'Alive'}
                    </span>
                    <span className="player-score">Score: {botScore}</span>
                  </div>
                </li>
              ) : null}
            </ul>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default Game;
