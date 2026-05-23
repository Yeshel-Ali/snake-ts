import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { debug } from '../utils/debug';
import './../assets/snake.css'
import { api } from './../api/axios';
import './../assets/snake.css'

interface User {
    username: string;
    display_name: string;
    score: number;
}

type ProfileForm = {
    username: string;
    score: number;
    display_name: string;
    newPassword: string;
    confirmNewPassword: string;
};


const Lobby = () => {

    const { isAuthenticated, setAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate("/login");
        }
    }, [isAuthenticated, navigate]);

    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [form, setForm] = useState<ProfileForm>({
        username: '',
        score: 0,
        display_name: '',
        newPassword: '',
        confirmNewPassword: '',
    });


    const handleLogout = async () => {
        debug('[home] logout');
        try {
            await api.post('/auth/logout');
            debug('[home] logout success');
        } catch (err) {
            debug('[home] logout error', err);
        } finally {
            setAuthenticated(false)
            navigate('/login');
        }
    };

  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;

    const fetchUser = async () => {
      try {
        debug('[profile] fetching /auth/me');
        const response = await api.get<User>('/auth/me');
        if (!isMounted) return;
        setUser(response.data);
        setForm((prev) => ({
          ...prev,
          display_name: response.data.display_name,
          username: response.data.username,
          score: response.data.score,
        }));
      } catch (err) {
        debug('[profile] /auth/me error', err);
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

  if (!user || isLoading) return null;

    return (
        <div>
            <title>snk Lobby</title>
            <main className="game-page">
                {/* ===== NavBar ===== */}
                <nav className="nav-bar">
                    <span className="nav-brand">SNAKE</span>
                    <div className="nav-links-group">
                        {isAuthenticated ? <Link to="/lobby">Lobby</Link> : <div></div>}
                        <Link to="/leaderboard">Leaderboard</Link>
                        {isAuthenticated ? <Link to="/profile">Profile</Link> : <div></div>}
                    </div>
                    <div className="nav-right">
                        {isAuthenticated
                            ? <button className="nav-logout" onClick={handleLogout}>Logout</button>
                            : <Link className="nav-logout" to="/login">Login</Link>
                        }
                    </div>
                </nav>
                <header className="game-header">
                    <h1 className="game-title">SNAKE</h1>
                    <p className="game-subtitle">Lobby</p>
                </header>
                <div className="lobby-panel">
                    <p className="lobby-username">Welcome back, <strong>{form.username}</strong>!</p>
                    <p className="lobby-status">Your best: {form.score} pts</p>
                    <p className="lobby-status">Choose a game mode:</p>
                    <div className="lobby-buttons">
                        <button className="join-button" onClick={() => {navigate("/game?mode={solo}")}}>Solo</button>
                        <button className="join-button" onClick={() => {navigate("/game?mode={bot}")}}>vs Bot</button>
                        <button className="join-button join-button--p2" onClick={() => navigate('/multiplayer')}>1 v 1</button>
                    </div>
                    <p className="lobby-hint">Player 1: WASD, Player 2: Arrow keys</p>
                </div>
            </main>
        </div>
    );
}

export default Lobby;