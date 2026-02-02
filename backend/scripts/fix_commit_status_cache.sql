-- Migration script to fix commit_status_cache to be global per commit (not per account)
-- This removes the account_id dependency since commit status is the same for all team members

-- Step 1: Remove duplicate entries, keeping only the most recent status per commit
-- Create a temporary table with the latest status for each commit
CREATE TEMPORARY TABLE temp_latest_status AS
SELECT 
    commit_id,
    status,
    expires_at,
    checked_at
FROM commit_status_cache
WHERE (commit_id, checked_at) IN (
    SELECT commit_id, MAX(checked_at)
    FROM commit_status_cache
    GROUP BY commit_id
);

-- Step 2: Drop the old unique constraint
ALTER TABLE commit_status_cache 
DROP INDEX unique_status;

-- Step 3: Delete all existing records
DELETE FROM commit_status_cache;

-- Step 4: Insert deduplicated records (without account_id)
INSERT INTO commit_status_cache (commit_id, account_id, status, expires_at, checked_at)
SELECT 
    commit_id,
    NULL as account_id,  -- Set account_id to NULL since status is global
    status,
    expires_at,
    checked_at
FROM temp_latest_status;

-- Step 5: Add new unique constraint on commit_id only
ALTER TABLE commit_status_cache 
ADD UNIQUE INDEX unique_status (commit_id);

-- Step 6: Make account_id nullable (if not already)
ALTER TABLE commit_status_cache 
MODIFY COLUMN account_id INT NULL;

-- Step 7: Drop temporary table
DROP TEMPORARY TABLE temp_latest_status;

-- Verify: Check that we now have one status per commit
-- SELECT commit_id, COUNT(*) as count FROM commit_status_cache GROUP BY commit_id HAVING count > 1;
-- Should return no rows
