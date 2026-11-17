import 'dotenv/config';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'bookbridge.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'owner', 'admin')),
      can_customer INTEGER NOT NULL DEFAULT 1,
      can_owner INTEGER NOT NULL DEFAULT 1,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      institution TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      email TEXT PRIMARY KEY,
      reset_code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      verified_token TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn TEXT NOT NULL,
      description TEXT NOT NULL,
      condition TEXT NOT NULL CHECK(condition IN ('New', 'Like New', 'Good', 'Fair')),
      price REAL NOT NULL DEFAULT 0,
      borrow_fee REAL NOT NULL DEFAULT 0,
      allow_buy INTEGER NOT NULL DEFAULT 1,
      allow_exchange INTEGER NOT NULL DEFAULT 0,
      allow_borrow INTEGER NOT NULL DEFAULT 0,
      is_digital INTEGER NOT NULL DEFAULT 0,
      digital_content_json TEXT DEFAULT '[]',
      cover_url TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'reserved', 'sold', 'archived')),
      rating_avg REAL NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Card',
      payment_status TEXT NOT NULL DEFAULT 'paid' CHECK(payment_status IN ('paid', 'pending', 'refunded')),
      order_status TEXT NOT NULL DEFAULT 'processing' CHECK(order_status IN ('processing', 'shipped', 'delivered', 'cancelled')),
      shipping_name TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      shipping_phone TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      requested_book_id INTEGER NOT NULL,
      offered_book_id INTEGER,
      offered_title TEXT NOT NULL,
      offered_condition TEXT NOT NULL DEFAULT 'Good',
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS borrowings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrower_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      duration_days INTEGER NOT NULL DEFAULT 14,
      fee_amount REAL NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      returned_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'returned', 'overdue', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, book_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      book_id INTEGER,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'system',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT DEFAULT '',
      subject TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'resolved')),
      admin_note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS digital_progress (
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      chapter_index INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, book_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const resetColumns = db.prepare('PRAGMA table_info(password_resets)').all() as { name: string }[];
  if (!resetColumns.some((column) => column.name === 'attempt_count')) {
    db.exec('ALTER TABLE password_resets ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0');
  }
  if (!resetColumns.some((column) => column.name === 'verified_token')) {
    db.exec('ALTER TABLE password_resets ADD COLUMN verified_token TEXT');
  }

  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  if (userCount === 0) {
    seedDatabase();
  } else {
    migrateDemoAccounts();
  }
  ensureEngineeringCatalogAndINR();
}

const DEFAULT_ADMIN_EMAIL = 'sangameshgolasangi74@gmail.com';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Smarty06K';

function getAdminConfig() {
  return {
    email: (process.env.ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL),
    password: DEFAULT_ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME?.trim() || 'Digital Library Administrator'
  };
}

