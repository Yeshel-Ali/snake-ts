import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/axios';

type AuthContextValue = {
    isAuthenticated: boolean;
    setAuthenticated: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
    children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [isAuthenticated, setAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const restoreAuth = async () => {
            try {
                await api.get('/auth/me');
                setAuthenticated(true);
            } catch {
                setAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };
        restoreAuth();
    }, []);

    const value = useMemo(
        () => ({
            isAuthenticated,
            setAuthenticated,
        }),
        [isAuthenticated],
    );

    if (isLoading) {
        return null;
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
