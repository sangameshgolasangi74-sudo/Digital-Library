import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { db, initDatabase, hashPassword, verifyPassword } from './server/db.ts';
import { EmailConfigurationError, sendPasswordResetEmail } from './server/email.ts';

initDatabase();

const app = express();

function getPortFromArgs() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1) {
    const value = Number(args[portIndex + 1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  const envPort = Number(process.env.PORT);
  if (Number.isFinite(envPort) && envPort > 0) return envPort;

  return 3000;
}

function getHostFromArgs() {
  const args = process.argv.slice(2);
  const hostIndex = args.indexOf('--host');
  if (hostIndex !== -1 && args[hostIndex + 1]) {
    return args[hostIndex + 1];
  }
  return '0.0.0.0';
}

const PORT = getPortFromArgs();
const HOST = getHostFromArgs();

app.use(express.json({ limit: '8mb' }));

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'owner' | 'admin';
  can_customer: number;
  can_owner: number;
  phone: string;
  address: string;
  institution: string;
  bio: string;
  status: 'active' | 'suspended';
  created_at: string;
}

interface AuthedRequest extends Request {
  user?: AuthUser;
  sessionToken?: string;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies['bb_session'] || null;
}

function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.can_customer, u.can_owner,
           u.phone, u.address, u.institution, u.bio, u.status, u.created_at, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token) as (AuthUser & { expires_at: string }) | undefined;

  if (row && new Date(row.expires_at) > new Date() && row.status === 'active') {
    const { expires_at: _exp, ...safeUser } = row;
    req.user = safeUser;
    req.sessionToken = token;
  }
  next();
}

app.use(attachUser);

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Protected administrator authorization required.' });
  }
  next();
}

function createSession(userId: number, res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  res.setHeader(
    'Set-Cookie',
    `bb_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
  );
  return token;
}

function formatBookRow(row: Record<string, unknown>) {
  let chapters = [];
  try {
    chapters = row.digital_content_json ? JSON.parse(String(row.digital_content_json)) : [];
  } catch {
    chapters = [];
  }
  const { digital_content_json: _raw, ...rest } = row;
  return {
    ...rest,
    digital_chapters: chapters
  };
}

// ---------------- AUTH ROUTES ----------------

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role, phone, institution, address } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (role === 'admin') {
    return res.status(403).json({ error: 'Administrator accounts cannot be registered publicly.' });
  }
  const cleanRole: 'customer' | 'owner' = role === 'owner' ? 'owner' : 'customer';
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, can_customer, can_owner, phone, address, institution, bio)
    VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, ?)
  `).run(
    String(name).trim(),
    normalizedEmail,
    hashPassword(String(password)),
    cleanRole,
    String(phone || '').trim(),
    String(address || '').trim(),
    String(institution || '').trim(),
    ''
  );

  const user = db.prepare('SELECT id, name, email, role, can_customer, can_owner, phone, address, institution, bio, status, created_at FROM users WHERE id = ?').get(info.lastInsertRowid) as AuthUser;
  const sessionToken = createSession(user.id, res);
  res.status(201).json({ user, sessionToken });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, portalRole } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as (AuthUser & { password_hash: string }) | undefined;

  if (!row || !verifyPassword(String(password), row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (row.status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended. Please contact an administrator.' });
  }

  if (portalRole === 'admin' && row.role !== 'admin') {
    return res.status(403).json({ error: 'This portal is restricted to verified Digital Library Administrators.' });
  }
  if (portalRole === 'owner' && !row.can_owner && row.role !== 'admin') {
    return res.status(403).json({ error: 'This account does not have Book Owner access.' });
  }

  const { password_hash: _ph, ...safeUser } = row;
  const sessionToken = createSession(row.id, res);
  res.json({ user: safeUser, sessionToken });
});

app.post('/api/auth/logout', (req: AuthedRequest, res) => {
  if (req.sessionToken) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  }
  res.setHeader('Set-Cookie', 'bb_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: AuthedRequest, res) => {
  res.json({ user: req.user || null });
});

