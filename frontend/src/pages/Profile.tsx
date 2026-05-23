import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { debug } from '../utils/debug';
import './../assets/snake.css'
import { api } from './../api/axios';

interface User {
    username: string;
    display_name: string;
    score: number;
}

type ProfileForm = {
    username: string;
    score: number;
    display_name: string;
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
};

const Profile = () => {
    const { isAuthenticated, setAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate("/login");
        }
    }, [isAuthenticated, navigate]);
    const [user, setUser] = useState<User | null>(null);
    const [form, setForm] = useState<ProfileForm>({
        username: '',
        score: 0,
        display_name: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    });

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
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

            if (isMounted) {
                setIsLoading(false);
            }
        };

        fetchUser();

        return () => {
            isMounted = false;
        };
    }, [navigate]);

    const handleChange =
        (field: keyof ProfileForm) =>
            (event: React.ChangeEvent<HTMLInputElement>) => {
                const value = event.target.value;
                setForm((prev) => ({
                    ...prev,
                    [field]: value,
                }));
            };

    const handleLogout = async () => {
        debug('[home] logout');
        try {
            await api.post('/auth/logout');
            debug('[home] logout success');
        } catch (err) {
            debug('[home] logout error', err);
        } finally {
            setAuthenticated(false);
            navigate('/login');
        }
    };

    const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (form.display_name.length > 30) {
            setError('Display name is too long');
            return;
        }

        if (form.display_name.length < 2 && form.display_name != '') {
            setError('Display name is too short');
            return;
        }
        const trimmedDisplay = form.display_name.trim();


        const wantsPasswordChange = Boolean(form.newPassword);

        if (wantsPasswordChange) {
            if (!form.currentPassword) {
                setError('Current password is required to change your password.');
                return;
            }
            if (!form.newPassword || !form.confirmNewPassword) {
                setError('Please fill out all password fields.');
                return;
            }
            if (form.newPassword !== form.confirmNewPassword) {
                setError('New passwords do not match.');
                return;
            }
            if (form.newPassword.length < 6) {
                setError('New password must be at least 6 characters.');
                return;
            }
        }

        debug('[profile] submit', { display_name: trimmedDisplay, wantsPasswordChange });
        setIsSaving(true);
        try {
            const payload: {
                display_name: string;
                currentPassword?: string;
                newPassword?: string;
            } = {
                display_name: trimmedDisplay,
            };

            if (wantsPasswordChange) {
                payload.currentPassword = form.currentPassword;
                payload.newPassword = form.newPassword;
            }

            const response = await api.patch<User>('/auth/profile', payload);
            debug('[profile] update success', { username: response.data.username });
            setUser(response.data);
            setForm((prev) => ({
                ...prev,
                display_name: response.data.display_name || prev.display_name,
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: '',
            }));
            setSuccess('Profile updated successfully.');
        } catch (err: unknown) {
            const message = (() => {
                if (err && typeof err === 'object' && 'response' in err) {
                    const response = (err as { response?: { data?: { error?: string } } }).response;
                    return response?.data?.error ?? 'Update failed.';
                }
                if (err instanceof Error) return err.message;
                return 'Update failed.';
            })();
            debug('[profile] update error', message);
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const canSubmit = !isSaving;


    return (
        <div>
            <title>snk – Profile</title>
            <link rel="stylesheet" href="snake.css" />
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
                    <p className="game-subtitle">Profile</p>
                </header>
                <form className="join-form" onSubmit={handleSubmit}>
                    {/* Read-only stats */}
                    <div className="profile-stat">
                        <span className="profile-label">Username</span>
                        <span className="profile-value">{form.username}</span>
                    </div>
                    <div className="profile-stat">
                        <span className="profile-label">High Score</span>
                        <span className="profile-value player-score">{form.score} pts</span>
                    </div>
                    {/* Success / error messages */}
                    {/* <p class="form-success">Profile updated!</p> */}
                    {/* <p class="form-error">Passwords do not match</p> */}
                    <p className="profile-section-label">Display Name</p>
                    <input 
                        className="join-input" 
                        type="text" 
                        placeholder="Display name" 
                        defaultValue="PlayerOne" 
                        maxLength={30}
                        value={form.display_name}
                        onChange={handleChange('display_name')} 
                    />
                    <p className="profile-section-label">Change Password</p>
                    <input 
                        className="join-input" 
                        type="password" 
                        placeholder="Current password" 
                        value={form.currentPassword}
                        onChange={handleChange('currentPassword')}
                    />
                    <input 
                        className="join-input" 
                        type="password" 
                        placeholder="New password (leave blank to keep current)" 
                        value={form.newPassword}
                        onChange={handleChange('newPassword')}
                    />
                    <input 
                        className="join-input" 
                        type="password" 
                        placeholder="Confirm new password" 
                        value={form.confirmNewPassword}
                        onChange={handleChange('confirmNewPassword')}
                    />
                    <button className="join-button" type="submit" disabled={!canSubmit} >{isSaving ? 'Saving...' : 'Save Changes'}</button>
                </form>
            </main>
        </div>
    );
}

export default Profile;