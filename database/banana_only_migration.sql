-- KRUSHIVIKAS: convert existing Supply Chain database to banana-only scope.
-- IMPORTANT: Back up agricultural_supply_chain before running this migration.
-- Existing mixed-crop demo chain records are retained and relabelled as banana demo records.
-- Fabricated market-price and demand records are deleted; import official banana mandi data afterwards.

USE agricultural_supply_chain;
SET FOREIGN_KEY_CHECKS = 0;

-- Remove mixed-crop market prices and unsupported demand estimates instead of mislabelling them as banana data.
DELETE FROM market_prices;
DELETE FROM demand;

-- Keep supply-chain records, but align all crop references to the single banana crop.
UPDATE harvest SET crop_id = 1 WHERE crop_id <> 1;
UPDATE wastage SET crop_id = 1 WHERE crop_id <> 1;

UPDATE crops
SET crop_name = 'Banana', crop_type = 'fruit', variety = 'Grand Naine (G-9)'
WHERE crop_id = 1;
DELETE FROM crops WHERE crop_id <> 1;

SET FOREIGN_KEY_CHECKS = 1;

-- Store official market metadata. All prices in price/min/max columns are INR per kg;
-- arrivals_quintal preserves the source unit reported by the Government of India dataset.
ALTER TABLE market_prices
  DROP INDEX uq_price_point,
  ADD COLUMN state VARCHAR(100) NOT NULL DEFAULT '' AFTER market,
  ADD COLUMN district VARCHAR(100) NOT NULL DEFAULT '' AFTER state,
  ADD COLUMN variety VARCHAR(100) NOT NULL DEFAULT '' AFTER district,
  ADD COLUMN grade VARCHAR(50) NOT NULL DEFAULT '' AFTER variety,
  ADD COLUMN min_price DECIMAL(10,2) NULL AFTER price,
  ADD COLUMN max_price DECIMAL(10,2) NULL AFTER min_price,
  ADD COLUMN arrivals_quintal DECIMAL(12,2) NULL AFTER max_price,
  ADD COLUMN source VARCHAR(200) NOT NULL DEFAULT 'data.gov.in / AGMARKNET' AFTER recorded_date,
  ADD COLUMN data_status ENUM('official','demo') NOT NULL DEFAULT 'official' AFTER source,
  ADD UNIQUE KEY uq_price_point (crop_id, market, recorded_date, variety, grade),
  ADD INDEX idx_market_state_district (state, district);

-- Demand is intentionally empty until a defensible banana buyer-demand source is integrated.
-- Price and arrivals are not equivalent to demand.
