USE agricultural_supply_chain;

CREATE TABLE IF NOT EXISTS farm_input_logs (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farmer_id INT UNSIGNED NOT NULL,
  input_type ENUM('fertiliser','pesticide','herbicide','other') NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  application_date DATE NOT NULL,
  target_crop VARCHAR(100) NULL,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_farm_input_farmer
    FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id),
  INDEX idx_farm_input_farmer_date (farmer_id, application_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS farm_irrigation_logs (
  irrigation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farmer_id INT UNSIGNED NOT NULL,
  irrigation_date DATE NOT NULL,
  method ENUM('drip','sprinkler','flood','rainfed','other') NOT NULL,
  duration_minutes INT UNSIGNED NULL,
  water_litres DECIMAL(14,2) NULL,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  target_crop VARCHAR(100) NULL,
  notes VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_farm_irrigation_farmer
    FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id),
  INDEX idx_farm_irrigation_farmer_date (farmer_id, irrigation_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS farm_expenses (
  expense_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farmer_id INT UNSIGNED NOT NULL,
  expense_date DATE NOT NULL,
  category ENUM(
    'seeds','fertiliser','pesticide','labour','irrigation',
    'equipment','transport','packaging','rent','other'
  ) NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  crop_name VARCHAR(100) NULL,
  notes VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_farm_expense_farmer
    FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id),
  INDEX idx_farm_expense_farmer_date (farmer_id, expense_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS farm_harvest_plans (
  plan_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farmer_id INT UNSIGNED NOT NULL,
  crop_name VARCHAR(100) NOT NULL,
  variety VARCHAR(100) NULL,
  planting_date DATE NULL,
  expected_harvest_date DATE NOT NULL,
  estimated_yield_kg DECIMAL(14,2) NOT NULL,
  actual_yield_kg DECIMAL(14,2) NULL,
  expected_price_per_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
  actual_revenue DECIMAL(14,2) NULL,
  status ENUM('planned','harvested','cancelled') NOT NULL DEFAULT 'planned',
  notes VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_farm_plan_farmer
    FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id),
  INDEX idx_farm_plan_farmer_date (farmer_id, expected_harvest_date)
) ENGINE=InnoDB;
