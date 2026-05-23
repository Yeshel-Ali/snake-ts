# Snake TS

A full-stack multiplayer-ready Snake game built with TypeScript, React, Node.js, Socket.IO, and MongoDB.

## Tech Stack

- Frontend: React, TypeScript, Vite, Socket.IO Client
- Backend: Node.js, Express, TypeScript, Socket.IO
- Database: MongoDB Atlas with Mongoose
- Auth: JWT (httpOnly cookies) + bcrypt password hashing

## Project Structure

- `backend/`: API server, auth, leaderboard, sockets, database models
- `frontend/`: React app, pages, context, API clients

## Features

- Secure auth with hashed passwords
- Cookie-based JWT sessions
- Session restore on refresh
- Profile updates with current-password verification
- Leaderboard with pagination and search
- Real-time game events with Socket.IO

## Quick Start

### 1) Clone and install

```bash
git clone https://github.com/Yeshel-Ali/snake-ts.git
cd snake-ts

cd backend && npm install
cd ../frontend && npm install
```

### 2) Configure environment

Backend env file at `backend/.env`:

```env
PORT=3001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key
CLIENT_URL=http://localhost:5173
```

Frontend env file at `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

### 3) Run the app

Terminal 1 (backend):

```bash
cd backend
npm run dev
```

Terminal 2 (frontend):

```bash
cd frontend
npm run dev
```

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/profile`

### Leaderboard

- `GET /api/leaderboard?page=1&limit=5&search=`

## Security Notes

- Passwords are stored using bcrypt hashes
- JWT secret is loaded from environment variables
- Auth cookies are httpOnly and sameSite=lax
- Sensitive env files are gitignored

## Roadmap

- Add multiplayer room UX polish
- Add in-game sounds and animations
- Add game replay/highlight export
- Add CI checks for backend and frontend builds

## License

MIT