app.post('/api/auth/recover-password', async (req, res) => {
  const { action, email, resetCode, resetToken, newPassword } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Please enter your registered email address.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT id, name, role, status FROM users WHERE email = ?').get(normalizedEmail) as
    | { id: number; name: string; role: string; status: string }
    | undefined;

  const resolvedAction: 'request' | 'verify-otp' | 'reset-password' =
    action === 'verify-otp' || action === 'reset-password' || action === 'request'
      ? action
      : resetToken && newPassword
        ? 'reset-password'
        : resetCode && newPassword
          ? 'reset-password'
          : resetCode
            ? 'verify-otp'
            : 'request';

  // Step 1: Send OTP to registered account
  if (resolvedAction === 'request') {
    if (!user) {
      return res.status(404).json({ error: 'No registered account found with this email address.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account is suspended. Please contact an administrator.' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO password_resets (email, reset_code, expires_at, attempt_count, verified_token)
      VALUES (?, ?, ?, 0, NULL)
    `).run(normalizedEmail, codeHash, expires);

    try {
      await sendPasswordResetEmail(normalizedEmail, code);
      return res.json({
        step: 'otp',
        message: 'A 6-digit OTP has been sent to your registered email address. Check your inbox and spam folder.'
      });
    } catch (error) {
      db.prepare('DELETE FROM password_resets WHERE email = ? AND reset_code = ?').run(normalizedEmail, codeHash);
      console.error(
        'Password reset email delivery failed:',
        error instanceof Error ? error.message : 'Unknown SMTP error'
      );
      if (error instanceof EmailConfigurationError) {
        return res.status(503).json({
          error: 'Email delivery is not configured. Set SMTP_USER and SMTP_PASS (Google App Password) in Secrets and restart.'
        });
      }
      return res.status(503).json({ error: 'Unable to send OTP email right now. Please try again later.' });
    }
  }

  const record = db
    .prepare('SELECT reset_code, expires_at, attempt_count, verified_token FROM password_resets WHERE email = ?')
    .get(normalizedEmail) as
    | { reset_code: string; expires_at: string; attempt_count: number; verified_token: string | null }
    | undefined;

  if (!user || !record || new Date(record.expires_at) < new Date()) {
    db.prepare('DELETE FROM password_resets WHERE email = ?').run(normalizedEmail);
    return res.status(400).json({ error: 'OTP has expired or is invalid. Please request a new OTP.' });
  }

  // Step 2: Verify OTP first, then unlock password reset
  if (resolvedAction === 'verify-otp') {
    if (record.attempt_count >= 5) {
      db.prepare('DELETE FROM password_resets WHERE email = ?').run(normalizedEmail);
      return res.status(400).json({ error: 'Too many invalid OTP attempts. Please request a new OTP.' });
    }

    const cleanCode = String(resetCode || '').trim();
    if (!cleanCode) {
      return res.status(400).json({ error: 'Please enter the 6-digit OTP.' });
    }

    const providedHash = crypto.createHash('sha256').update(cleanCode).digest();
    const storedHash = Buffer.from(record.reset_code, 'hex');
    const codeMatches = storedHash.length === providedHash.length && crypto.timingSafeEqual(storedHash, providedHash);

    if (!codeMatches) {
      const nextAttempts = record.attempt_count + 1;
      if (nextAttempts >= 5) {
        db.prepare('DELETE FROM password_resets WHERE email = ?').run(normalizedEmail);
        return res.status(400).json({ error: 'Too many invalid OTP attempts. Please request a new OTP.' });
      }
      db.prepare('UPDATE password_resets SET attempt_count = attempt_count + 1 WHERE email = ?').run(normalizedEmail);
      return res.status(400).json({ error: 'Incorrect OTP. Please enter the correct 6-digit OTP.' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const extendedExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.prepare('UPDATE password_resets SET verified_token = ?, expires_at = ? WHERE email = ?').run(
      tokenHash,
      extendedExpiry,
      normalizedEmail
    );

    return res.json({
      step: 'new-password',
      resetToken: token,
      message: 'OTP verified. You can now set your new password.'
    });
  }

  // Step 3: Set new password after OTP verification
  if (resetToken) {
    if (!record.verified_token) {
      return res.status(400).json({ error: 'Please verify your OTP first.' });
    }
    const providedTokenHash = crypto.createHash('sha256').update(String(resetToken).trim()).digest();
    const storedTokenHash = Buffer.from(record.verified_token, 'hex');
    const tokenMatches =
      storedTokenHash.length === providedTokenHash.length &&
      crypto.timingSafeEqual(storedTokenHash, providedTokenHash);
    if (!tokenMatches) {
      return res.status(400).json({ error: 'Invalid or expired reset session. Please verify your OTP again.' });
    }
  } else {
    if (record.attempt_count >= 5 || !resetCode) {
      return res.status(400).json({ error: 'Please verify your OTP first.' });
    }
    const providedHash = crypto.createHash('sha256').update(String(resetCode).trim()).digest();
    const storedHash = Buffer.from(record.reset_code, 'hex');
    const codeMatches = storedHash.length === providedHash.length && crypto.timingSafeEqual(storedHash, providedHash);
    if (!codeMatches) {
      return res.status(400).json({ error: 'Incorrect OTP. Please enter the correct 6-digit OTP.' });
    }
  }

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const updatePassword = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(newPassword)), user.id);
    db.prepare('DELETE FROM password_resets WHERE email = ?').run(normalizedEmail);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  });
  updatePassword();
  res.json({ step: 'done', message: 'Password updated successfully. You may now sign in with your new password.' });
});

app.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
  const { name, phone, address, institution, bio } = req.body || {};
  db.prepare(`
    UPDATE users SET name = ?, phone = ?, address = ?, institution = ?, bio = ? WHERE id = ?
  `).run(
    String(name || req.user!.name).trim(),
    String(phone ?? req.user!.phone).trim(),
    String(address ?? req.user!.address).trim(),
    String(institution ?? req.user!.institution).trim(),
    String(bio ?? req.user!.bio).trim(),
    req.user!.id
  );
  const updated = db.prepare('SELECT id, name, email, role, can_customer, can_owner, phone, address, institution, bio, status, created_at FROM users WHERE id = ?').get(req.user!.id);
  res.json({ user: updated });
});

app.patch('/api/auth/password', requireAuth, (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Provide current password and a new password of at least 6 characters.' });
  }
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as { password_hash: string };
  if (!verifyPassword(String(currentPassword), row.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(newPassword)), req.user!.id);
  res.json({ ok: true });
});

// ---------------- PUBLIC CATALOG & COMMUNITY ----------------

app.get('/api/categories', (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*, COUNT(b.id) as book_count
    FROM categories c
    LEFT JOIN books b ON b.category_id = c.id AND b.status != 'archived'
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();
  res.json({ categories: rows });
});

app.get('/api/books', (req, res) => {
  const { q, category, service, condition, maxPrice, digitalOnly, sort } = req.query;
  let sql = `
    SELECT b.*, c.name as category_name, u.name as owner_name, u.institution as owner_institution
    FROM books b
    JOIN categories c ON c.id = b.category_id
    JOIN users u ON u.id = b.owner_id
    WHERE b.status != 'archived'
  `;
  const params: unknown[] = [];

  if (q && String(q).trim()) {
    const like = `%${String(q).trim()}%`;
    sql += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.description LIKE ?)`;
    params.push(like, like, like, like);
  }
  if (category && category !== 'all') {
    sql += ` AND (c.slug = ? OR c.id = ?)`;
    params.push(String(category), Number(category) || -1);
  }
  if (service === 'buy') sql += ` AND b.allow_buy = 1 AND b.stock > 0`;
  if (service === 'exchange') sql += ` AND b.allow_exchange = 1`;
  if (service === 'borrow') sql += ` AND b.allow_borrow = 1`;
  if (service === 'digital' || digitalOnly === '1') sql += ` AND b.is_digital = 1`;
  if (condition && condition !== 'all') {
    sql += ` AND b.condition = ?`;
    params.push(String(condition));
  }
  if (maxPrice && Number(maxPrice) > 0) {
    sql += ` AND b.price <= ?`;
    params.push(Number(maxPrice));
  }

  if (sort === 'price_asc') sql += ` ORDER BY b.price ASC`;
  else if (sort === 'price_desc') sql += ` ORDER BY b.price DESC`;
  else if (sort === 'rating') sql += ` ORDER BY b.rating_avg DESC, b.rating_count DESC`;
  else sql += ` ORDER BY b.created_at DESC, b.id DESC`;

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  res.json({ books: rows.map(formatBookRow) });
});

app.get('/api/books/:id', (req, res) => {
  const row = db.prepare(`
    SELECT b.*, c.name as category_name, u.name as owner_name, u.institution as owner_institution
    FROM books b
    JOIN categories c ON c.id = b.category_id
    JOIN users u ON u.id = b.owner_id
    WHERE b.id = ?
  `).get(Number(req.params.id)) as Record<string, unknown> | undefined;

  if (!row) return res.status(404).json({ error: 'Book not found.' });

  const reviews = db.prepare(`
    SELECT r.*, u.name as user_name
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    WHERE r.book_id = ?
    ORDER BY r.created_at DESC
  `).all(Number(req.params.id));

  res.json({ book: formatBookRow(row), reviews });
});

app.get('/api/stats/public', (_req, res) => {
  const books = (db.prepare("SELECT COUNT(*) as c FROM books WHERE status != 'archived'").get() as { c: number }).c;
  const users = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'admin'").get() as { c: number }).c;
  const digital = (db.prepare("SELECT COUNT(*) as c FROM books WHERE is_digital = 1 AND status != 'archived'").get() as { c: number }).c;
  const exchanges = (db.prepare("SELECT COUNT(*) as c FROM exchanges").get() as { c: number }).c;
  const settingsRows = db.prepare('SELECT key, value FROM site_settings').all() as { key: string; value: string }[];
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  res.json({ stats: { books, users, digital, exchanges }, settings });
});

app.post('/api/newsletter', (req, res) => {
  const { email } = req.body || {};
  if (!email || !String(email).includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  const clean = String(email).trim().toLowerCase();
  db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)').run(clean);
  res.json({ ok: true, message: 'Subscribed to Digital Library quarterly catalog updates.' });
});

app.post('/api/contact', (req: AuthedRequest, res) => {
  const { email, subject, details } = req.body || {};
  if (!subject || !details) {
    return res.status(400).json({ error: 'Subject and message details are required.' });
  }
  db.prepare('INSERT INTO complaints (user_id, user_email, subject, details, status) VALUES (?, ?, ?, ?, ?)').run(
    req.user ? req.user.id : null,
    String(email || req.user?.email || '').trim(),
    String(subject).trim(),
    String(details).trim(),
    'open'
  );
  res.status(201).json({ ok: true, message: 'Your inquiry has been logged with the Digital Library desk.' });
});

// ---------------- CUSTOMER SERVICE ROUTES ----------------

app.post('/api/orders', requireAuth, (req: AuthedRequest, res) => {
  const { items, paymentMethod, shippingName, shippingAddress, shippingPhone } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty.' });
  }
  if (!shippingName || !shippingAddress || !shippingPhone) {
    return res.status(400).json({ error: 'Shipping name, address, and phone are required.' });
  }

  const createdOrderIds: number[] = [];
  const runTx = db.transaction(() => {
    for (const item of items) {
      const bookId = Number(item.bookId);
      const qty = Math.max(1, Number(item.quantity || 1));
      const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as Record<string, unknown> | undefined;
      if (!book || !book.allow_buy) {
        throw new Error('Selected book is not available for purchase.');
      }
      if (Number(book.stock) < qty) {
        throw new Error(`Insufficient stock for "${String(book.title)}".`);
      }
      const total = Number(book.price) * qty;
      const orderRes = db.prepare(`
        INSERT INTO orders (buyer_id, owner_id, book_id, quantity, total_amount, payment_method, payment_status, order_status, shipping_name, shipping_address, shipping_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)
      `).run(
        req.user!.id,
        Number(book.owner_id),
        bookId,
        qty,
        total,
        String(paymentMethod || 'Card'),
        paymentMethod === 'Cash on Delivery' ? 'pending' : 'paid',
        String(shippingName).trim(),
        String(shippingAddress).trim(),
        String(shippingPhone).trim()
      );
      createdOrderIds.push(orderRes.lastInsertRowid as number);

      const newStock = Number(book.stock) - qty;
      db.prepare('UPDATE books SET stock = ?, status = ? WHERE id = ?').run(
        newStock,
        newStock <= 0 && !book.allow_exchange && !book.allow_borrow ? 'sold' : String(book.status),
        bookId
      );

      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        Number(book.owner_id),
        'New Book Order',
        `${req.user!.name} purchased ${qty}x "${String(book.title)}" (₹${total.toLocaleString('en-IN')}).`,
        'order'
      );
    }
  });

  try {
    runTx();
    res.status(201).json({ orderIds: createdOrderIds });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Order failed.' });
  }
});

app.get('/api/orders/my', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT o.*, b.title as book_title, b.author as book_author, b.cover_url as book_cover, u.name as owner_name
    FROM orders o
    JOIN books b ON b.id = o.book_id
    JOIN users u ON u.id = o.owner_id
    WHERE o.buyer_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user!.id);
  res.json({ orders: rows });
});

