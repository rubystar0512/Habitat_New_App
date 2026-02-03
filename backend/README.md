# Habitate Backend API

Node.js backend API for Habitate Web Application using Sequelize ORM, MySQL, and WebSocket.

## Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **Sequelize** - ORM for MySQL
- **MySQL** - Database
- **Socket.IO** - WebSocket for real-time updates
- **JWT** - Authentication
- **bcryptjs** - Password hashing

## Project Structure

```
backend/
├── config/
│   └── database.js          # Sequelize database configuration
├── models/                  # Sequelize models
│   ├── index.js            # Model associations
│   ├── User.js
│   ├── GitRepo.js
│   ├── Commit.js
│   ├── CommitFile.js
│   └── ... (other models)
├── routes/                  # API routes
│   ├── index.js            # Route aggregator
│   ├── auth.js
│   ├── users.js
│   ├── repos.js
│   ├── commits.js
│   ├── reservations.js
│   ├── accounts.js
│   ├── memo.js
│   ├── successfulTasks.js
│   └── stats.js
├── middleware/
│   ├── auth.js             # JWT authentication
│   ├── errorHandler.js    # Error handling
│   └── validation.js      # Request validation
├── services/
│   └── habitatApi.js       # Habitat API integration
├── server.js               # Main server file
├── package.json
└── .env.example
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Database setup:**
   - Ensure MySQL is running
   - Create database: `CREATE DATABASE habitate_db;`
   - Run migrations (if using Sequelize migrations) or create tables manually

4. **Start server:**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Users (Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PATCH /api/users/:id/approve` - Approve user
- `PATCH /api/users/:id/role` - Update user role

### Repositories
- `GET /api/repos` - Get all repos
- `GET /api/repos/:id` - Get repo by ID
- `POST /api/repos` - Create repo (admin)
- `PATCH /api/repos/:id` - Update repo (admin)

### Commits
- `GET /api/commits` - Get commits with filtering
- `GET /api/commits/:id` - Get commit details

### Reservations
- `GET /api/reservations` - Get user's reservations
- `POST /api/reservations` - Create reservation
- `DELETE /api/reservations/:id` - Cancel reservation

### Accounts
- `GET /api/accounts` - Get user's Habitat accounts
- `POST /api/accounts` - Create account
- `PATCH /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Memo
- `GET /api/memo` - Get memo commits
- `POST /api/memo` - Add to memo
- `DELETE /api/memo/:id` - Remove from memo

### Successful Tasks
- `GET /api/successful-tasks` - Get successful tasks
- `GET /api/successful-tasks/:id` - Get task details
- `POST /api/successful-tasks` - Submit task
- `PATCH /api/successful-tasks/:id/approve` - Approve (admin)
- `PATCH /api/successful-tasks/:id/reject` - Reject (admin)

### Statistics
- `GET /api/stats/overall` - Overall statistics
- `GET /api/stats/my-stats` - User statistics

## WebSocket Events

### Client → Server
- `join-user-room` - Join user-specific room for updates
- `leave-user-room` - Leave user room

### Server → Client
- Emit to `user-{userId}` room for user-specific updates

## Environment Variables

See `.env.example` for all required environment variables.

- **MEMO_LIMIT** (optional) – Max number of memo items per user. Default: `45`. Admin-configured; set in `.env` to change (e.g. `MEMO_LIMIT=45`).

## Database Models

All models are defined in `models/` directory using Sequelize. See `models/index.js` for associations.

## Authentication

JWT tokens are used for authentication. Include token in Authorization header:
```
Authorization: Bearer <token>
```

## Error Handling

All errors are handled by the error handler middleware and return consistent JSON responses.
