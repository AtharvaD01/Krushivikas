CREATE TABLE IF NOT EXISTS farmer_farm_profiles (
  farmer_id INT UNSIGNED NOT NULL,
  farm_size_acres DECIMAL(10,2) NULL,
  soil_type ENUM('black','alluvial','red','laterite','sandy','clay','loamy','other') NULL,
  irrigation_method ENUM('drip','sprinkler','flood','rainfed','other') NULL,
  primary_crop VARCHAR(100) NULL,
  crop_variety VARCHAR(100) NULL,
  planting_date DATE NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (farmer_id),
  CONSTRAINT fk_farm_profile_farmer
    FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