app.post('/api/exchanges', requireAuth, (req: AuthedRequest, res) => {
  const { requestedBookId, offeredBookId, offeredTitle, offeredCondition, note } = req.body || {};
  const targetBook = db.prepare('SELECT * FROM books WHERE id = ?').get(Number(requestedBookId)) as Record<string, unknown> | undefined;
  if (!targetBook || !targetBook.allow_exchange) {
    return res.status(400).json({ error: 'This book is not enabled for exchange.' });
  }
  if (Number(targetBook.owner_id) === req.user!.id) {
    return res.status(400).json({ error: 'You cannot propose an exchange on your own listing.' });
  }

  let finalOfferedTitle = String(offeredTitle || '').trim();
  let finalOfferedCondition = String(offeredCondition || 'Good').trim();
  let cleanOfferedBookId: number | null = offeredBookId ? Number(offeredBookId) : null;

  if (cleanOfferedBookId) {
    const offeredBook = db.prepare('SELECT title, condition FROM books WHERE id = ? AND owner_id = ?').get(cleanOfferedBookId, req.user!.id) as { title: string; condition: string } | undefined;
    if (offeredBook) {
      finalOfferedTitle = offeredBook.title;
      finalOfferedCondition = offeredBook.condition;
    } else {
      cleanOfferedBookId = null;
    }
  }

  if (!finalOfferedTitle) {
    return res.status(400).json({ error: 'Please specify the book you are offering in exchange.' });
  }

  const info = db.prepare(`
    INSERT INTO exchanges (requester_id, owner_id, requested_book_id, offered_book_id, offered_title, offered_condition, note, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    req.user!.id,
    Number(targetBook.owner_id),
    Number(requestedBookId),
    cleanOfferedBookId,
    finalOfferedTitle,
    finalOfferedCondition,
    String(note || '').trim()
  );

  db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
    Number(targetBook.owner_id),
    'New Exchange Request',
    `${req.user!.name} offered "${finalOfferedTitle}" in exchange for "${String(targetBook.title)}".`,
    'exchange'
  );

  res.status(201).json({ id: info.lastInsertRowid });
});

app.get('/api/exchanges/my', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT e.*, b.title as requested_book_title, b.cover_url as requested_book_cover, u.name as owner_name
    FROM exchanges e
    JOIN books b ON b.id = e.requested_book_id
    JOIN users u ON u.id = e.owner_id
    WHERE e.requester_id = ?
    ORDER BY e.created_at DESC
  `).all(req.user!.id);
  res.json({ exchanges: rows });
});

