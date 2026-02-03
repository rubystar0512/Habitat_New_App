-- Add user-customized priority to reservations (for repo/pattern prioritization)
-- Run: mysql -u user -p database < add_reservation_priority.sql

SET @dbname = DATABASE();
SET @tablename = 'reservations';
SET @columnname = 'priority';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE table_schema = @dbname AND table_name = @tablename AND column_name = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE reservations ADD COLUMN priority INT NULL DEFAULT 0'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
