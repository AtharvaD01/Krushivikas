-- KRUSHIVIKAS — Agricultural Supply Chain schema (MySQL 8 / MariaDB 10.5+)
CREATE DATABASE IF NOT EXISTS agricultural_supply_chain
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agricultural_supply_chain;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW  IF EXISTS v_harvest_flow;
DROP TABLE IF EXISTS wastage, demand, market_prices, retail, distribution, transportation,
                     storage, collection, harvest, crops, farmers;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE farmers (
  farmer_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  contact   VARCHAR(20)  NULL,
  location  VARCHAR(150) NOT NULL,
  INDEX idx_farmers_location (location)
) ENGINE=InnoDB;

CREATE TABLE crops (
  crop_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_name VARCHAR(80) NOT NULL,
  crop_type ENUM('vegetable','cereal','pulse','fruit','oilseed','other') NOT NULL DEFAULT 'other',
  variety   VARCHAR(80) NULL,
  UNIQUE KEY uq_crop_variety (crop_name, variety)
) ENGINE=InnoDB;

CREATE TABLE harvest (
  harvest_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farmer_id    INT UNSIGNED NOT NULL,
  crop_id      INT UNSIGNED NOT NULL,
  quantity     DECIMAL(12,2) NOT NULL CHECK (quantity > 0),
  quality      ENUM('A','B','C') NOT NULL DEFAULT 'B',
  harvest_date DATE NOT NULL,
  location     VARCHAR(150) NOT NULL,
  CONSTRAINT fk_harvest_farmer FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id),
  CONSTRAINT fk_harvest_crop   FOREIGN KEY (crop_id)   REFERENCES crops(crop_id),
  INDEX idx_harvest_date (harvest_date), INDEX idx_harvest_crop (crop_id), INDEX idx_harvest_farmer (farmer_id)
) ENGINE=InnoDB;

CREATE TABLE collection (
  collection_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  harvest_id        INT UNSIGNED NOT NULL,
  collection_center VARCHAR(150) NOT NULL,
  quantity_received DECIMAL(12,2) NOT NULL CHECK (quantity_received >= 0),
  collection_date   DATE NOT NULL,
  CONSTRAINT fk_collection_harvest FOREIGN KEY (harvest_id) REFERENCES harvest(harvest_id) ON DELETE CASCADE,
  INDEX idx_collection_harvest (harvest_id)
) ENGINE=InnoDB;

CREATE TABLE storage (
  storage_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  collection_id    INT UNSIGNED NOT NULL,
  storage_location VARCHAR(150) NOT NULL,
  quantity_stored  DECIMAL(12,2) NOT NULL CHECK (quantity_stored >= 0),
  temperature      DECIMAL(5,2) NULL,
  humidity         DECIMAL(5,2) NULL,
  storage_start    DATE NOT NULL,
  storage_end      DATE NULL,
  CONSTRAINT fk_storage_collection FOREIGN KEY (collection_id) REFERENCES collection(collection_id) ON DELETE CASCADE,
  INDEX idx_storage_collection (collection_id), INDEX idx_storage_location (storage_location)
) ENGINE=InnoDB;

CREATE TABLE transportation (
  transport_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  storage_id           INT UNSIGNED NOT NULL,
  source               VARCHAR(150) NOT NULL,
  destination          VARCHAR(150) NOT NULL,
  vehicle_number       VARCHAR(30)  NOT NULL,
  quantity_transported DECIMAL(12,2) NOT NULL CHECK (quantity_transported >= 0),
  distance             DECIMAL(8,2) NULL,
  transport_date       DATE NOT NULL,
  transport_duration   DECIMAL(6,2) NULL,
  CONSTRAINT fk_transport_storage FOREIGN KEY (storage_id) REFERENCES storage(storage_id) ON DELETE CASCADE,
  INDEX idx_transport_storage (storage_id), INDEX idx_transport_vehicle (vehicle_number)
) ENGINE=InnoDB;

CREATE TABLE distribution (
  distribution_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transport_id      INT UNSIGNED NOT NULL,
  distributor       VARCHAR(150) NOT NULL,
  quantity_received DECIMAL(12,2) NOT NULL CHECK (quantity_received >= 0),
  distribution_date DATE NOT NULL,
  CONSTRAINT fk_distribution_transport FOREIGN KEY (transport_id) REFERENCES transportation(transport_id) ON DELETE CASCADE,
  INDEX idx_distribution_transport (transport_id)
) ENGINE=InnoDB;

