#!/bin/bash
# Script to increase MySQL sort buffer size permanently
# This helps prevent "Out of sort memory" errors when sorting large datasets

echo "This script will help you configure MySQL to handle large sort operations."
echo ""
echo "Option 1: Temporary (Current Session Only)"
echo "  Run this SQL command in MySQL:"
echo "  SET SESSION sort_buffer_size = 16777216;"
echo ""
echo "Option 2: Permanent Configuration"
echo "  1. Edit MySQL configuration file (usually /etc/mysql/my.cnf or /etc/my.cnf):"
echo ""
echo "     [mysqld]"
echo "     sort_buffer_size = 16M"
echo "     read_buffer_size = 2M"
echo "     read_rnd_buffer_size = 4M"
echo ""
echo "  2. Restart MySQL:"
echo "     sudo systemctl restart mysql"
echo "     # or"
echo "     sudo service mysql restart"
echo ""
echo "Option 3: Set for specific database user (if you have SUPER privilege)"
echo "  Run this SQL command:"
echo "  SET GLOBAL sort_buffer_size = 16777216;"
echo ""
echo "Current values:"
mysql -u habitate -p'University12345*' habitate_db -e "SHOW VARIABLES LIKE 'sort_buffer_size'; SHOW VARIABLES LIKE 'read_buffer_size'; SHOW VARIABLES LIKE 'read_rnd_buffer_size';" 2>/dev/null
