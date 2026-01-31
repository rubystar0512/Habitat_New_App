# Fix for "Out of sort memory" Error

## Quick Fix (Run This First)

Add missing indexes to improve sort performance:

```bash
mysql -u habitate -p'University12345*' habitate_db < backend/scripts/add_sort_indexes.sql
```

This adds indexes on commonly sorted columns:
- net_change
- additions
- deletions
- file_changes
- author
- pr_number
- Composite indexes for common sort combinations

## If Error Persists

If you still get the error after adding indexes, increase MySQL sort buffer size:

1. Edit MySQL config: `/etc/mysql/my.cnf` or `/etc/my.cnf`
2. Add under `[mysqld]`:
   ```
   sort_buffer_size = 16M
   ```
3. Restart MySQL: `sudo systemctl restart mysql`

See `mysql_sort_optimization.md` for detailed instructions.