app.post('/api/borrowings', requireAuth, (req: AuthedRequest, res) => {
  const { bookId, durationDays } = req.body || {};
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(Number(bookId)) as Record<string, unknown> | undefined;
  if (!book || !book.allow_borrow) {
    return res.status(400).json({ error: 'This book is not available for borrowing.' });
  }
  if (Number(book.owner_id) === req.user!.id) {
    return res.status(400).json({ error: 'You cannot borrow your own book listing.' });
  }
  const days = Math.min(30, Math.max(7, Number(durationDays || 14)));
  const dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const info = db.prepare(`
    INSERT INTO borrowings (borrower_id, owner_id, book_id, duration_days, fee_amount, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(req.user!.id, Number(book.owner_id), Number(bookId), days, Number(book.borrow_fee || 0), dueDate);

  db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
    Number(book.owner_id),
    'New Borrow Request',
    `${req.user!.name} requested to borrow "${String(book.title)}" for ${days} days.`,
    'borrow'
  );

  res.status(201).json({ id: info.lastInsertRowid });
});

app.get('/api/borrowings/my', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT br.*, b.title as book_title, b.cover_url as book_cover, u.name as owner_name
    FROM borrowings br
    JOIN books b ON b.id = br.book_id
    JOIN users u ON u.id = br.owner_id
    WHERE br.borrower_id = ?
    ORDER BY br.created_at DESC
  `).all(req.user!.id);
  res.json({ borrowings: rows });
});

