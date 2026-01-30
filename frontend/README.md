# Habitate Frontend

React frontend for Habitate Web Application using Ant Design.

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool
- **Ant Design 5** - UI component library
- **React Router 6** - Routing
- **Axios** - HTTP client
- **Socket.IO Client** - WebSocket client

## Theme

Dark theme with emerald green primary color (#16a34a), matching the old_app design.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable components
│   │   ├── Layout.jsx     # Main layout with sidebar
│   │   └── PrivateRoute.jsx
│   ├── config/           # Configuration files
│   │   ├── api.js        # Axios instance with interceptors
│   │   └── theme.js      # Ant Design theme config
│   ├── contexts/         # React contexts
│   │   └── AuthContext.jsx
│   ├── pages/            # Page components
│   │   ├── admin/       # Admin pages
│   │   ├── user/        # User pages
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   └── ...
│   ├── App.jsx           # Main app component with routes
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── index.html
├── vite.config.js
└── package.json
```

## Features

- ✅ Authentication (Login/Register)
- ✅ Protected routes
- ✅ Dark theme with custom colors
- ✅ Responsive layout
- ✅ Global loading indicator
- ✅ API error handling
- ✅ Dashboard with statistics
- 🔄 Admin pages (placeholder)
- 🔄 User pages (placeholder)
- 🔄 Successful Tasks page (placeholder)

## API Integration

The frontend connects to the backend API at `http://localhost:5000/api` (proxied through Vite).

All API calls use the axios instance in `src/config/api.js` which:
- Automatically adds JWT token to requests
- Handles 401 errors (redirects to login)
- Shows global loading indicator
- Handles errors consistently

## Environment Variables

Create `.env` file if needed:
```
VITE_API_URL=http://localhost:5000
```

## Development

The app runs on `http://localhost:5173` by default.

Hot module replacement (HMR) is enabled for fast development.