CREATE TABLE retail (
  retail_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distribution_id INT UNSIGNED NOT NULL,
  retailer        VARCHAR(150) NOT NULL,
  quantity_sold   DECIMAL(12,2) NOT NULL CHECK (quantity_sold >= 0),
  selling_price   DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
  sale_date       DATE NOT NULL,
  CONSTRAINT fk_retail_distribution FOREIGN KEY (distribution_id) REFERENCES distribution(distribution_id) ON DELETE CASCADE,
  INDEX idx_retail_distribution (distribution_id), INDEX idx_retail_date (sale_date)
) ENGINE=InnoDB;

CREATE TABLE market_prices (
  price_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_id          INT UNSIGNED NOT NULL,
  market           VARCHAR(100) NOT NULL,
  state            VARCHAR(100) NOT NULL DEFAULT '',
  district         VARCHAR(100) NOT NULL DEFAULT '',
  variety          VARCHAR(100) NOT NULL DEFAULT '',
  grade            VARCHAR(50) NOT NULL DEFAULT '',
  price            DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  min_price        DECIMAL(10,2) NULL,
  max_price        DECIMAL(10,2) NULL,
  arrivals_quintal DECIMAL(12,2) NULL,
  recorded_date    DATE NOT NULL,
  source           VARCHAR(200) NOT NULL DEFAULT 'data.gov.in / AGMARKNET',
  data_status      ENUM('official','demo') NOT NULL DEFAULT 'official',
  CONSTRAINT fk_price_crop FOREIGN KEY (crop_id) REFERENCES crops(crop_id) ON DELETE CASCADE,
  UNIQUE KEY uq_price_point (crop_id, market, recorded_date, variety, grade),
  INDEX idx_price_date (recorded_date),
  INDEX idx_market_state_district (state, district)
) ENGINE=InnoDB;

CREATE TABLE demand (
  demand_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_id         INT UNSIGNED NOT NULL,
  market          VARCHAR(100) NOT NULL,
  demand_quantity DECIMAL(12,2) NOT NULL CHECK (demand_quantity >= 0),
  demand_date     DATE NOT NULL,
  CONSTRAINT fk_demand_crop FOREIGN KEY (crop_id) REFERENCES crops(crop_id) ON DELETE CASCADE,
  UNIQUE KEY uq_demand_point (crop_id, market, demand_date),
  INDEX idx_demand_date (demand_date)
) ENGINE=InnoDB;

CREATE TABLE wastage (
  wastage_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_id         INT UNSIGNED NOT NULL,
  stage           ENUM('harvest','collection','storage','transportation','distribution','retail') NOT NULL,
  quantity_wasted DECIMAL(12,2) NOT NULL CHECK (quantity_wasted >= 0),
  reason          VARCHAR(200) NULL,
  recorded_date   DATE NOT NULL,
  CONSTRAINT fk_wastage_crop FOREIGN KEY (crop_id) REFERENCES crops(crop_id) ON DELETE CASCADE,
  INDEX idx_wastage_stage (stage), INDEX idx_wastage_date (recorded_date)
) ENGINE=InnoDB;

-- One row per harvest: quantity surviving each stage (NULL = stage not reached yet).
CREATE VIEW v_harvest_flow AS
SELECT h.harvest_id, h.crop_id, h.farmer_id, h.location, h.harvest_date,
       h.quantity AS q_harvest, c.q AS q_collection, s.q AS q_storage,
       t.q AS q_transport, d.q AS q_distribution, r.q AS q_retail
FROM harvest h
LEFT JOIN (SELECT harvest_id, SUM(quantity_received) q FROM collection GROUP BY harvest_id) c
       ON c.harvest_id = h.harvest_id
LEFT JOIN (SELECT co.harvest_id, SUM(s.quantity_stored) q
           FROM storage s JOIN collection co ON co.collection_id = s.collection_id GROUP BY co.harvest_id) s
       ON s.harvest_id = h.harvest_id
LEFT JOIN (SELECT co.harvest_id, SUM(t.quantity_transported) q
           FROM transportation t JOIN storage s ON s.storage_id = t.storage_id
           JOIN collection co ON co.collection_id = s.collection_id GROUP BY co.harvest_id) t
       ON t.harvest_id = h.harvest_id
LEFT JOIN (SELECT co.harvest_id, SUM(d.quantity_received) q
           FROM distribution d JOIN transportation t ON t.transport_id = d.transport_id
           JOIN storage s ON s.storage_id = t.storage_id
           JOIN collection co ON co.collection_id = s.collection_id GROUP BY co.harvest_id) d
       ON d.harvest_id = h.harvest_id
LEFT JOIN (SELECT co.harvest_id, SUM(r.quantity_sold) q
           FROM retail r JOIN distribution d ON d.distribution_id = r.distribution_id
           JOIN transportation t ON t.transport_id = d.transport_id
           JOIN storage s ON s.storage_id = t.storage_id
           JOIN collection co ON co.collection_id = s.collection_id GROUP BY co.harvest_id) r
       ON r.harvest_id = h.harvest_id;
