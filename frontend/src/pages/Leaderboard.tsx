import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { debug } from '../utils/debug';
import './../assets/snake.css';
import { api } from './../api/axios';

const PAGE_SIZE = 5;

interface User {
  username: string;
  display_name: string;
  score: number;
}

type LeaderboardEntry = {
  username: string;
  score: number;
  display_name: string;
  _id: string;
};

type LeaderboardResponse = {
  items: LeaderboardEntry[];
  page: number;
  totalPages: number;
  totalCount: number;
};

const Leaderbaord = () => {
  const { isAuthenticated, setAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  const handleLogout = async () => {
    debug('[home] logout');
    try {
      await api.post('/auth/logout');
    } catch (err) {
      debug('[home] logout error', err);
    } finally {
      setAuthenticated(false);
      navigate('/login');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;

    const fetchUser = async () => {
      try {
        debug('[leaderboard] fetching /auth/me');
        const response = await api.get<User>('/auth/me');
        if (!isMounted) return;
        setUser(response.data);
      } catch (err) {
        debug('[leaderboard] /auth/me error', err);
        if (isMounted) {
          setIsLoading(false);
          navigate('/');
        }
        return;
      }
      if (isMounted) setIsLoading(false);
    };

    fetchUser();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const fetchLeaderboard = async () => {
      setIsLeaderboardLoading(true);
      try {
        const response = await api.get<LeaderboardResponse>('/leaderboard', {
          params: { page, limit: PAGE_SIZE, search: search.trim() || undefined },
        });
        if (!isMounted) return;
        setEntries(response.data.items);
        setTotalPages(response.data.totalPages || 1);
      } catch {
        if (isMounted) {
          setEntries([]);
          setTotalPages(1);
        }
      } finally {
        if (isMounted) setIsLeaderboardLoading(false);
      }
    };

    fetchLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [page, search, user]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  if (!user || isLoading) return null;

  const rankOffset = (page - 1) * PAGE_SIZE;
  const getRowClass = (rank: number) => {
    if (rank === 1) return 'lb-gold';
    if (rank === 2) return 'lb-silver';
    if (rank === 3) return 'lb-bronze';
    return '';
  };

  return (
    <div>
      <title>snk – Leaderboard</title>
      <main className="game-page">
        <nav className="nav-bar">
          <span className="nav-brand">SNAKE</span>
          <div className="nav-links-group">
            {isAuthenticated ? <Link to="/lobby">Lobby</Link> : <div></div>}
            <Link to="/leaderboard">Leaderboard</Link>
            {isAuthenticated ? <Link to="/profile">Profile</Link> : <div></div>}
          </div>
          <div className="nav-right">
            {isAuthenticated ? (
              <button className="nav-logout" onClick={handleLogout}>
                Logout
              </button>
            ) : (
              <Link className="nav-logout" to="/login">
                Login
              </Link>
            )}
          </div>
        </nav>
        <header className="game-header">
          <h1 className="game-title">SNAKE</h1>
          <p className="game-subtitle">Leaderboard</p>
        </header>
        <div className="leaderboard-panel">
          <div className="lb-controls">
            <input
              className="join-input lb-search"
              type="text"
              placeholder="Search players..."
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>High Score</th>
              </tr>
            </thead>
            <tbody>
              {isLeaderboardLoading ? (
                <tr>
                  <td colSpan={3} className="lb-empty">Loading…</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="lb-empty">No scores yet - play a game!</td>
                </tr>
              ) : (
                entries.map((entry, index) => {
                  const rank = rankOffset + index + 1;
                  return (
                    <tr key={entry._id} className={getRowClass(rank)}>
                      <td className="lb-rank">{rank}</td>
                      <td>{entry.display_name || entry.username}</td>
                      <td className="player-score">{entry.score}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {totalPages > 1 ? (
            <div className="lb-pagination">
              <button
                className="lb-page-btn"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
              >
                ← Prev
              </button>
              <span className="lb-page-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="lb-page-btn"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
              >
                Next →
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default Leaderbaord;
