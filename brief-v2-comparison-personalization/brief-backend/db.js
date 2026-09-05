const { Pool } = require('pg');

let pool = null;
let dbReady = false;

function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!pool && isConfigured()) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_MAX || 5),
    });
  }
  return pool;
}

async function initDb() {
  if (!isConfigured()) {
    console.warn('DATABASE_URL not configured. Comparison history will run in memory only.');
    return false;
  }
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_locations (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      geohash TEXT,
      city TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id, last_seen_at DESC);
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'grocery',
      subcategory TEXT,
      unit TEXT,
      brand TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stores (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      geohash TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS product_prices (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      price NUMERIC(12,2) NOT NULL,
      delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
      availability BOOLEAN NOT NULL DEFAULT TRUE,
      source TEXT NOT NULL DEFAULT 'manual',
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(product_id, store_id, source)
    );
    CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(product_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS search_history (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      query TEXT NOT NULL,
      product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      geohash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_search_history_product ON search_history(product_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS user_product_activity (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      search_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      compare_count INTEGER NOT NULL DEFAULT 0,
      buy_click_count INTEGER NOT NULL DEFAULT 0,
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, product_id)
    );
  `);
  dbReady = true;
  await seedCatalog();
  return true;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function seedCatalog() {
  const fs = require('fs');
  const path = require('path');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/manual-prices.json'), 'utf8'));
  const grocery = data.grocery || [];
  const p = getPool();
  for (const item of grocery) {
    const product = await p.query(
      `INSERT INTO products (name, normalized_name, category, unit)
       VALUES ($1,$2,'grocery',$3)
       ON CONFLICT (normalized_name) DO UPDATE SET name=EXCLUDED.name, unit=EXCLUDED.unit
       RETURNING id`,
      [item.item, normalize(item.item), item.unit]
    );
    const productId = product.rows[0].id;
    for (const [storeName, price] of Object.entries(item.prices || {})) {
      const store = await p.query(
        `INSERT INTO stores (name, type) VALUES ($1,'grocery')
         ON CONFLICT (name) DO UPDATE SET type=EXCLUDED.type RETURNING id`,
        [storeName]
      );
      await p.query(
        `INSERT INTO product_prices (product_id, store_id, price, source, updated_at)
         VALUES ($1,$2,$3,'manual',NOW())
         ON CONFLICT (product_id, store_id, source)
         DO UPDATE SET price=EXCLUDED.price, updated_at=NOW(), availability=true`,
        [productId, store.rows[0].id, price]
      );
    }
  }
}

async function ensureUser(userId) {
  if (!dbReady || !userId) return;
  await getPool().query(
    `INSERT INTO users(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET last_active_at=NOW()`,
    [userId]
  );
}

async function saveLocation(userId, latitude, longitude, geohash, city) {
  if (!dbReady || !userId) return;
  await ensureUser(userId);
  await getPool().query(
    `INSERT INTO user_locations(user_id,latitude,longitude,geohash,city)
     VALUES($1,$2,$3,$4,$5)`,
    [userId, latitude, longitude, geohash || null, city || null]
  );
}

async function searchProducts(query, limit = 20) {
  if (!dbReady) return [];
  const q = String(query || '').trim();
  if (!q) return [];
  const result = await getPool().query(
    `SELECT id, name, category, subcategory, unit, brand
       FROM products
      WHERE active=true AND (name ILIKE $1 OR brand ILIKE $1 OR normalized_name ILIKE $2)
      ORDER BY CASE WHEN lower(name)=lower($3) THEN 0 WHEN name ILIKE $4 THEN 1 ELSE 2 END, name
      LIMIT $5`,
    [`%${q}%`, `%${normalize(q)}%`, q, `${q}%`, limit]
  );
  return result.rows;
}

async function getComparisons(productId, latitude, longitude) {
  if (!dbReady) return [];
  const result = await getPool().query(
    `SELECT p.id, p.name, p.unit, s.id AS store_id, s.name AS store, pp.price, pp.delivery_fee,
            pp.availability, pp.source, pp.updated_at
       FROM products p
       JOIN product_prices pp ON pp.product_id=p.id
       JOIN stores s ON s.id=pp.store_id
      WHERE p.id=$1 AND pp.availability=true
      ORDER BY pp.price + pp.delivery_fee ASC, s.name`,
    [productId]
  );
  return result.rows;
}

async function recordSearch({ userId, query, productId, latitude, longitude, geohash }) {
  if (!dbReady || !userId) return;
  await ensureUser(userId);
  await getPool().query(
    `INSERT INTO search_history(user_id,query,product_id,latitude,longitude,geohash)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [userId, query, productId || null, latitude ?? null, longitude ?? null, geohash || null]
  );
  if (productId) {
    await getPool().query(
      `INSERT INTO user_product_activity(user_id,product_id,search_count,last_activity_at)
       VALUES($1,$2,1,NOW())
       ON CONFLICT(user_id,product_id)
       DO UPDATE SET search_count=user_product_activity.search_count+1,last_activity_at=NOW()`,
      [userId, productId]
    );
  }
}

async function recordActivity({ userId, productId, type }) {
  if (!dbReady || !userId || !productId) return;
  await ensureUser(userId);
  const allowed = new Set(['view_count', 'compare_count', 'buy_click_count']);
  const column = allowed.has(type) ? type : 'view_count';
  await getPool().query(
    `INSERT INTO user_product_activity(user_id,product_id,${column},last_activity_at)
     VALUES($1,$2,1,NOW())
     ON CONFLICT(user_id,product_id)
     DO UPDATE SET ${column}=user_product_activity.${column}+1,last_activity_at=NOW()`,
    [userId, productId]
  );
}

async function getRecommendations(userId, limit = 8) {
  if (!dbReady || !userId) return [];
  const result = await getPool().query(
    `SELECT p.id,p.name,p.unit,upa.search_count,upa.compare_count,upa.buy_click_count,
            COALESCE(SUM(pp.price + pp.delivery_fee),0) AS price_signal,
            COUNT(pp.id) FILTER (WHERE pp.availability=true) AS available_stores
       FROM user_product_activity upa
       JOIN products p ON p.id=upa.product_id
       LEFT JOIN product_prices pp ON pp.product_id=p.id
      WHERE upa.user_id=$1 AND p.active=true
      GROUP BY p.id,p.name,p.unit,upa.search_count,upa.compare_count,upa.buy_click_count,upa.last_activity_at
      ORDER BY (upa.search_count*3 + upa.compare_count*4 + upa.buy_click_count*6) DESC, upa.last_activity_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function getPopular(limit = 8) {
  if (!dbReady) return [];
  const result = await getPool().query(
    `SELECT p.id,p.name,p.unit,
            COUNT(sh.id) AS search_count,
            COUNT(DISTINCT sh.user_id) AS unique_users
       FROM products p
       LEFT JOIN search_history sh ON sh.product_id=p.id AND sh.created_at > NOW()-INTERVAL '30 days'
      WHERE p.active=true AND p.category='grocery'
      GROUP BY p.id,p.name,p.unit
      ORDER BY COUNT(sh.id) DESC,p.name
      LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = { initDb, isConfigured, ensureUser, saveLocation, searchProducts, getComparisons, recordSearch, recordActivity, getRecommendations, getPopular };
