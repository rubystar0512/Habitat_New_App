#!/bin/bash
# Setup script for production deployment with nginx and PM2

set -e

echo "🚀 Setting up Habitate production environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env exists
ENV_FILE="/var/Habitat_New_App/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > "$ENV_FILE" << 'EOF'
# Server Configuration
PORT=5120
NODE_ENV=production

# Frontend URL
FRONTEND_URL=http://localhost

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=habitat
DB_PASSWORD=University12345*
DB_NAME=habitate_db

# JWT Secret (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Habitat API Configuration
HABITAT_API_TIMEOUT=5000

# Reservations Sync (optional)
RESERVATIONS_SYNC_ENABLED=false
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠️  Please edit $ENV_FILE and update JWT_SECRET and other values!${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Update PORT in .env if needed
if grep -q "^PORT=" "$ENV_FILE"; then
    sed -i 's/^PORT=.*/PORT=5120/' "$ENV_FILE"
else
    echo "PORT=5120" >> "$ENV_FILE"
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    if [ -f "/root/.nvm/versions/node/v24.13.1/bin/npm" ]; then
        /root/.nvm/versions/node/v24.13.1/bin/npm install -g pm2
    else
        npm install -g pm2
    fi
    echo -e "${GREEN}✓ PM2 installed${NC}"
else
    echo -e "${GREEN}✓ PM2 already installed${NC}"
fi

# Setup PM2 startup script
echo -e "${YELLOW}Setting up PM2 startup...${NC}"
pm2 startup systemd -u root --hp /root || echo "PM2 startup already configured"
echo -e "${GREEN}✓ PM2 startup configured${NC}"

# Install backend dependencies if needed
if [ ! -d "/var/Habitat_New_App/backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd /var/Habitat_New_App/backend
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Create logs directory
mkdir -p /var/Habitat_New_App/backend/logs
echo -e "${GREEN}✓ Logs directory created${NC}"

# Stop existing PM2 process if running
echo -e "${YELLOW}Stopping existing PM2 processes...${NC}"
pm2 stop habitate-backend 2>/dev/null || true
pm2 delete habitate-backend 2>/dev/null || true

# Start with PM2
echo -e "${YELLOW}Starting application with PM2...${NC}"
cd /var/Habitat_New_App/backend
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}✓ Application started with PM2${NC}"

# Setup nginx
echo -e "${YELLOW}Setting up nginx...${NC}"
NGINX_CONF="/etc/nginx/sites-available/habitate"
if [ ! -f "$NGINX_CONF" ]; then
    sudo cp /var/Habitat_New_App/nginx-habitate.conf "$NGINX_CONF"
    echo -e "${GREEN}✓ Nginx configuration created${NC}"
else
    echo -e "${YELLOW}Nginx configuration already exists${NC}"
fi

# Enable site
if [ ! -L "/etc/nginx/sites-enabled/habitate" ]; then
    sudo ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/habitate
    echo -e "${GREEN}✓ Nginx site enabled${NC}"
fi

# Remove default nginx site if it exists
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    sudo rm /etc/nginx/sites-enabled/default
    echo -e "${GREEN}✓ Default nginx site removed${NC}"
fi

# Test nginx configuration
echo -e "${YELLOW}Testing nginx configuration...${NC}"
sudo nginx -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
else
    echo -e "${RED}✗ Nginx configuration has errors${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Setup completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Application Status:"
pm2 status
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check application status"
echo "  pm2 logs                - View application logs"
echo "  pm2 restart habitate-backend - Restart application"
echo "  pm2 stop habitate-backend    - Stop application"
echo "  sudo systemctl status nginx  - Check nginx status"
echo "  sudo nginx -t               - Test nginx config"
echo ""
