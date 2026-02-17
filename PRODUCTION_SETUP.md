# Production Setup Guide

## ✅ Setup Complete

Your application is now running with:
- **Node.js server**: Running on port 5120 with PM2
- **Nginx reverse proxy**: Running on port 80
- **PM2 process manager**: Managing the Node.js application

## 📋 Current Status

### Application Status
- **PM2**: Application is running and will auto-restart on server reboot
- **Nginx**: Configured as reverse proxy, forwarding requests from port 80 to port 5120
- **Health Check**: Both direct (port 5120) and proxied (port 80) endpoints are working

## 🔧 Configuration Files

### Environment Variables
- Location: `/var/Habitat_New_App/backend/.env`
- Port: `5120`
- Make sure to update `JWT_SECRET` for production!

### PM2 Configuration
- Location: `/var/Habitat_New_App/backend/ecosystem.config.js`
- Process name: `habitate-backend`

### Nginx Configuration
- Location: `/etc/nginx/sites-available/habitate`
- Enabled: `/etc/nginx/sites-enabled/habitate`

## 🚀 Useful Commands

### PM2 Commands
```bash
# Check application status
pm2 status

# View logs
pm2 logs habitate-backend

# Restart application
pm2 restart habitate-backend

# Stop application
pm2 stop habitate-backend

# View real-time monitoring
pm2 monit

# Reload application (zero downtime)
pm2 reload habitate-backend
```

### Nginx Commands
```bash
# Test nginx configuration
sudo nginx -t

# Reload nginx (after config changes)
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx

# View nginx error logs
sudo tail -f /var/log/nginx/habitate-error.log

# View nginx access logs
sudo tail -f /var/log/nginx/habitate-access.log
```

### Application Logs
```bash
# PM2 logs
pm2 logs habitate-backend

# Application logs location
/var/Habitat_New_App/backend/logs/
```

### PM2 Log Rotation
PM2 log rotation is configured to automatically rotate logs when they reach 2MB.

**Current Configuration:**
- Max log size: **2MB** (logs rotate when they reach this size)
- Retain: 30 rotated log files
- Check interval: Every 30 seconds
- Daily rotation: At midnight (0 0 * * *)

**Log Rotation Commands:**
```bash
# View log rotation configuration
pm2 conf pm2-logrotate

# Check log rotation status
pm2 describe pm2-logrotate

# Manually trigger log rotation
pm2 flush

# View log rotation module logs
pm2 logs pm2-logrotate
```

## 🌐 Access Points

- **Direct Node.js**: `http://localhost:5120`
- **Via Nginx**: `http://localhost` or `http://your-domain.com`
- **Health Check**: `http://localhost/health` or `http://localhost:5120/health`
- **API Endpoints**: `http://localhost/api/*`
- **Socket.IO**: `http://localhost/socket.io`

## 🔒 Security Recommendations

1. **Update JWT_SECRET** in `.env` file with a strong random string
2. **Configure firewall** to only allow necessary ports
3. **Use HTTPS** in production (set up SSL certificate with Let's Encrypt)
4. **Update database credentials** if using default values
5. **Restrict nginx access** if needed (IP whitelisting)

## 🔄 Updating the Application

1. **Pull latest code**
   ```bash
   cd /var/Habitat_New_App
   git pull  # or your update method
   ```

2. **Install dependencies** (if needed)
   ```bash
   cd /var/Habitat_New_App/backend
   npm install
   ```

3. **Restart application**
   ```bash
   pm2 restart habitate-backend
   ```

## 📝 Troubleshooting

### Application not starting
```bash
# Check PM2 logs
pm2 logs habitate-backend --lines 50

# Check if port is in use
sudo netstat -tlnp | grep 5120
```

### Nginx not proxying correctly
```bash
# Test nginx config
sudo nginx -t

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/habitate-error.log
```

### Database connection issues
```bash
# Check database is running
sudo systemctl status mysql

# Test database connection
mysql -u habitat -p
```

## 🔄 Auto-start on Reboot

PM2 is configured to auto-start on server reboot. To verify:
```bash
pm2 startup
```

## 📊 Monitoring

- **PM2 Dashboard**: `pm2 monit`
- **PM2 Web**: Install `pm2-web` for web-based monitoring
- **System Resources**: Use `htop` or `top` to monitor system resources
