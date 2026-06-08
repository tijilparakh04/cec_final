const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./db');

const JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '8h';

const ADMIN_FIELDS = ['username', 'password_hash', 'role', 'country_iso3'];

function requireJwtSecret() {
  if (!JWT_SECRET) throw new Error('Missing ADMIN_JWT_SECRET');
}

function signToken(payload) {
  requireJwtSecret();
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function getAdminByUsername(username) {
  const { rows } = await db.query(
    `SELECT id, username, password_hash, role, country_iso3, active
     FROM admin_users
     WHERE username = $1 AND active = true`,
    [username]
  );
  return rows[0] || null;
}

async function getAdminById(id) {
  const { rows } = await db.query(
    `SELECT id, username, role, country_iso3, active
     FROM admin_users
     WHERE id = $1 AND active = true`,
    [id]
  );
  return rows[0] || null;
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function extractBearer(req) {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function adminAuthMiddleware(req, res, next) {
  try {
    const token = extractBearer(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });

    requireJwtSecret();

    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function scopeFilterForAdmin(admin) {
  // admin: { role, country_iso3, id, username }
  if (!admin || admin.role === 'overall') return { editableIso3: null };
  if (admin.role === 'country' && admin.country_iso3) return { editableIso3: String(admin.country_iso3).toUpperCase() };
  return { editableIso3: undefined };
}

async function getEditableCountries(admin) {
  const scope = scopeFilterForAdmin(admin);
  if (scope.editableIso3 === null) {
    const { rows } = await db.query(
      `SELECT country_id, iso3, country_name, region
       FROM countries
       ORDER BY iso3`
    );
    return rows;
  }
  if (!scope.editableIso3) return [];

  const { rows } = await db.query(
    `SELECT country_id, iso3, country_name, region
     FROM countries
     WHERE UPPER(iso3) = UPPER($1)`,
    [scope.editableIso3]
  );
  return rows;
}

module.exports = {
  signToken,
  verifyPassword,
  getAdminByUsername,
  getAdminById,
  adminAuthMiddleware,
  scopeFilterForAdmin,
  getEditableCountries,
  ADMIN_FIELDS,
};

