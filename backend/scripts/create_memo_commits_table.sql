-- Create memo_commits table
-- This table stores commits that users have added to their memo/notes

CREATE TABLE IF NOT EXISTS memo_commits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  commit_id INT NOT NULL,
  priority INT DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_commit (user_id, commit_id),
  INDEX idx_user_id (user_id),
  INDEX idx_commit_id (commit_id),
  INDEX idx_priority (priority),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
