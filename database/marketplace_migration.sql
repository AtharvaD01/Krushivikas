-- KRUSHIVIKAS: Marketplace migration
-- MySQL 8 / MariaDB 10.5+
-- Adds marketplace tables without dropping existing data.

USE agricultural_supply_chain;

-- 1. Marketplace listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
    listing_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    harvest_id INT UNSIGNED NOT NULL,
    farmer_id INT UNSIGNED NOT NULL,
    crop_id INT UNSIGNED NOT NULL,

    price_per_kg DECIMAL(10,2) NOT NULL,
    quantity_kg DECIMAL(12,2) NOT NULL,
    available_quantity_kg DECIMAL(12,2) NOT NULL,

    quality ENUM('A','B','C') NOT NULL DEFAULT 'B',
    status ENUM('active','sold_out','paused','cancelled')
        NOT NULL DEFAULT 'active',

    description VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_listing_price CHECK (price_per_kg > 0),
    CONSTRAINT chk_listing_quantity CHECK (quantity_kg > 0),
    CONSTRAINT chk_listing_available CHECK (
        available_quantity_kg >= 0
        AND available_quantity_kg <= quantity_kg
    ),

    CONSTRAINT fk_listing_harvest
        FOREIGN KEY (harvest_id) REFERENCES harvest(harvest_id),
    CONSTRAINT fk_listing_farmer
        FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id),
    CONSTRAINT fk_listing_crop
        FOREIGN KEY (crop_id) REFERENCES crops(crop_id),

    INDEX idx_listing_status (status),
    INDEX idx_listing_crop_status (crop_id, status),
    INDEX idx_listing_farmer (farmer_id)
) ENGINE=InnoDB;


-- 2. Orders
CREATE TABLE IF NOT EXISTS marketplace_orders (
    order_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    buyer_name VARCHAR(100) NOT NULL,
    buyer_contact VARCHAR(20) NULL,
    delivery_address VARCHAR(255) NOT NULL,

    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM(
        'placed',
        'accepted',
        'rejected',
        'dispatched',
        'delivered',
        'cancelled'
    ) NOT NULL DEFAULT 'placed',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_order_total CHECK (total_amount >= 0),
    INDEX idx_order_status (status),
    INDEX idx_order_created (created_at)
) ENGINE=InnoDB;


-- 3. Order items
-- Unit price is captured when the order is placed,
-- so future listing-price changes do not alter old orders.
CREATE TABLE IF NOT EXISTS marketplace_order_items (
    order_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    listing_id INT UNSIGNED NOT NULL,

    quantity_kg DECIMAL(12,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_order_item_quantity CHECK (quantity_kg > 0),
    CONSTRAINT chk_order_item_price CHECK (unit_price > 0),
    CONSTRAINT chk_order_item_total CHECK (line_total > 0),

    CONSTRAINT fk_order_item_order
        FOREIGN KEY (order_id)
        REFERENCES marketplace_orders(order_id),

    CONSTRAINT fk_order_item_listing
        FOREIGN KEY (listing_id)
        REFERENCES marketplace_listings(listing_id),

    INDEX idx_order_item_order (order_id),
    INDEX idx_order_item_listing (listing_id)
) ENGINE=InnoDB;