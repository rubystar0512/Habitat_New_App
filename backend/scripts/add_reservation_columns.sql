-- Add missing columns to reservations table
-- Run this if you get "Unknown column 'habitat_reservation_id'" error

-- Check if column exists, if not add it
SET @dbname = DATABASE();
SET @tablename = 'reservations';
SET @columnname = 'habitat_reservation_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(100) NULL AFTER commit_id')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index for habitat_reservation_id if it doesn't exist
SET @indexname = 'idx_habitat_reservation_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX ', @indexname, ' (', @columnname, ')')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Alternatively, if the above doesn't work, use this simpler version:
-- ALTER TABLE reservations 
--   ADD COLUMN IF NOT EXISTS habitat_reservation_id VARCHAR(100) NULL AFTER commit_id,
--   ADD INDEX IF NOT EXISTS idx_habitat_reservation_id (habitat_reservation_id);
