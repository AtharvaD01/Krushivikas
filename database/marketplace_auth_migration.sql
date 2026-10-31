USE agricultural_supply_chain;

-- 1. User accounts for buyers and farmers
CREATE TABLE IF NOT EXISTS users (
user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
name VARCHAR(100) NOT NULL,
email VARCHAR(254) NOT NULL,
password_hash VARCHAR(255) NOT NULL,
role ENUM('buyer', 'farmer') NOT NULL,
status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
ON UPDATE CURRENT_TIMESTAMP,
UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- 2. Link user accounts to existing farmer profiles
CREATE TABLE IF NOT EXISTS farmer_accounts (
user_id INT UNSIGNED PRIMARY KEY,
farmer_id INT UNSIGNED NOT NULL UNIQUE,
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT fk_farmer_accounts_user
FOREIGN KEY (user_id) REFERENCES users(user_id),
CONSTRAINT fk_farmer_accounts_farmer
FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id)
) ENGINE=InnoDB;

-- 3. Associate future orders with registered buyers.
-- Existing orders remain valid because this column is nullable.
ALTER TABLE marketplace_orders
ADD COLUMN IF NOT EXISTS buyer_user_id INT UNSIGNED NULL,
ADD INDEX IF NOT EXISTS idx_orders_buyer_user (buyer_user_id);

-- Add the foreign key only if it does not already exist.
SET @fk_exists = (
SELECT COUNT(*)
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
AND TABLE_NAME = 'marketplace_orders'
AND CONSTRAINT_NAME = 'fk_orders_buyer_user'
AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @fk_sql = IF(
@fk_exists = 0,
'ALTER TABLE marketplace_orders ADD CONSTRAINT fk_orders_buyer_user FOREIGN KEY (buyer_user_id) REFERENCES users(user_id)',
'SELECT ''Buyer foreign key already exists'' AS migration_note'
);

PREPARE fk_stmt FROM @fk_sql;
EXECUTE fk_stmt;
DEALLOCATE PREPARE fk_stmt;

-- 4. Record order status changes and tracking events
CREATE TABLE IF NOT EXISTS order_status_history (
event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
order_id INT UNSIGNED NOT NULL,
previous_status VARCHAR(30) NULL,
new_status VARCHAR(30) NOT NULL,
description VARCHAR(500) NULL,
updated_by_user_id INT UNSIGNED NULL,
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT fk_status_history_order
FOREIGN KEY (order_id) REFERENCES marketplace_orders(order_id),
CONSTRAINT fk_status_history_user
FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id),
INDEX idx_status_history_order_time (order_id, created_at)
) ENGINE=InnoDB;

-- 5. Shipment and delivery information
CREATE TABLE IF NOT EXISTS marketplace_shipments (
shipment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
order_id INT UNSIGNED NOT NULL,
farmer_id INT UNSIGNED NULL,
status ENUM(
'preparing', 'ready_for_pickup', 'dispatched',
'in_transit', 'delayed', 'delivered', 'cancelled'
) NOT NULL DEFAULT 'preparing',
carrier_name VARCHAR(120) NULL,
tracking_reference VARCHAR(120) NULL,
dispatched_at DATETIME NULL,
estimated_delivery_at DATETIME NULL,
delivered_at DATETIME NULL,
delay_reason VARCHAR(500) NULL,
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT fk_shipments_order
FOREIGN KEY (order_id) REFERENCES marketplace_orders(order_id),
CONSTRAINT fk_shipments_farmer
FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id),
INDEX idx_shipments_order (order_id),
INDEX idx_shipments_status (status)
) ENGINE=InnoDB;

-- 6. In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
user_id INT UNSIGNED NOT NULL,
order_id INT UNSIGNED NULL,
notification_type VARCHAR(50) NOT NULL,
message VARCHAR(500) NOT NULL,
is_read BOOLEAN NOT NULL DEFAULT FALSE,
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
read_at DATETIME NULL,
CONSTRAINT fk_notifications_user
FOREIGN KEY (user_id) REFERENCES users(user_id),
CONSTRAINT fk_notifications_order
FOREIGN KEY (order_id) REFERENCES marketplace_orders(order_id),
INDEX idx_notifications_user_read_time (user_id, is_read, created_at)
) ENGINE=InnoDB;