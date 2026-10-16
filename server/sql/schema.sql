-- TAZA-PHAL-SABZI.COM — database schema (MySQL 5.7+/8, utf8mb4)

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  phone         VARCHAR(30)  DEFAULT NULL,
  address       VARCHAR(400) DEFAULT NULL,
  address_flat     VARCHAR(30)  DEFAULT NULL,
  address_floor    VARCHAR(30)  DEFAULT NULL,
  address_building VARCHAR(120) DEFAULT NULL,
  address_area     VARCHAR(120) DEFAULT NULL,
  address_city     VARCHAR(60)  DEFAULT NULL,
  address_pin      VARCHAR(10)  DEFAULT NULL,
  default_payment  ENUM('upi','cod') NOT NULL DEFAULT 'cod',
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('customer','admin','delivery') NOT NULL DEFAULT 'customer',
  status        ENUM('active','suspended')        NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(80) NOT NULL UNIQUE,
  emoji      VARCHAR(16) DEFAULT '🥬',
  cat        ENUM('veg','fruits') NOT NULL,
  section    ENUM('kg','bunch','gram','piece_pack','dozen_piece','pack') DEFAULT NULL,
  unit       ENUM('kg','bunch','pack','piece','dozen','100 g') NOT NULL DEFAULT 'kg',
  rate       INT UNSIGNED NOT NULL,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- daily order counter for TS·YY·MM·DD·NN ids (max 99 per day, key = YYMMDD)
CREATE TABLE IF NOT EXISTS order_counters (
  ym      CHAR(6) PRIMARY KEY,
  last_no INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id            VARCHAR(12) PRIMARY KEY,           -- TS·YY·MM·DD·NN e.g. TS26101605
  user_id       INT UNSIGNED NOT NULL,
  customer_name VARCHAR(80)  NOT NULL,             -- snapshot at order time
  address       VARCHAR(400) NOT NULL,
  slot          ENUM('morning','evening') NOT NULL,
  payment       ENUM('upi','cod') NOT NULL,
  delivery_fee  INT UNSIGNED NOT NULL DEFAULT 0,
  discount      DECIMAL(6,1) NOT NULL DEFAULT 0,   -- e.g. 3% UPI discount
  paid          TINYINT(1) NOT NULL DEFAULT 0,     -- payment collected at delivery
  amount        DECIMAL(8,1) NOT NULL,             -- items - discount + delivery fee
  cycle         ENUM('tomorrow','day-after') NOT NULL,
  delivery_date DATE NOT NULL,
  status        ENUM('pending','confirmed','on_way','delivered','rejected') NOT NULL DEFAULT 'pending',
  placed_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_cycle (cycle),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   VARCHAR(12) NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  name       VARCHAR(80) NOT NULL,                 -- snapshot (safe if product changes)
  unit       VARCHAR(10) NOT NULL,
  rate       INT UNSIGNED NOT NULL,
  qty        DECIMAL(5,1) UNSIGNED NOT NULL,       -- supports 0.5 kg steps
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS conversations (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conv_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT UNSIGNED NOT NULL,
  sender          ENUM('customer','admin') NOT NULL,
  text            VARCHAR(1000) NOT NULL,
  read_by_admin   TINYINT(1) NOT NULL DEFAULT 0,
  read_by_customer TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  id            TINYINT PRIMARY KEY DEFAULT 1,
  store_name    VARCHAR(120) NOT NULL DEFAULT 'TAZA-PHAL-SABZI.COM',
  support_phone VARCHAR(30)  NOT NULL DEFAULT '+91 98200 11001',
  delivery_fee  INT UNSIGNED NOT NULL DEFAULT 3,
  cutoff_hour   TINYINT UNSIGNED NOT NULL DEFAULT 22,   -- 10:00 PM cutoff
  morning_slot  TINYINT(1) NOT NULL DEFAULT 1,
  evening_slot  TINYINT(1) NOT NULL DEFAULT 1,
  upi_enabled   TINYINT(1) NOT NULL DEFAULT 1,
  cod_enabled   TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