function migrateDemoAccounts() {
  const demoEmails = [
    'maya.lin@university.edu',
    'arjun.mehta@presshouse.org',
    'clara.vance@humanities.edu',
    'admin@bookbridge.org'
  ];
  const { email: adminEmail, password: adminPassword, name: adminName } = getAdminConfig();

  const migrate = db.transaction(() => {
    let targetAdmin = db.prepare('SELECT id, role FROM users WHERE email = ?').get(adminEmail) as { id: number; role: string } | undefined;

    if (!targetAdmin) {
      const legacyAdmin = db.prepare("SELECT id FROM users WHERE email = 'admin@bookbridge.org' AND role = 'admin'").get() as { id: number } | undefined;
      if (legacyAdmin) {
        db.prepare('UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, can_customer = 1, can_owner = 1, status = ? WHERE id = ?').run(
          adminName,
          adminEmail,
          hashPassword(adminPassword),
          'admin',
          'active',
          legacyAdmin.id
        );
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(legacyAdmin.id);
        db.prepare('DELETE FROM password_resets WHERE email IN (?, ?)').run('admin@bookbridge.org', adminEmail);
        targetAdmin = { id: legacyAdmin.id, role: 'admin' };
      } else {
        const info = db.prepare(`
          INSERT INTO users (name, email, password_hash, role, can_customer, can_owner, phone, address, institution, bio, status)
          VALUES (?, ?, ?, 'admin', 1, 1, '', '', '', 'Platform Administrator.', 'active')
        `).run(adminName, adminEmail, hashPassword(adminPassword));
        targetAdmin = { id: info.lastInsertRowid as number, role: 'admin' };
      }
    } else if (targetAdmin.role !== 'admin') {
      db.prepare("UPDATE users SET name = ?, role = 'admin', can_customer = 1, can_owner = 1, status = 'active' WHERE id = ?").run(
        adminName,
        targetAdmin.id
      );
    }

    const placeholders = demoEmails.map(() => '?').join(', ');
    db.prepare(`
      UPDATE books SET owner_id = ?, rating_avg = 0, rating_count = 0
      WHERE owner_id IN (SELECT id FROM users WHERE email IN (${placeholders}))
    `).run(targetAdmin.id, ...demoEmails);
    db.prepare(`DELETE FROM complaints WHERE user_id IN (SELECT id FROM users WHERE email IN (${placeholders}))`).run(...demoEmails);
    db.prepare(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IN (${placeholders}))`).run(...demoEmails);
    db.prepare(`DELETE FROM password_resets WHERE email IN (${placeholders})`).run(...demoEmails);
    db.prepare(`DELETE FROM users WHERE email IN (${placeholders}) AND email != ?`).run(...demoEmails, adminEmail);
    db.prepare("UPDATE site_settings SET value = ? WHERE key = 'support_email' AND value = 'support@bookbridge.org'").run(
      'sangameshgolasangi74@gmail.com'
    );
    db.prepare("UPDATE site_settings SET value = ? WHERE key = 'site_name' AND value = 'BookBridge'").run(
      'Digital Library'
    );
    db.prepare("UPDATE users SET name = 'Digital Library Administrator' WHERE role = 'admin' AND name = 'BookBridge Administrator'").run();
  });
  migrate();
}

function ensureEngineeringCatalogAndINR() {
  const migrated = db.prepare("SELECT value FROM site_settings WHERE key = 'currency_inr_migrated'").get() as { value: string } | undefined;
  if (migrated?.value === '1') return;

  const ownerRow = db.prepare("SELECT id FROM users WHERE role = 'owner' ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined;
  const fallbackUser = db.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined;
  const ownerId = ownerRow?.id ?? fallbackUser?.id ?? 1;

  // Convert existing seeded USD amounts to Indian Rupee textbook prices (approx 1 USD -> ₹20 Indian academic edition scale)
  db.prepare(`
    UPDATE books SET
      price = CASE WHEN price > 0 AND price < 120 THEN ROUND(price * 20) ELSE price END,
      borrow_fee = CASE WHEN borrow_fee > 0 AND borrow_fee < 30 THEN ROUND(borrow_fee * 15) ELSE borrow_fee END
  `).run();

  db.prepare(`
    UPDATE orders SET
      total_amount = CASE WHEN total_amount > 0 AND total_amount < 150 THEN ROUND(total_amount * 20) ELSE total_amount END
  `).run();

  db.prepare(`
    UPDATE borrowings SET
      fee_amount = CASE WHEN fee_amount > 0 AND fee_amount < 30 THEN ROUND(fee_amount * 15) ELSE fee_amount END
  `).run();

  // Ensure Engineering category exists
  db.prepare(`
    INSERT OR IGNORE INTO categories (name, slug, description)
    VALUES (?, ?, ?)
  `).run(
    'Engineering',
    'engineering',
    'Mechanical, Electronics & VLSI, Civil, Electrical, Control Systems, and Core Engineering Textbooks.'
  );

  const engCat = db.prepare("SELECT id FROM categories WHERE slug = 'engineering'").get() as { id: number };

  const existingEngCount = (db.prepare('SELECT COUNT(*) as c FROM books WHERE category_id = ?').get(engCat.id) as { c: number }).c;
  if (existingEngCount === 0) {
    const insertBook = db.prepare(`
      INSERT INTO books (
        owner_id, category_id, title, author, isbn, description, condition,
        price, borrow_fee, allow_buy, allow_exchange, allow_borrow, is_digital,
        digital_content_json, cover_url, stock, status, rating_avg, rating_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const electronicsChapters = JSON.stringify([
      {
        title: 'Chapter 1: Semiconductor Junctions & Operational Amplifiers',
        paragraphs: [
          'Modern analog and mixed-signal engineering rests on predictable negative-feedback topologies. By characterizing differential input impedance and open-loop gain roll-off, engineers stabilize instrumentation amplifiers across wide thermal ranges.',
          'In undergraduate laboratory courses, pairing physical breadboard manuals with clean SPICE simulation notes eliminates guesswork when debugging BJT biasing networks and active Butterworth filters.'
        ]
      },
      {
        title: 'Chapter 2: CMOS Logic & Timing Closure in VLSI',
        paragraphs: [
          'Static CMOS gates dissipate negligible static power while maintaining full rail-to-rail noise margins. Understanding Elmore delay models and setup/hold slack margins is essential for closing timing on synchronous digital pipelines.',
          'Review the worked timing diagrams in this digital companion before proceeding to the physical hardware lab.'
        ]
      }
    ]);

    const mechanicsChapters = JSON.stringify([
      {
        title: 'Chapter 1: First & Second Laws of Engineering Thermodynamics',
        paragraphs: [
          'Energy conservation in open control volumes forms the backbone of turbine, compressor, and heat-exchanger analysis. By applying steady-flow energy equations alongside enthalpy-entropy Mollier charts, mechanical engineers size power cycles accurately.',
          'Every worked example in this Indian university edition uses SI units (kPa, kJ/kg, Kelvin) aligned with GATE and semester examination syllabi.'
        ]
      },
      {
        title: 'Chapter 2: Vapor Power Cycles & Refrigeration Systems',
        paragraphs: [
          'Rankine cycle regeneration and reheat stages meaningfully elevate thermal efficiency without exceeding metallurgical turbine-blade temperature limits.',
          'Explore the step-by-step steam table exercises included for rapid semester revision.'
        ]
      }
    ]);

    insertBook.run(
      ownerId, engCat.id,
      'Electronics & Circuit Design: Analog to VLSI',
      'Dr. Thomas A. Morgan & Dr. Eliza L. Chen',
      '978-93-5501-412-8',
      'Standard B.Tech / B.E. textbook covering diode circuits, BJT/MOSFET small-signal models, operational amplifiers, and CMOS VLSI fundamentals with solved GATE-style problems.',
      'Like New', 640, 60, 1, 1, 1, 1, electronicsChapters,
      'cover_electronics', 6, 'available', 4.9, 14
    );

    insertBook.run(
      ownerId, engCat.id,
      'Mechanical Engineering & Thermodynamics',
      'Dr. Sarah J. Chen & Dr. Michael R. Vance',
      '978-93-8910-224-6',
      'Comprehensive SI-unit thermodynamics, heat transfer, and Rankine/Brayton power cycle engineering reference with steam table appendices.',
      'New', 780, 75, 1, 1, 1, 1, mechanicsChapters,
      'cover_mechanical', 5, 'available', 4.8, 11
    );

    insertBook.run(
      ownerId, engCat.id,
      'Strength of Materials & Structural Mechanics',
      'Prof. R. K. Subramanian',
      '978-81-2192-645-3',
      'Core Civil and Mechanical Engineering text covering bending moment diagrams, torsion of shafts, column buckling, and Mohr circle stress transformations.',
      'Good', 450, 45, 1, 1, 1, 0, '[]',
      'cover_architecture', 4, 'available', 4.7, 9
    );

    insertBook.run(
      ownerId, engCat.id,
      'Control Systems Engineering & Feedback Theory',
      'Dr. Ananya Kulkarni',
      '978-93-5260-881-4',
      'Clear coverage of Laplace transfer functions, root locus plots, Bode and Nyquist stability criteria, and state-space controller design for Electrical & ECE students.',
      'Like New', 520, 50, 1, 1, 1, 0, '[]',
      'cover_electronics', 3, 'available', 4.8, 7
    );

    insertBook.run(
      ownerId, engCat.id,
      'Operating Systems & Embedded Microcontrollers',
      'Prof. Vikramaditya Nair',
      '978-81-3179-502-1',
      'Covers process scheduling, virtual memory paging, RTOS task synchronization, and ARM Cortex-M peripheral interfacing for Computer & Electronics Engineering.',
      'Good', 590, 55, 1, 1, 1, 0, '[]',
      'cover_algorithms', 4, 'available', 4.7, 8
    );

    insertBook.run(
      ownerId, engCat.id,
      'Fluid Mechanics & Hydraulic Machines',
      'Dr. P. N. Deshmukh',
      '978-81-7409-318-9',
      'Undergraduate Civil & Mechanical textbook detailing Bernoulli energy equations, boundary layer flow, dimensional analysis, and centrifugal pump design.',
      'Fair', 340, 35, 1, 1, 1, 0, '[]',
      'cover_mechanical', 3, 'available', 4.5, 5
    );
  }

  db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('currency_inr_migrated', '1')").run();
}

function seedDatabase() {
  const { email: adminEmail, password: adminPassword, name: adminName } = getAdminConfig();

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, can_customer, can_owner, phone, address, institution, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adminId = insertUser.run(
    adminName,
    adminEmail,
    hashPassword(adminPassword),
    'admin',
    1,
    1,
    '',
    '',
    '',
    'Platform Administrator.'
  ).lastInsertRowid as number;

  const insertCat = db.prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)');
  const catCs = insertCat.run('Computer Science', 'computer-science', 'Algorithms, systems architecture, software engineering, and computation theory.').lastInsertRowid as number;
  const catLit = insertCat.run('Literary Fiction', 'literary-fiction', 'Contemporary novels, translated works, and enduring world classics.').lastInsertRowid as number;
  const catArch = insertCat.run('Architecture & Design', 'architecture-design', 'Spatial studies, urban planning monographs, and typographic craft.').lastInsertRowid as number;
  const catSci = insertCat.run('Environmental Science', 'environmental-science', 'Earth systems, climate science, hydrology, and ecological field guides.').lastInsertRowid as number;
  const catHist = insertCat.run('World History', 'world-history', 'Archival chronicles, diplomatic history, and civic institutions.').lastInsertRowid as number;
  const catOpen = insertCat.run('Open Access Classics', 'open-access-classics', 'Legally verified public-domain and Creative Commons digital books.').lastInsertRowid as number;

  const insertBook = db.prepare(`
    INSERT INTO books (
      owner_id, category_id, title, author, isbn, description, condition,
      price, borrow_fee, allow_buy, allow_exchange, allow_borrow, is_digital,
      digital_content_json, cover_url, stock, status, rating_avg, rating_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const algoChapters = JSON.stringify([
    {
      title: 'Chapter 1: Foundations of Algorithmic Clarity',
      paragraphs: [
        'Every durable software system begins not with premature optimization, but with an exact model of the problem domain. When engineers map memory bounds and asymptotic behavior before writing a single loop, complexity stays predictable even as datasets scale by orders of magnitude.',
        'In collaborative academic environments, sharing annotated problem sets and physical reference editions bridges the gap between abstract notation and real-world system profiling. Consider how graph traversal underpins library citation networks, transit routing, and peer-to-peer book exchange matching.',
        'Throughout this chapter, we examine divide-and-conquer recurrences, amortized analysis of dynamic arrays, and cache-conscious layout strategies that keep latency consistent under heavy institutional workloads.'
      ]
    },
    {
      title: 'Chapter 2: Trees, Heaps & Priority Dispatch',
      paragraphs: [
        'Balanced search trees preserve logarithmic lookup guarantees regardless of insertion order. By maintaining strict structural invariants—whether via red-black coloring or B-tree node splitting—database engines index millions of ISBN records in milliseconds.',
        'Priority queues extend this discipline to scheduling: library hold queues, print dispatch pipelines, and network packet brokers all rely on binary or pairing heaps to surface the highest-urgency item in O(1) peek time.'
      ]
    }
  ]);

  const silentTidesChapters = JSON.stringify([
    {
      title: 'Part I: The Harbor Ledger',
      paragraphs: [
        'Before dawn settled across the stone breakwater, Mara opened the harbor reading room and stacked the returned folios along the oak counter. Salt air always softened the linen bindings by autumn, leaving faint ripples along the endpapers like coastal contours.',
        'Each volume carried pencil marginalia from decades of seafarers, botanists, and apprentices—a quiet conversation stretched across generations of borrowers who never met face to face yet shared the same lamp.'
      ]
    },
    {
      title: 'Part II: Letters from the North Pier',
      paragraphs: [
        'Inside the folio marked 1924, a folded ferry timetable rested between pages eighty and eighty-one. On the reverse, written in steady archival ink, was a list of seven books promised to a village schoolhouse forty miles upriver.',
        'She copied the titles into the morning exchange register, knowing that a book kept in motion multiplies its value with every reader.'
      ]
    }
  ]);

  const earthChapters = JSON.stringify([
    {
      title: 'Unit 1: Watershed Dynamics & Soil Carbon',
      paragraphs: [
        'Terrestrial watersheds act as living hydrological buffers, regulating seasonal runoff while sequestering organic carbon across riparian root zones. Understanding evapotranspiration fluxes requires pairing field lysimeter measurements with long-term catchment records.',
        'Open-access field manuals allow undergraduate cohorts and community conservation groups to standardize sampling protocols without prohibitive textbook licensing fees.'
      ]
    },
    {
      title: 'Unit 2: Atmospheric Energy Budgets',
      paragraphs: [
        'Incoming shortwave solar radiation interacts with cloud albedo, aerosol optical depth, and land-cover reflectance before re-emitting as longwave infrared flux. Accurate regional climate modeling depends on high-resolution ground truth stations.',
        'In the exercises following this unit, students evaluate real watershed hydrographs and compare historical snowpack telemetry across mountain basins.'
      ]
    }
  ]);

  insertBook.run(
    adminId, catCs,
    'Algorithms & Computer Science: A Modern Approach',
    'Claire V. Chen & Liam J. Peters',
    '978-0-262-04819-4',
    'Comprehensive university hardcover covering asymptotic analysis, graph algorithms, dynamic programming, and distributed data structures. Ideal for CS undergraduates and technical interviews.',
    'Like New', 34.50, 4.00, 1, 1, 1, 1, algoChapters,
    'cover_algorithms', 4, 'available', 0, 0
  );

  insertBook.run(
    adminId, catLit,
    'The Silent Tides',
    'Clara Vance',
    '978-1-594-20912-3',
    'Clothbound literary novel exploring coastal community archives, generational memory, and shared public reading rooms. Includes open-access digital reading preview.',
    'New', 22.00, 2.50, 1, 1, 1, 1, silentTidesChapters,
    'cover_literature', 3, 'available', 0, 0
  );

  insertBook.run(
    adminId, catArch,
    'Form & Grid: Architectural Monograph',
    'Alexandra Chen',
    '978-0-714-87421-0',
    'Architectural monograph examining civic timber libraries, daylighting geometry, modular masonry, and human-scale spatial grids across 24 public buildings.',
    'Like New', 42.00, 5.00, 1, 1, 1, 0, '[]',
    'cover_architecture', 2, 'available', 0, 0
  );

  insertBook.run(
    adminId, catSci,
    'Earth & Environmental Science: Fundamentals and Systems',
    'Sarah L. Chen & David R. Miller',
    '978-0-134-55821-9',
    'Illustrated university textbook covering biogeochemical cycles, watershed hydrology, climate modeling, and sustainable resource stewardship. Open digital edition included.',
    'Good', 28.00, 3.00, 1, 1, 1, 1, earthChapters,
    'cover_science', 5, 'available', 0, 0
  );

  insertBook.run(
    adminId, catHist,
    'World History: An Archival Chronicle (Vol. I)',
    'Dr. Marcus Thorne',
    '978-0-199-68412-7',
    'Archival clothbound volume tracing early civic assemblies, maritime trade networks, and manuscript preservation traditions across Eurasia and North Africa.',
    'Good', 31.00, 3.50, 1, 1, 1, 0, '[]',
    'cover_history', 2, 'available', 0, 0
  );

  insertBook.run(
    adminId, catOpen,
    'Open Systems & Civic Knowledge Commons',
    'Hanna Lindqvist',
    '978-1-908-41200-5',
    'Freely licensed Creative Commons treatise on public digital libraries, open educational resources, and cooperative neighborhood lending models.',
    'New', 0, 0, 0, 0, 0, 1, JSON.stringify([
      {
        title: 'Chapter 1: Why Public Knowledge Requires Shared Infrastructure',
        paragraphs: [
          'Access to reliable reference works should never be determined solely by institutional subscription budgets. When students and independent learners pool physical copies alongside verified open-access texts, cost barriers drop dramatically.',
          'Digital Library combines peer-to-peer physical exchange with curated open digital editions so every learner can read immediately while arranging local physical swaps or affordable purchases.'
        ]
      },
      {
        title: 'Chapter 2: Stewardship in Community Book Exchanges',
        paragraphs: [
          'Successful lending circles rely on clear condition grading, transparent return schedules, and direct communication between owners and borrowers.',
          'By recording every loan and swap cleanly, libraries and campus communities foster high trust and sustained circulation.'
        ]
      }
    ]),
    'cover_architecture', 10, 'available', 0, 0
  );

  insertBook.run(
    adminId, catCs,
    'Distributed Systems in Practice (3rd Edition)',
    'Martin K. Halvorsen',
    '978-1-491-90309-4',
    'Clean gently highlighted copy used during Fall Systems Seminar. Happy to swap for an Architecture monograph or sell at student discount.',
    'Good', 26.50, 3.00, 1, 1, 1, 0, '[]',
    'cover_algorithms', 1, 'available', 0, 0
  );

  insertBook.run(
    adminId, catLit,
    'Selected Essays on Typography & Reading Rooms',
    'Julian Mercer',
    '978-0-879-23188-2',
    'Compact linen edition reflecting on bookbinding craft, serif legibility, and why quiet reading spaces remain essential civic anchors.',
    'Like New', 19.00, 2.00, 1, 1, 1, 0, '[]',
    'cover_literature', 2, 'available', 0, 0
  );

  // Seed Site Settings
  const insertSetting = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)');
  insertSetting.run('site_name', 'Digital Library');
  insertSetting.run('support_email', 'sangameshgolasangi74@gmail.com');
  insertSetting.run('support_phone', '+1 (800) 555-0194');
  insertSetting.run('campus_hub_address', '210 Civic Library Square, Reading Hall B');
  insertSetting.run('default_borrow_days', '14');
  insertSetting.run('exchange_service_fee', '0.00');
  insertSetting.run('announcement_banner', 'Open Access Week: 100% zero-fee book exchanges across all university & public hubs.');
}
