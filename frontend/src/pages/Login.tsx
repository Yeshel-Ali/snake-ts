import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from './../api/axios.ts';
import { useAuth } from './../context/AuthContext.tsx';
import { debug } from '../utils/debug.ts';
import './../assets/snake.css'

type LoginForm = {
    username: string;
    password: string;
};


const Login = () => {
    const [form, setForm] = useState<LoginForm>({
        username: '',
        password: '',
    });

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { isAuthenticated, setAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        debug('[login] mount');
        return () => { debug('[login] unmount'); };
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/lobby");
        }
    }, [isAuthenticated, navigate])

    const handleChange =
        (field: keyof LoginForm) =>
            (event: React.ChangeEvent<HTMLInputElement>) => {
                const value = event.target.value;
                setForm((prev) => ({
                    ...prev,
                    [field]: value,
                }));
            };

    const trimmedUsername = form.username.trim();

    const handlelogin = async (event: React.SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!trimmedUsername || !form.password) {
            setError('All fields are required.');
            return;
        }

        if (trimmedUsername.length <= 2) {
            setError('User name too short');
            return;
        }        
        if (form.password.length < 6) {
            setError('password too short');
            return;
        }

        if (trimmedUsername.length > 20) {
            setError('User name too long');
            return;
        }
        debug('[login] submit', { username: trimmedUsername });
        setIsLoading(true);
        try {
            await api.post('/auth/login', {
                username: trimmedUsername,
                password: form.password,
            });
            console.log('[login] success -> /home');
            setAuthenticated(true);
            navigate('/lobby');
        } catch (err: unknown) {
            const message = (() => {
                if (err && typeof err === 'object' && 'response' in err) {
                    const response = (err as { response?: { data?: { error?: string } } }).response;
                    return response?.data?.error ?? 'Login failed.';
                }
                if (err instanceof Error) return err.message;
                return 'Login failed.';
            })();
            console.log('[login] error', message);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }

    const canSubmit = Boolean(trimmedUsername && form.password);


    return (
        <div>
            <title>snk – Login</title>
            <main className="game-page">
                <header className="game-header">
                    <h1 className="game-title">SNAKE</h1>
                    <p className="game-subtitle">Sign in to play</p>
                </header>
                <form className="join-form" onSubmit={handlelogin} noValidate>
                    {/* Error message (shown on bad credentials) */}
                    {/* <p class="form-error">Invalid username or password</p> */}
                    <input 
                        className="join-input" 
                        type="text" 
                        placeholder="Username"
                        value={form.username}
                        onChange={handleChange('username')}
                        autoComplete="username"
                        required
                        minLength={2}
                        maxLength={20} />
                    <input 
                        className="join-input" 
                        type="password" 
                        placeholder="Password"
                        value={form.password}
                        onChange={handleChange('password')}
                        autoComplete="password"
                        required
                        minLength={6} />
                    {error ? <p role="alert">{error}</p> : null}
                    <button className="join-button" type="submit" disabled={!canSubmit || isLoading}>Sign In</button>
                    <p className="form-footer">
                        No account? <Link to="/register">Register</Link>
                    </p>
                </form>
            </main>
        </div>

    );
}

export default Login;