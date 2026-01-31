-- Add indexes for commonly sorted columns to improve sort performance
-- Run this script to add missing indexes that help with sorting operations

-- Indexes for numeric columns commonly used in sorting
ALTER TABLE commits ADD INDEX idx_net_change (net_change);
ALTER TABLE commits ADD INDEX idx_additions (additions);
ALTER TABLE commits ADD INDEX idx_deletions (deletions);
ALTER TABLE commits ADD INDEX idx_file_changes (file_changes);
ALTER TABLE commits ADD INDEX idx_author (author);
ALTER TABLE commits ADD INDEX idx_pr_number (pr_number);

-- Composite indexes for common sort combinations
ALTER TABLE commits ADD INDEX idx_habitate_net_change (habitate_score, net_change);
ALTER TABLE commits ADD INDEX idx_habitate_commit_date (habitate_score, commit_date);

-- Note: If indexes already exist, MySQL will show an error but won't break anything
-- You can safely ignore "Duplicate key name" errors