app.get('/api/wishlist', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT b.*, c.name as category_name, u.name as owner_name
    FROM wishlist w
    JOIN books b ON b.id = w.book_id
    JOIN categories c ON c.id = b.category_id
    JOIN users u ON u.id = b.owner_id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).all(req.user!.id) as Record<string, unknown>[];
  res.json({ books: rows.map(formatBookRow) });
});

app.post('/api/wishlist/:bookId', requireAuth, (req: AuthedRequest, res) => {
  const bookId = Number(req.params.bookId);
  const exists = db.prepare('SELECT 1 FROM wishlist WHERE user_id = ? AND book_id = ?').get(req.user!.id, bookId);
  if (exists) {
    db.prepare('DELETE FROM wishlist WHERE user_id = ? AND book_id = ?').run(req.user!.id, bookId);
    return res.json({ saved: false });
  }
  db.prepare('INSERT INTO wishlist (user_id, book_id) VALUES (?, ?)').run(req.user!.id, bookId);
  res.json({ saved: true });
});

app.post('/api/reviews', requireAuth, (req: AuthedRequest, res) => {
  const { bookId, rating, comment } = req.body || {};
  const rVal = Math.min(5, Math.max(1, Number(rating || 5)));
  if (!comment || !String(comment).trim()) {
    return res.status(400).json({ error: 'Review comment cannot be empty.' });
  }
  db.prepare('INSERT INTO reviews (book_id, user_id, rating, comment) VALUES (?, ?, ?, ?)').run(
    Number(bookId),
    req.user!.id,
    rVal,
    String(comment).trim()
  );
  const agg = db.prepare('SELECT AVG(rating) as avg_r, COUNT(*) as cnt FROM reviews WHERE book_id = ?').get(Number(bookId)) as { avg_r: number; cnt: number };
  db.prepare('UPDATE books SET rating_avg = ?, rating_count = ? WHERE id = ?').run(Number(agg.avg_r.toFixed(1)), agg.cnt, Number(bookId));
  res.status(201).json({ ok: true });
});

app.get('/api/reviews/my', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT r.*, b.title as book_title
    FROM reviews r
    JOIN books b ON b.id = r.book_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user!.id);
  res.json({ reviews: rows });
});

app.get('/api/digital/progress', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare('SELECT book_id, chapter_index, updated_at FROM digital_progress WHERE user_id = ?').all(req.user!.id);
  res.json({ progress: rows });
});

app.post('/api/digital/:bookId/progress', requireAuth, (req: AuthedRequest, res) => {
  const { chapterIndex } = req.body || {};
  db.prepare(`
    INSERT INTO digital_progress (user_id, book_id, chapter_index, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, book_id) DO UPDATE SET chapter_index = excluded.chapter_index, updated_at = datetime('now')
  `).run(req.user!.id, Number(req.params.bookId), Number(chapterIndex || 0));
  res.json({ ok: true });
});

// ---------------- MESSAGES & NOTIFICATIONS ----------------

