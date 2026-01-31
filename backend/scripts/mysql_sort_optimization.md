# MySQL Sort Buffer Optimization

## Problem
When sorting large datasets, MySQL may run out of sort memory with the error:
```
Out of sort memory, consider increasing server sort buffer size
```

## Solution 1: Add Missing Indexes (RECOMMENDED FIRST)

Run the SQL script to add indexes for commonly sorted columns:
```bash
mysql -u habitate -p habitate_db < backend/scripts/add_sort_indexes.sql
```

This will significantly improve sort performance by allowing MySQL to use indexes instead of sorting all rows in memory.

## Solution 2: Increase MySQL Sort Buffer Size

If indexes don't solve the issue, increase MySQL's sort buffer size.

### Temporary (Current Session Only)
```sql
SET SESSION sort_buffer_size = 16777216; -- 16MB
```

### Permanent Configuration

1. Edit MySQL configuration file (usually `/etc/mysql/my.cnf` or `/etc/my.cnf`):
```ini
[mysqld]
sort_buffer_size = 16M
read_buffer_size = 2M
read_rnd_buffer_size = 4M
```

2. Restart MySQL:
```bash
sudo systemctl restart mysql
# or
sudo service mysql restart
```

### Recommended Values
- **sort_buffer_size**: 8M - 16M (default is usually 256K-2M)
- **read_buffer_size**: 1M - 2M
- **read_rnd_buffer_size**: 2M - 4M

### Check Current Values
```sql
SHOW VARIABLES LIKE 'sort_buffer_size';
SHOW VARIABLES LIKE 'read_buffer_size';
SHOW VARIABLES LIKE 'read_rnd_buffer_size';
```

## Solution 3: Optimize Query

The backend code has been optimized to:
1. Use separate count queries (doesn't need to sort)
2. Use indexed columns for sorting
3. Limit result sets with pagination

## Monitoring

Check if sort operations are using temporary tables (indicates sort buffer is too small):
```sql
SHOW STATUS LIKE 'Sort%';
```

Look for:
- `Sort_merge_passes`: Should be low (0-1). High values indicate sort buffer is too small.
- `Sort_range`: Number of sorts done using ranges
- `Sort_rows`: Number of sorted rows

## Best Practices

1. **Always add indexes** on columns used in ORDER BY
2. **Use LIMIT** to reduce the amount of data being sorted
3. **Filter before sorting** - apply WHERE clauses before ORDER BY
4. **Use composite indexes** for common sort combinations (e.g., `habitate_score, net_change`)
