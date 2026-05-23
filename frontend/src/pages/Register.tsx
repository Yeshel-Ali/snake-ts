import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/axios.ts';
import { useAuth } from '../context/AuthContext';
import { debug } from '../utils/debug';
import './../assets/snake.css'

export type RegisterForm = {
    username: string;
    display_name: string;
    password: string;
};

const Register = () => {
    const [form, setForm] = useState<RegisterForm>({
        username: '',
        display_name: '',
        password: '',
    });

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { isAuthenticated, setAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        debug('[register] mount');
        return () => { debug('[register] unmount'); };
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/lobby");
        }
    }, [isAuthenticated, navigate]);

    const handleChange =
        (field: keyof RegisterForm) =>
            (event: React.ChangeEvent<HTMLInputElement>) => {
                const value = event.target.value;
                setForm((prev) => ({
                    ...prev,
                    [field]: value,
                }));
            };

    const trimmedUsername = form.username.trim();
    const trimmedDisplay = form.display_name.trim();

    const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
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

        if (trimmedDisplay.length > 30) {
            setError('Display name is too long');
            return;
        }

        if (trimmedDisplay.length < 2 && trimmedDisplay != '') {
            setError('Display name is too short');
            return;
        }

        debug('[register] submit', { username: trimmedUsername, display_name: trimmedDisplay });
        setIsSubmitting(true);
        try {
            await api.post('/auth/register', {
                username: trimmedUsername,
                display_name: trimmedDisplay, //rememeber to handle backend for this optional
                password: form.password,
            });
            debug('[register] success -> /lobby');
            setAuthenticated(true);
            navigate('/lobby');
        } catch (err: unknown) {
            const message = (() => {
                if (err && typeof err === 'object' && 'response' in err) {
                    const response = (err as { response?: { data?: { error?: string } } }).response;
                    return response?.data?.error ?? 'Signup failed.';
                }
                if (err instanceof Error) return err.message;
                return 'Signup failed.';
            })();
            debug('[register] error', message);
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const canSubmit = Boolean(trimmedUsername && form.password);

    return (
        <div>
            <title>snk – Register</title>
            <main className="game-page">
                <header className="game-header">
                    <h1 className="game-title">SNAKE</h1>
                    <p className="game-subtitle">Create account</p>
                </header>
                <form className="join-form" onSubmit={handleSubmit} noValidate>
                    {/* Error message (shown on validation failure) */}
                    {/* <p class="form-error">Username already taken</p> */}
                    <input
                        className="join-input"
                        type="text"
                        placeholder="Username"
                        value={form.username}
                        onChange={handleChange('username')}
                        autoComplete="username"
                        required
                        minLength={2}
                        maxLength={20}
                    />
                    <input
                        className="join-input"
                        type="text"
                        placeholder="Display name (optional)"
                        maxLength={30}
                        minLength={2}
                        value={form.display_name}
                        onChange={handleChange('display_name')}
                        autoComplete="display name"
                    />
                    <input
                        className="join-input"
                        type="password"
                        placeholder="Password"
                        value={form.password}
                        onChange={handleChange('password')}
                        autoComplete="new-password"
                        required
                        minLength={6}
                    />
                    {error ? <p role="alert">{error}</p> : null}
                    <button className="join-button" type="submit" disabled={!canSubmit || isSubmitting}>Register</button>
                    <p className="form-footer">
                        Have an account? <Link to="/login">Sign in</Link>
                    </p>
                </form>
            </main>
        </div>

    );
}

export default Register;