app.get('/api/messages', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT m.*, su.name as sender_name, ru.name as receiver_name, b.title as book_title
    FROM messages m
    JOIN users su ON su.id = m.sender_id
    JOIN users ru ON ru.id = m.receiver_id
    LEFT JOIN books b ON b.id = m.book_id
    WHERE m.sender_id = ? OR m.receiver_id = ?
    ORDER BY m.created_at DESC
  `).all(req.user!.id, req.user!.id);
  res.json({ messages: rows });
});

app.post('/api/messages', requireAuth, (req: AuthedRequest, res) => {
  const { receiverId, bookId, body } = req.body || {};
  if (!receiverId || !body || !String(body).trim()) {
    return res.status(400).json({ error: 'Recipient and message text are required.' });
  }
  const info = db.prepare('INSERT INTO messages (sender_id, receiver_id, book_id, body) VALUES (?, ?, ?, ?)').run(
    req.user!.id,
    Number(receiverId),
    bookId ? Number(bookId) : null,
    String(body).trim()
  );
  db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
    Number(receiverId),
    'New Message',
    `${req.user!.name} sent you a message.`,
    'message'
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user!.id);
  res.json({ notifications: rows });
});

app.patch('/api/notifications/read', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true });
});

// ---------------- BOOK OWNER ROUTES ----------------

app.get('/api/owner/books', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT b.*, c.name as category_name
    FROM books b
    JOIN categories c ON c.id = b.category_id
    WHERE b.owner_id = ? AND b.status != 'archived'
    ORDER BY b.created_at DESC
  `).all(req.user!.id) as Record<string, unknown>[];
  res.json({ books: rows.map(formatBookRow) });
});

app.post('/api/owner/books', requireAuth, (req: AuthedRequest, res) => {
  const {
    title, author, isbn, description, categoryId, condition,
    price, borrowFee, allowBuy, allowExchange, allowBorrow,
    isDigital, coverUrl, stock, digitalText
  } = req.body || {};

  if (!title || !author || !isbn || !description || !categoryId) {
    return res.status(400).json({ error: 'Title, author, ISBN, category, and description are required.' });
  }

  const chapters = isDigital && digitalText
    ? [{ title: 'Chapter 1: Full Edition Preview', paragraphs: String(digitalText).split(/\n\n+/).filter(Boolean) }]
    : [];

  const info = db.prepare(`
    INSERT INTO books (
      owner_id, category_id, title, author, isbn, description, condition,
      price, borrow_fee, allow_buy, allow_exchange, allow_borrow, is_digital,
      digital_content_json, cover_url, stock, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
  `).run(
    req.user!.id,
    Number(categoryId),
    String(title).trim(),
    String(author).trim(),
    String(isbn).trim(),
    String(description).trim(),
    String(condition || 'Good'),
    Number(price || 0),
    Number(borrowFee || 0),
    allowBuy ? 1 : 0,
    allowExchange ? 1 : 0,
    allowBorrow ? 1 : 0,
    isDigital ? 1 : 0,
    JSON.stringify(chapters),
    String(coverUrl || 'cover_literature'),
    Math.max(1, Number(stock || 1))
  );

  res.status(201).json({ id: info.lastInsertRowid });
});

app.patch('/api/owner/books/:id', requireAuth, (req: AuthedRequest, res) => {
  const bookId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Book not found.' });
  if (Number(existing.owner_id) !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to edit this listing.' });
  }

  const { title, author, price, borrowFee, condition, stock, allowBuy, allowExchange, allowBorrow, status } = req.body || {};
  db.prepare(`
    UPDATE books SET
      title = ?, author = ?, price = ?, borrow_fee = ?, condition = ?,
      stock = ?, allow_buy = ?, allow_exchange = ?, allow_borrow = ?, status = ?
    WHERE id = ?
  `).run(
    String(title ?? existing.title),
    String(author ?? existing.author),
    Number(price ?? existing.price),
    Number(borrowFee ?? existing.borrow_fee),
    String(condition ?? existing.condition),
    Number(stock ?? existing.stock),
    allowBuy !== undefined ? (allowBuy ? 1 : 0) : Number(existing.allow_buy),
    allowExchange !== undefined ? (allowExchange ? 1 : 0) : Number(existing.allow_exchange),
    allowBorrow !== undefined ? (allowBorrow ? 1 : 0) : Number(existing.allow_borrow),
    String(status ?? existing.status),
    bookId
  );
  res.json({ ok: true });
});

app.delete('/api/owner/books/:id', requireAuth, (req: AuthedRequest, res) => {
  const bookId = Number(req.params.id);
  const existing = db.prepare('SELECT owner_id FROM books WHERE id = ?').get(bookId) as { owner_id: number } | undefined;
  if (!existing) return res.status(404).json({ error: 'Book not found.' });
  if (existing.owner_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to delete this listing.' });
  }
  db.prepare("UPDATE books SET status = 'archived' WHERE id = ?").run(bookId);
  res.json({ ok: true });
});

app.get('/api/owner/orders', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT o.*, b.title as book_title, b.cover_url as book_cover, u.name as buyer_name, u.email as buyer_email
    FROM orders o
    JOIN books b ON b.id = o.book_id
    JOIN users u ON u.id = o.buyer_id
    WHERE o.owner_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user!.id);
  res.json({ orders: rows });
});

