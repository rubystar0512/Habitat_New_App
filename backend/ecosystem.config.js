module.exports = {
  apps: [{
    name: 'habitate-backend',
    script: './server.js',
    cwd: '/var/Habitat_New_App/backend',
    interpreter: '/root/.nvm/versions/node/v24.13.1/bin/node',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5120
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    merge_logs: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
