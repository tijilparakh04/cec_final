# Admin Dashboard - DB Admin Users Setup

This app expects Postgres to store admin accounts and their country scope.

## 1) Create table
Run the SQL below once in your database.

```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id                bigserial PRIMARY KEY,
  username         text NOT NULL UNIQUE,
  password_hash    text NOT NULL,
  role             text NOT NULL CHECK (role IN ('overall','country')),
  country_iso3     text NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  active           boolean NOT NULL DEFAULT true,

  CONSTRAINT admin_users_country_iso3_required
    CHECK (
      (role = 'country' AND country_iso3 IS NOT NULL) OR
      (role = 'overall' AND country_iso3 IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS admin_users_country_iso3_idx
  ON admin_users (country_iso3)
  WHERE active;
```

## 1.1) SQL trigger (optional)
If you want `updated_at` to auto-update:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
CREATE TRIGGER trg_admin_users_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
```


## 2) Add admins
Passwords must be stored as hashes. The backend will use bcrypt.

### Recommended workflow
- Start backend with `bcrypt` and a small helper script to hash passwords.
- Or hash using `node -e` with bcrypt.

Example hash command (run from repo root):

```bash
node -e "const bcrypt=require('bcrypt'); const pw='YOUR_PASSWORD'; bcrypt.hash(pw,10).then(h=>console.log(h));"
```

Then insert:

```sql
-- Overall admin
INSERT INTO admin_users (username, password_hash, role, country_iso3)
VALUES ('admin_overall_1', 'PUT_HASH_HERE', 'overall', NULL);

-- UK-only admin (ISO3 = GBR)
INSERT INTO admin_users (username, password_hash, role, country_iso3)
VALUES ('admin_gbr_1', 'PUT_HASH_HERE', 'country', 'GBR');
```

## 3) Env vars
Backend requires:
- `DATABASE_URL` (existing)
- `ADMIN_JWT_SECRET` (new)

Optional:
- `ADMIN_JWT_EXPIRES_IN` (default: `8h`)

## 4) Editing scope behavior
- `role='overall'` can edit all countries and all facts.
- `role='country'` can edit only rows belonging to `country_iso3`.

```