app.patch('/api/owner/orders/:id', requireAuth, (req: AuthedRequest, res) => {
  const orderId = Number(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!order || (Number(order.owner_id) !== req.user!.id && req.user!.role !== 'admin')) {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  const { orderStatus, paymentStatus } = req.body || {};
  db.prepare('UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?').run(
    String(orderStatus || order.order_status),
    String(paymentStatus || order.payment_status),
    orderId
  );
  db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
    Number(order.buyer_id),
    'Order Status Updated',
    `Order #${orderId} status changed to ${String(orderStatus || order.order_status)}.`,
    'order'
  );
  res.json({ ok: true });
});

app.get('/api/owner/exchanges', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT e.*, b.title as requested_book_title, b.cover_url as requested_book_cover, u.name as requester_name
    FROM exchanges e
    JOIN books b ON b.id = e.requested_book_id
    JOIN users u ON u.id = e.requester_id
    WHERE e.owner_id = ?
    ORDER BY e.created_at DESC
  `).all(req.user!.id);
  res.json({ exchanges: rows });
});

app.patch('/api/owner/exchanges/:id', requireAuth, (req: AuthedRequest, res) => {
  const exchangeId = Number(req.params.id);
  const ex = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(exchangeId) as Record<string, unknown> | undefined;
  if (!ex || (Number(ex.owner_id) !== req.user!.id && req.user!.role !== 'admin')) {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  const { status } = req.body || {};
  db.prepare('UPDATE exchanges SET status = ? WHERE id = ?').run(String(status), exchangeId);
  db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
    Number(ex.requester_id),
    'Exchange Update',
    `Your exchange proposal for "${String(ex.offered_title)}" was marked ${String(status)}.`,
    'exchange'
  );
  res.json({ ok: true });
});

app.get('/api/owner/borrowings', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT br.*, b.title as book_title, b.cover_url as book_cover, u.name as borrower_name
    FROM borrowings br
    JOIN books b ON b.id = br.book_id
    JOIN users u ON u.id = br.borrower_id
    WHERE br.owner_id = ?
    ORDER BY br.created_at DESC
  `).all(req.user!.id);
  res.json({ borrowings: rows });
});

app.patch('/api/owner/borrowings/:id', requireAuth, (req: AuthedRequest, res) => {
  const borrowId = Number(req.params.id);
  const br = db.prepare('SELECT * FROM borrowings WHERE id = ?').get(borrowId) as Record<string, unknown> | undefined;
  if (!br || (Number(br.owner_id) !== req.user!.id && req.user!.role !== 'admin')) {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  const { status } = req.body || {};
  const returnedAt = status === 'returned' ? new Date().toISOString().slice(0, 10) : br.returned_at;
  db.prepare('UPDATE borrowings SET status = ?, returned_at = ? WHERE id = ?').run(String(status), returnedAt, borrowId);
  db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
    Number(br.borrower_id),
    'Borrow Request Update',
    `Borrow request #${borrowId} is now ${String(status)}.`,
    'borrow'
  );
  res.json({ ok: true });
});

// ---------------- PROTECTED ADMINISTRATOR ROUTES ----------------

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'admin'").get() as { c: number }).c;
  const totalOwners = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'owner'").get() as { c: number }).c;
  const totalBooks = (db.prepare("SELECT COUNT(*) as c FROM books WHERE status != 'archived'").get() as { c: number }).c;
  const digitalBooks = (db.prepare("SELECT COUNT(*) as c FROM books WHERE is_digital = 1 AND status != 'archived'").get() as { c: number }).c;
  const completedOrders = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE order_status != 'cancelled'").get() as { c: number }).c;
  const totalRevenue = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM orders WHERE order_status != 'cancelled'").get() as { s: number }).s;
  const totalExchanges = (db.prepare("SELECT COUNT(*) as c FROM exchanges").get() as { c: number }).c;
  const activeBorrowings = (db.prepare("SELECT COUNT(*) as c FROM borrowings WHERE status IN ('active', 'pending')").get() as { c: number }).c;
  const openComplaints = (db.prepare("SELECT COUNT(*) as c FROM complaints WHERE status != 'resolved'").get() as { c: number }).c;

  const categoryBreakdown = db.prepare(`
    SELECT c.name, COUNT(b.id) as count
    FROM categories c
    LEFT JOIN books b ON b.category_id = c.id AND b.status != 'archived'
    GROUP BY c.id
    ORDER BY count DESC
  `).all();

  res.json({
    metrics: {
      totalUsers,
      totalOwners,
      totalBooks,
      digitalBooks,
      completedOrders,
      totalRevenue,
      totalExchanges,
      activeBorrowings,
      openComplaints
    },
    categoryBreakdown
  });
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT id, name, email, role, can_customer, can_owner, phone, address, institution, status, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows });
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const uid = Number(req.params.id);
  const { status, role } = req.body || {};
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(uid) as AuthUser | undefined;
  if (!existing) return res.status(404).json({ error: 'User not found.' });
  if (existing.role === 'admin') return res.status(400).json({ error: 'Cannot modify primary administrator.' });
  const nextRole = role === 'owner' || role === 'customer' ? role : existing.role;
  const nextStatus = status === 'suspended' || status === 'active' ? status : existing.status;
  db.prepare('UPDATE users SET status = ?, role = ? WHERE id = ?').run(nextStatus, nextRole, uid);
  res.json({ ok: true });
});

