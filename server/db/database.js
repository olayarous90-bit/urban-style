import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio para persistir la base de datos SQLite (usa /tmp en entornos serverless como Vercel)
const DB_DIR = process.env.VERCEL
  ? '/tmp'
  : path.resolve(__dirname, '../../server/data');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'urban_style.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Inicialización de esquemas y tablas
 */
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      formatted_price TEXT,
      image TEXT,
      description TEXT,
      sizes TEXT,
      composition TEXT,
      color TEXT,
      stock INTEGER DEFAULT 50,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_surname TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_doc TEXT NOT NULL,
      delivery_department TEXT NOT NULL,
      delivery_city TEXT NOT NULL,
      delivery_dane_code TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      delivery_neighborhood TEXT,
      delivery_notes TEXT,
      payment_method TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      shipping_cost INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      size TEXT,
      color TEXT,
      subtotal INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      mp_code INTEGER,
      guide_number TEXT,
      carrier_name TEXT NOT NULL,
      carrier_logo TEXT,
      shipping_cost INTEGER NOT NULL,
      delivery_time_hours INTEGER,
      tracking_status TEXT NOT NULL,
      tracking_url TEXT,
      pdf_guide_url TEXT,
      origin_dane_code TEXT NOT NULL,
      destiny_dane_code TEXT NOT NULL,
      raw_payload TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      order_number TEXT,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      html_file_path TEXT,
      sent_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      comment TEXT,
      changed_by TEXT DEFAULT 'SYSTEM',
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS idempotency_records (
      key TEXT PRIMARY KEY,
      order_id INTEGER,
      order_number TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      username TEXT,
      success INTEGER DEFAULT 0,
      attempted_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
    CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
    CREATE INDEX IF NOT EXISTS idx_shipments_guide_number ON shipments(guide_number);
    CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON email_logs(order_id);
    CREATE INDEX IF NOT EXISTS idx_status_history_order_id ON order_status_history(order_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_admin_attempts_ip ON admin_login_attempts(ip_address, attempted_at);
  `);

  // Sembrar usuario administrador por defecto
  seedAdminUser();

  // Sembrar catálogo de productos inicial si está vacío
  seedInitialProducts();
}

function seedInitialProducts() {
  const count = db.prepare('SELECT count(*) as count FROM products').get();
  if (count.count === 0) {
    const insert = db.prepare(`
      INSERT INTO products (id, name, category, price, formatted_price, image, description, sizes, composition, color, stock)
      VALUES (@id, @name, @category, @price, @formattedPrice, @image, @description, @sizes, @composition, @color, @stock)
    `);

    const initialProducts = [
      {
        id: 'prod-1',
        name: "Camiseta Heavyweight 'Urban Artifacts'",
        category: 'Camisetas',
        price: 129900,
        formattedPrice: '$129.900 COP',
        image: '/images/products/prod-tshirt.jpg',
        description: 'Camiseta de corte oversize confeccionada en algodón peinado de 280 gsm.',
        sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
        composition: '100% Algodón Premium Heavyweight',
        color: 'Negro Profundo',
        stock: 50
      },
      {
        id: 'prod-2',
        name: "Hoodie Essential 'Midnight Raw'",
        category: 'Sudaderas',
        price: 249900,
        formattedPrice: '$249.900 COP',
        image: '/images/products/prod-hoodie.jpg',
        description: 'Sudadera premium en felpa francesa perchada de 450 gsm.',
        sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
        composition: '80% Algodón, 20% Poliéster reciclado',
        color: 'Negro Carbón',
        stock: 40
      },
      {
        id: 'prod-3',
        name: "Pantalón Cargo 'Tactical Utility'",
        category: 'Pantalones',
        price: 289900,
        formattedPrice: '$289.900 COP',
        image: '/images/products/prod-pants.jpg',
        description: 'Pantalón técnico con diseño ergonómico de pierna ajustada.',
        sizes: JSON.stringify(['28', '30', '32', '34', '36']),
        composition: '97% Algodón Ripstop, 3% Elastano',
        color: 'Negro Táctico',
        stock: 35
      },
      {
        id: 'prod-4',
        name: "Bomber Jacket 'Cyber Tech'",
        category: 'Chaquetas',
        price: 389900,
        formattedPrice: '$389.900 COP',
        image: '/images/products/prod-jacket.jpg',
        description: 'Chaqueta bomber atemporal confeccionada en nylon técnico impermeable.',
        sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
        composition: 'Nylon balístico repelente al agua',
        color: 'Negro Satinado',
        stock: 25
      },
      {
        id: 'prod-5',
        name: "Sneakers Low-Top 'Apex Monochrome'",
        category: 'Zapatillas',
        price: 459900,
        formattedPrice: '$459.900 COP',
        image: '/images/products/prod-sneakers.jpg',
        description: 'Zapatillas bajas de diseño urbano confeccionadas a mano en piel vacuna mate.',
        sizes: JSON.stringify(['38', '39', '40', '41', '42', '43']),
        composition: 'Cuero genuino vacuno y suela de caucho natural',
        color: 'Negro / Blanco Óptico',
        stock: 30
      },
      {
        id: 'prod-6',
        name: "Bolso Táctico 'Crossbody Sling'",
        category: 'Bolsos',
        price: 159900,
        formattedPrice: '$159.900 COP',
        image: '/images/products/prod-bag.jpg',
        description: 'Bolso bandolera de tamaño compacto con correa ergonómica desmontable.',
        sizes: JSON.stringify(['Talla Única (3.5L)']),
        composition: '100% Cordura Nylon 500D',
        color: 'Negro Mate',
        stock: 60
      },
      {
        id: 'prod-7',
        name: "Gorra Dad Cap 'Minimalist S'",
        category: 'Gorras',
        price: 99900,
        formattedPrice: '$99.900 COP',
        image: '/images/products/prod-cap.jpg',
        description: 'Gorra de 6 paneles no estructurada con visera precurvada.',
        sizes: JSON.stringify(['Ajustable']),
        composition: '100% Algodón Chino Washed',
        color: 'Negro Puro',
        stock: 70
      },
      {
        id: 'prod-8',
        name: "Cadena Cubana 'Geometric Steel'",
        category: 'Accesorios',
        price: 119900,
        formattedPrice: '$119.900 COP',
        image: '/images/products/prod-accessory.jpg',
        description: 'Collar de eslabones cubanos de 10 mm en acero quirúrgico macizo.',
        sizes: JSON.stringify(['55 cm', '65 cm']),
        composition: 'Acero Inoxidable Quirúrgico 316L',
        color: 'Plata Pulida',
        stock: 45
      }
    ];

    const insertMany = db.transaction((products) => {
      for (const prod of products) insert.run(prod);
    });

    insertMany(initialProducts);
  }
}

/**
 * Generación de hash seguro PBKDF2 (120.000 iteraciones SHA-512) para contraseñas administrativas
 */
export function hashPassword(password, salt = crypto.randomBytes(32).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Validación de contraseña contra hash almacenado usando comparación en tiempo constante (timingSafeEqual)
 */
export function verifyPassword(password, storedHash, salt) {
  if (!password || !storedHash || !salt) return false;
  try {
    const computedHash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    const compBuf = Buffer.from(computedHash, 'hex');
    if (storedBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, compBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Inicialización controlada de usuario administrador:
 * Sólo crea administrador si se especifican variables de entorno ADMIN_INIT_USER y ADMIN_INIT_PASSWORD.
 * NUNCA utiliza contraseñas por defecto conocidas ni expone secretos en registros.
 */
function seedAdminUser() {
  const count = db.prepare('SELECT count(*) as count FROM admin_users').get();
  if (count.count === 0) {
    const initUser = process.env.ADMIN_INIT_USER;
    const initPass = process.env.ADMIN_INIT_PASSWORD;
    if (initUser && initPass && initPass.length >= 8) {
      const { hash, salt } = hashPassword(initPass);
      db.prepare(`
        INSERT INTO admin_users (username, password_hash, salt, role, created_at)
        VALUES (?, ?, ?, 'admin', ?)
      `).run(initUser.trim(), hash, salt, new Date().toISOString());
    }
  }
}

// Inicializar de inmediato al importar
initDatabase();

export default db;
