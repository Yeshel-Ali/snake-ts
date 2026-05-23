import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Leaderbaord from './pages/Leaderboard';
import Profile from './pages/Profile';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Multiplayer from './pages/Multiplayer';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/leaderboard" element={<Leaderbaord />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game" element={<Game />} />
        <Route path="/multiplayer" element={<Multiplayer />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;