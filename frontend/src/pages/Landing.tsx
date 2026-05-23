import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

const Landing = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/lobby");
        } else {
            navigate("/login");
        }
    }, [isAuthenticated, navigate]);

    return (
        <div></div>
    );

};

export default Landing;