app.get('/api/admin/books', requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT b.*, c.name as category_name, u.name as owner_name
    FROM books b
    JOIN categories c ON c.id = b.category_id
    JOIN users u ON u.id = b.owner_id
    ORDER BY b.created_at DESC
  `).all() as Record<string, unknown>[];
  res.json({ books: rows.map(formatBookRow) });
});

app.patch('/api/admin/books/:id', requireAdmin, (req, res) => {
  const { status, isDigital } = req.body || {};
  const book = db.prepare('SELECT status, is_digital FROM books WHERE id = ?').get(Number(req.params.id)) as { status: string; is_digital: number } | undefined;
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  db.prepare('UPDATE books SET status = ?, is_digital = ? WHERE id = ?').run(
    status ?? book.status,
    isDigital !== undefined ? (isDigital ? 1 : 0) : book.is_digital,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Category name is required.' });
  const slug = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  try {
    const info = db.prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)').run(
      String(name).trim(),
      slug,
      String(description || '').trim()
    );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch {
    res.status(409).json({ error: 'Category already exists.' });
  }
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const catId = Number(req.params.id);
  const count = (db.prepare('SELECT COUNT(*) as c FROM books WHERE category_id = ?').get(catId) as { c: number }).c;
  if (count > 0) return res.status(400).json({ error: 'Reassign or archive books in this category before deleting it.' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
  res.json({ ok: true });
});

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT o.*, b.title as book_title, bu.name as buyer_name, ou.name as owner_name
    FROM orders o
    JOIN books b ON b.id = o.book_id
    JOIN users bu ON bu.id = o.buyer_id
    JOIN users ou ON ou.id = o.owner_id
    ORDER BY o.created_at DESC
  `).all();
  res.json({ orders: rows });
});

app.get('/api/admin/exchanges', requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT e.*, b.title as requested_book_title, ru.name as requester_name, ou.name as owner_name
    FROM exchanges e
    JOIN books b ON b.id = e.requested_book_id
    JOIN users ru ON ru.id = e.requester_id
    JOIN users ou ON ou.id = e.owner_id
    ORDER BY e.created_at DESC
  `).all();
  res.json({ exchanges: rows });
});

app.get('/api/admin/borrowings', requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT br.*, b.title as book_title, bu.name as borrower_name, ou.name as owner_name
    FROM borrowings br
    JOIN books b ON b.id = br.book_id
    JOIN users bu ON bu.id = br.borrower_id
    JOIN users ou ON ou.id = br.owner_id
    ORDER BY br.created_at DESC
  `).all();
  res.json({ borrowings: rows });
});

app.get('/api/admin/complaints', requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.name as user_name
    FROM complaints c
    LEFT JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC
  `).all();
  res.json({ complaints: rows });
});

app.patch('/api/admin/complaints/:id', requireAdmin, (req, res) => {
  const { status, adminNote } = req.body || {};
  db.prepare('UPDATE complaints SET status = ?, admin_note = ? WHERE id = ?').run(
    String(status || 'investigating'),
    String(adminNote || ''),
    Number(req.params.id)
  );
  res.json({ ok: true });
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as { key: string; value: string }[];
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

app.patch('/api/admin/settings', requireAdmin, (req, res) => {
  const updates = req.body || {};
  const stmt = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(updates)) {
    stmt.run(String(k), String(v ?? ''));
  }
  res.json({ ok: true });
});

app.get('/Digital-Library.zip', (_req, res) => {
  try {
    const zipName = 'Digital-Library.zip';
    const outPath = path.join(os.tmpdir(), zipName);
    const rootDir = process.cwd();
    const pyScript = `
import os, sys, zipfile
root = sys.argv[1]
out = sys.argv[2]
skip_dirs = {'node_modules', 'dist', '.git', 'build', 'coverage'}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fname in filenames:
            if fname == '.DS_Store' or fname.endswith('.zip') or fname.endswith('.log'):
                continue
            if fname.startswith('bookbridge.db'):
                continue
            if fname.startswith('.env') and fname != '.env.example':
                continue
            if fname == 'bun.lock':
                continue
            full = os.path.join(dirpath, fname)
            rel = os.path.relpath(full, root)
            zf.write(full, os.path.join('Digital-Library', rel))
`;
    execFileSync('python3', ['-c', pyScript, rootDir, outPath], { stdio: 'pipe' });
    res.download(outPath, zipName);
  } catch (err) {
    console.error('Zip export failed:', err);
    res.status(500).json({ error: 'Unable to generate project archive.' });
  }
});

app.get('/BookBridge-Updated.zip', (_req, res) => {
  res.redirect('/Digital-Library.zip');
});

// ---------------- VITE / PRODUCTION STATIC SERVER ----------------

async function startServer() {
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Digital Library server running on http://${HOST}:${PORT}`);
  });
}

startServer();
