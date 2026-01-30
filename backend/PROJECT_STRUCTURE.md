# Backend Project Structure

## Directory Layout

```
backend/
├── config/
│   └── database.js              # Sequelize database configuration
│
├── models/                      # Sequelize ORM Models
│   ├── index.js                 # Model associations and exports
│   ├── User.js                  # User model
│   ├── GitRepo.js               # Repository model
│   ├── Commit.js                # Commit model
│   ├── CommitFile.js            # Commit file statistics
│   ├── UserHabitatAccount.js    # Habitat account model
│   ├── AccountRepoMapping.js    # Account-Repo mapping
│   ├── Reservation.js           # Reservation model
│   ├── MemoCommit.js            # Memo/queue commits
│   ├── CommitStatusCache.js     # Commit availability cache
│   ├── CommitDependencyAnalysis.js  # Dependency analysis
│   ├── CommitTestAnalysis.js    # Test analysis
│   ├── ReservationAuditLog.js   # Audit log
│   ├── CommitFavorite.js        # User favorites
│   ├── CommitFileStatsCache.js  # File stats cache
│   └── SuccessfulTask.js        # Successful task submissions
│
├── routes/                      # API Route Handlers
│   ├── index.js                 # Route aggregator
│   ├── auth.js                  # Authentication routes
│   ├── users.js                 # User management (admin)
│   ├── repos.js                 # Repository management
│   ├── commits.js               # Commit browsing/filtering
│   ├── reservations.js          # Reservation management
│   ├── accounts.js              # Habitat account management
│   ├── memo.js                  # Memo/queue management
│   ├── successfulTasks.js      # Successful tasks sharing
│   └── stats.js                 # Statistics endpoints
│
├── middleware/                  # Express Middleware
│   ├── auth.js                  # JWT authentication
│   ├── errorHandler.js          # Global error handler
│   └── validation.js            # Request validation rules
│
├── services/                     # Business Logic Services
│   └── habitatApi.js            # Habitat API integration
│
├── server.js                     # Main server entry point
├── package.json                  # Dependencies
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore rules
├── README.md                     # Documentation
└── PROJECT_STRUCTURE.md          # This file
```

## Key Features

### 1. **Sequelize ORM**
- All database models use Sequelize
- Associations defined in `models/index.js`
- Automatic timestamp management
- Indexes defined in model definitions

### 2. **Authentication & Authorization**
- JWT-based authentication
- Role-based access control (admin/user)
- User approval system
- Protected routes with middleware

### 3. **API Routes**
- RESTful API design
- Request validation with express-validator
- Pagination support
- Error handling middleware

### 4. **WebSocket Support**
- Socket.IO integration
- User-specific rooms for real-time updates
- Ready for progress notifications

### 5. **Services**
- Habitat API integration service
- Extensible service layer

## Database Models

### Core Models
- **User**: Team members and admins
- **GitRepo**: Repository metadata
- **Commit**: Commit details with scoring
- **CommitFile**: File-level statistics

### Account & Reservation Models
- **UserHabitatAccount**: Habitat API accounts
- **AccountRepoMapping**: Account-repo associations
- **Reservation**: Commit reservations
- **ReservationAuditLog**: Audit trail

### Analysis Models
- **CommitDependencyAnalysis**: Dependency change detection
- **CommitTestAnalysis**: Test coverage analysis
- **CommitFileStatsCache**: Pre-computed file statistics

### User Features
- **MemoCommit**: User memo/queue
- **CommitFavorite**: User favorites
- **SuccessfulTask**: Shared successful tasks

## API Endpoints Summary

### Public
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Protected (All Users)
- `GET /api/auth/me` - Current user info
- `GET /api/commits` - Browse commits (with filtering)
- `GET /api/reservations` - User's reservations
- `POST /api/reservations` - Create reservation
- `GET /api/accounts` - User's accounts
- `GET /api/successful-tasks` - Browse successful tasks
- `POST /api/successful-tasks` - Submit successful task

### Admin Only
- `GET /api/users` - User management
- `POST /api/repos` - Create repository
- `PATCH /api/successful-tasks/:id/approve` - Approve task

## Environment Variables

Required environment variables (see `.env.example`):
- Database connection (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)
- JWT secret (JWT_SECRET, JWT_EXPIRES_IN)
- Server port (PORT)
- Frontend URL (FRONTEND_URL)
- Habitat API URL (HABITAT_API_URL)

## Next Steps

1. **Install dependencies**: `npm install`
2. **Configure environment**: Copy `.env.example` to `.env` and fill in values
3. **Database setup**: Create database and tables (or use migrations)
4. **Run server**: `npm run dev` or `npm start`

## Notes

- All models use camelCase in JavaScript, snake_case in database
- Sequelize handles the conversion automatically
- Timestamps are managed automatically by Sequelize
- Foreign key constraints are enforced at database level
- Indexes are defined for performance optimization
