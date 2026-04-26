'use strict';

import Database from 'libsql'; 
import path from 'path';
import { fileURLToPath } from 'url';

/* --------------------------------------------------
   DB INIT
-------------------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// database file at: server/data.sqlite
const dbPath = path.join(__dirname, '..', 'data.sqlite');

// Initialize database with retry logic
let db;
let connectionAttempts = 0;
const maxRetries = 3;

function initializeDatabase() {
  try {
    db = new Database(process.env.TURSO_DATABASE_URL, {authToken: process.env.TURSO_AUTH_TOKEN});
    console.log('✅ Database connection established');
    connectionAttempts = 0;
    return db;
  } catch (error) {
    connectionAttempts++;
    console.error(`❌ Database connection failed (attempt ${connectionAttempts}/${maxRetries}):`, error.message);
    
    if (connectionAttempts < maxRetries) {
      console.log(`⏳ Retrying in 2 seconds...`);
      setTimeout(initializeDatabase, 2000);
    } else {
      console.error('❌ Max connection retries exceeded');
      throw error;
    }
  }
}

// Initialize on module load
db = initializeDatabase();



/* --------------------------------------------------
   SCHEMA MIGRATION - Make firm_id nullable
-------------------------------------------------- */

try {
  // Check if users table exists and has NOT NULL constraint on firm_id
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const firmIdColumn = tableInfo.find(col => col.name === 'firm_id');
    
    if (firmIdColumn && firmIdColumn.notnull === 1) {
      // Need to migrate - firm_id is NOT NULL, need to make it nullable
      console.log('🔄 Migrating users table to make firm_id nullable...');
      
      db.exec(`
        BEGIN TRANSACTION;
        
        ALTER TABLE users RENAME TO users_backup;
        
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          fullname TEXT NOT NULL,
          password TEXT NOT NULL,
          role TEXT CHECK(role IN ('user','manager','admin','super_admin')) DEFAULT 'user',
          firm_id INTEGER,
          status TEXT CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending',
          last_mail_sent TEXT,
          last_login TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
        ) STRICT;
        
        INSERT INTO users SELECT * FROM users_backup;
        DROP TABLE users_backup;
        
        COMMIT;
      `);
      
      console.log('✅ Migration complete - firm_id is now nullable');
    }
  } catch (migrationErr) {
    console.log('ℹ️  Schema migration skipped:', migrationErr.message);
  }
} catch (err) {
  console.log('ℹ️  Schema migration skipped (table may already be correct)');
}

/* --------------------------------------------------
   SCHEMA - WITH MULTI-FIRM SUPPORT
-------------------------------------------------- */

try {
  db.exec(`
-- FIRMS
CREATE TABLE IF NOT EXISTS firms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  description TEXT,
  legal_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  pincode TEXT,
  phone_number TEXT,
  secondary_phone TEXT,
  email TEXT,
  website TEXT,
  business_type TEXT,
  industry_type TEXT,
  establishment_year INTEGER,
  employee_count INTEGER,
  registration_number TEXT,
  registration_date TEXT,
  cin_number TEXT,
  pan_number TEXT,
  gst_number TEXT,
  tax_id TEXT,
  vat_number TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  ifsc_code TEXT,
  payment_terms TEXT,
  status TEXT CHECK(status IN ('pending','approved','rejected')) DEFAULT 'approved',
  license_numbers TEXT,
  insurance_details TEXT,
  currency TEXT DEFAULT 'INR',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  fiscal_year_start TEXT,
  invoice_prefix TEXT,
  quote_prefix TEXT,
  po_prefix TEXT,
  logo_url TEXT,
  invoice_template TEXT,
  enable_e_invoice INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  fullname TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT CHECK(role IN ('user','manager','admin','super_admin')) DEFAULT 'user',
  firm_id INTEGER,
  status TEXT CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending',
  last_mail_sent TEXT,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
) STRICT;

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

-- MASTER ROLLS (WITH FIRM_ID AND USER TRACKING)
CREATE TABLE IF NOT EXISTS master_rolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  employee_name TEXT NOT NULL,
  father_husband_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  aadhar TEXT NOT NULL,
  pan TEXT,
  phone_no TEXT NOT NULL,
  address TEXT NOT NULL,
  bank TEXT NOT NULL,
  account_no TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  branch TEXT,
  uan TEXT,
  esic_no TEXT,
  s_kalyan_no TEXT,
  category TEXT DEFAULT 'UNSKILLED',
  p_day_wage REAL,
  project TEXT,
  site TEXT,
  date_of_joining TEXT NOT NULL,
  date_of_exit TEXT,
  doe_rem TEXT,
  status TEXT DEFAULT 'Active',
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) STRICT;

-- WAGES (WITH FIRM_ID AND USER TRACKING)
CREATE TABLE IF NOT EXISTS wages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  master_roll_id INTEGER NOT NULL,
  p_day_wage REAL,
  wage_days INTEGER DEFAULT 26,
  project TEXT,
  site TEXT,
  gross_salary REAL,
  epf_deduction REAL,
  esic_deduction REAL,
  other_deduction REAL,
  other_benefit REAL,
  net_salary REAL,
  salary_month TEXT NOT NULL,
  paid_date TEXT,
  cheque_no TEXT,
  paid_from_bank_ac TEXT,
  created_by INTEGER NOT NULL,
  updated_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY (master_roll_id) REFERENCES master_rolls(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
) STRICT;

-- USER ↔ MASTER ROLL (MANY TO MANY) - Optional for assignment tracking
CREATE TABLE IF NOT EXISTS user_master_rolls (
  user_id INTEGER NOT NULL,
  master_roll_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, master_roll_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (master_roll_id) REFERENCES master_rolls(id) ON DELETE CASCADE
) STRICT;

-- USER ↔ WAGE (MANY TO MANY) - Optional for wage processing tracking
CREATE TABLE IF NOT EXISTS user_wages (
  user_id INTEGER NOT NULL,
  wage_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, wage_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wage_id) REFERENCES wages(id) ON DELETE CASCADE
) STRICT;

-- INVENTORY: STOCKS (WITH BATCH SUPPORT)
CREATE TABLE IF NOT EXISTS stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  pno TEXT,
  oem TEXT,
  hsn TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  uom TEXT NOT NULL DEFAULT 'pcs',
  rate REAL NOT NULL DEFAULT 0,
  grate REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  mrp REAL,
  batches TEXT,
  user TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
) STRICT;

-- INVENTORY: PARTIES (CUSTOMERS/SUPPLIERS)
CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  firm TEXT NOT NULL,
  gstin TEXT DEFAULT 'UNREGISTERED',
  contact TEXT,
  state TEXT,
  state_code TEXT,
  addr TEXT,
  pin TEXT,
  pan TEXT,
  usern TEXT,
  supply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
) STRICT;

-- INVENTORY: BILLS (SALES/PURCHASE INVOICES)
CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  bno TEXT NOT NULL,
  bdate TEXT NOT NULL,
  supply TEXT,
  addr TEXT,
  gstin TEXT,
  state TEXT,
  pin TEXT,
  state_code TEXT,
  gtot REAL NOT NULL DEFAULT 0,
  ntot REAL NOT NULL DEFAULT 0,
  rof REAL DEFAULT 0,
  btype TEXT DEFAULT 'SALES',
  usern TEXT,
  firm TEXT,
  party_id INTEGER,
  oth_chg_json TEXT,
  order_no TEXT,
  vehicle_no TEXT,
  dispatch_through TEXT,
  narration TEXT,
  reverse_charge INTEGER DEFAULT 0,
  cgst REAL DEFAULT 0,
  sgst REAL DEFAULT 0,
  igst REAL DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  cancellation_reason TEXT,
  cancelled_at TEXT,
  cancelled_by INTEGER,
  consignee_name TEXT,
  consignee_gstin TEXT,
  consignee_address TEXT,
  consignee_state TEXT,
  consignee_pin TEXT,
  consignee_state_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL,
  FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
) STRICT;

-- INVENTORY: STOCK REGISTER (STOCK MOVEMENTS)
CREATE TABLE IF NOT EXISTS stock_reg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  bno TEXT,
  bdate TEXT,
  supply TEXT,
  item TEXT NOT NULL,
  item_narration TEXT,
  batch TEXT,
  hsn TEXT,
  qty REAL NOT NULL,
  uom TEXT,
  rate REAL DEFAULT 0,
  grate REAL DEFAULT 0,
  disc REAL DEFAULT 0,
  total REAL DEFAULT 0,
  stock_id INTEGER,
  bill_id INTEGER,
  user TEXT,
  firm TEXT,
  qtyh REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE SET NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL
) STRICT;

-- ACCOUNTING: LEDGER (GENERAL LEDGER ENTRIES)
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  voucher_id INTEGER,
  voucher_type TEXT,
  voucher_no TEXT,
  account_head TEXT NOT NULL,
  account_type TEXT,
  debit_amount REAL DEFAULT 0,
  credit_amount REAL DEFAULT 0,
  narration TEXT,
  bill_id INTEGER,
  party_id INTEGER,
  tax_type TEXT,
  tax_rate REAL,
  transaction_date TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL
) STRICT;

-- BILL SEQUENCES (FOR BILL NUMBER GENERATION)
CREATE TABLE IF NOT EXISTS bill_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  financial_year TEXT NOT NULL,
  last_sequence INTEGER DEFAULT 0,
  voucher_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(firm_id, financial_year, voucher_type),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
) STRICT;

-- GLOBAL SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

-- FIRM-SPECIFIC SETTINGS
CREATE TABLE IF NOT EXISTS firm_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(firm_id, setting_key),
  FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
) STRICT;
`);
} catch (err) {
  console.log('ℹ️  Schema initialization skipped:', err.message);
}

/* --------------------------------------------------
   INDEXES FOR PERFORMANCE
-------------------------------------------------- */

// Create indexes if they don't exist - wrapped in try-catch for safety
try {
  db.exec(`
  -- Unique index on aadhar per firm (employee can't be duplicated within a firm)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_master_rolls_aadhar_firm 
  ON master_rolls(aadhar, firm_id);

  -- Index on firm_id for faster filtering
  CREATE INDEX IF NOT EXISTS idx_master_rolls_firm_id 
  ON master_rolls(firm_id);

  -- Index on wages firm_id
  CREATE INDEX IF NOT EXISTS idx_wages_firm_id 
  ON wages(firm_id);

  -- Compound index on wages for efficient month-based queries
  CREATE INDEX IF NOT EXISTS idx_wages_firm_month 
  ON wages(firm_id, salary_month);

  -- Unique constraint on wages (firm_id, master_roll_id, salary_month)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_wages_unique_firm_employee_month 
  ON wages(firm_id, master_roll_id, salary_month);

  -- Index on wages master_roll_id
  CREATE INDEX IF NOT EXISTS idx_wages_master_roll_id 
  ON wages(master_roll_id);

  -- Index on master_rolls dates for wage eligibility queries
  CREATE INDEX IF NOT EXISTS idx_master_rolls_joining_date 
  ON master_rolls(date_of_joining);

  CREATE INDEX IF NOT EXISTS idx_master_rolls_exit_date 
  ON master_rolls(date_of_exit);

  -- Index on users firm_id
  CREATE INDEX IF NOT EXISTS idx_users_firm_id 
  ON users(firm_id);

  -- Index on refresh tokens for cleanup
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id 
  ON refresh_tokens(user_id);

  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at 
  ON refresh_tokens(expires_at);

  -- Full-text search indexes (optional - for better search performance)
  CREATE INDEX IF NOT EXISTS idx_master_rolls_employee_name 
  ON master_rolls(employee_name);

  CREATE INDEX IF NOT EXISTS idx_master_rolls_project 
  ON master_rolls(project);

  CREATE INDEX IF NOT EXISTS idx_master_rolls_site 
  ON master_rolls(site);

  -- Index on payment tracking fields
  CREATE INDEX IF NOT EXISTS idx_wages_paid_date 
  ON wages(paid_date);

  -- INVENTORY INDEXES
  CREATE INDEX IF NOT EXISTS idx_stocks_firm_id 
  ON stocks(firm_id);

  CREATE INDEX IF NOT EXISTS idx_stocks_item 
  ON stocks(item);

  CREATE INDEX IF NOT EXISTS idx_stocks_hsn 
  ON stocks(hsn);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_stocks_firm_item 
  ON stocks(firm_id, item);

  -- PARTIES INDEXES
  CREATE INDEX IF NOT EXISTS idx_parties_firm_id 
  ON parties(firm_id);

  CREATE INDEX IF NOT EXISTS idx_parties_firm 
  ON parties(firm);

  CREATE INDEX IF NOT EXISTS idx_parties_gstin 
  ON parties(gstin);

  -- BILLS INDEXES
  CREATE INDEX IF NOT EXISTS idx_bills_firm_id 
  ON bills(firm_id);

  CREATE INDEX IF NOT EXISTS idx_bills_bno 
  ON bills(bno);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_firm_bno 
  ON bills(firm_id, bno);

  CREATE INDEX IF NOT EXISTS idx_bills_bdate 
  ON bills(bdate);

  CREATE INDEX IF NOT EXISTS idx_bills_party_id 
  ON bills(party_id);

  CREATE INDEX IF NOT EXISTS idx_bills_status 
  ON bills(status);

  -- STOCK REGISTER INDEXES
  CREATE INDEX IF NOT EXISTS idx_stock_reg_firm_id 
  ON stock_reg(firm_id);

  CREATE INDEX IF NOT EXISTS idx_stock_reg_stock_id 
  ON stock_reg(stock_id);

  CREATE INDEX IF NOT EXISTS idx_stock_reg_bill_id 
  ON stock_reg(bill_id);

  CREATE INDEX IF NOT EXISTS idx_stock_reg_type 
  ON stock_reg(type);

  CREATE INDEX IF NOT EXISTS idx_stock_reg_bdate 
  ON stock_reg(bdate);

  -- LEDGER INDEXES
  CREATE INDEX IF NOT EXISTS idx_ledger_firm_id 
  ON ledger(firm_id);

  CREATE INDEX IF NOT EXISTS idx_ledger_voucher_id 
  ON ledger(voucher_id);

  CREATE INDEX IF NOT EXISTS idx_ledger_bill_id 
  ON ledger(bill_id);

  CREATE INDEX IF NOT EXISTS idx_ledger_party_id 
  ON ledger(party_id);

  CREATE INDEX IF NOT EXISTS idx_ledger_account_head 
  ON ledger(account_head);

  CREATE INDEX IF NOT EXISTS idx_ledger_transaction_date 
  ON ledger(transaction_date);

  -- BILL SEQUENCES INDEXES
  CREATE INDEX IF NOT EXISTS idx_bill_sequences_firm_id 
  ON bill_sequences(firm_id);

  -- SETTINGS INDEXES
  CREATE INDEX IF NOT EXISTS idx_firm_settings_firm_id 
  ON firm_settings(firm_id);
  `);
  console.log('✅ All indexes created successfully');
} catch (err) {
  if (err.message.includes('no such column') || err.message.includes('no such table')) {
    console.log('ℹ️  Some indexes skipped (tables may not exist yet or columns missing):', err.message);
  } else {
    console.error('❌ Error creating indexes:', err.message);
  }
}


/* --------------------------------------------------
   PREPARED STATEMENTS (UTILS)
-------------------------------------------------- */

function addColumnIfNotExists(table, columnDef) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    console.log(`✅ Added column: ${table}.${columnDef}`);
  } catch (err) {
    if (err.message.includes('duplicate column name')) {
      // Column already exists, this is fine
      return;
    }
    if (err.message.includes('502 Bad Gateway') || err.message.includes('Hrana')) {
      console.log(`⚠️  Skipped column addition (database unavailable): ${table}.${columnDef}`);
      return;
    }
    // Log other errors but don't crash
    console.log(`ℹ️  Column addition skipped: ${table}.${columnDef} - ${err.message}`);
  }
}

/* ---- users missing columns ---- */
addColumnIfNotExists('users', "status TEXT CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending'");

/* ---- master_rolls missing columns ---- */
addColumnIfNotExists('master_rolls', 'branch TEXT');
addColumnIfNotExists('master_rolls', 'created_by INTEGER');
addColumnIfNotExists('master_rolls', 'updated_by INTEGER');
addColumnIfNotExists('master_rolls', "status TEXT DEFAULT 'Active'");

/* ---- wages missing columns ---- */
addColumnIfNotExists('wages', 'project TEXT');
addColumnIfNotExists('wages', 'site TEXT');
addColumnIfNotExists('wages', 'epf_deduction REAL');
addColumnIfNotExists('wages', 'esic_deduction REAL');
addColumnIfNotExists('wages', 'other_deduction REAL');
addColumnIfNotExists('wages', 'other_benefit REAL');
addColumnIfNotExists('wages', 'paid_date TEXT');
addColumnIfNotExists('wages', 'cheque_no TEXT');
addColumnIfNotExists('wages', 'paid_from_bank_ac TEXT');
addColumnIfNotExists('wages', 'created_by INTEGER DEFAULT 1');
addColumnIfNotExists('wages', 'updated_by INTEGER DEFAULT 1');

/* ---- firms missing columns ---- */
addColumnIfNotExists('firms', 'legal_name TEXT');
addColumnIfNotExists('firms', 'address TEXT');
addColumnIfNotExists('firms', 'city TEXT');
addColumnIfNotExists('firms', 'state TEXT');
addColumnIfNotExists('firms', 'country TEXT');
addColumnIfNotExists('firms', 'pincode TEXT');
addColumnIfNotExists('firms', 'phone_number TEXT');
addColumnIfNotExists('firms', 'secondary_phone TEXT');
addColumnIfNotExists('firms', 'email TEXT');
addColumnIfNotExists('firms', 'website TEXT');
addColumnIfNotExists('firms', 'business_type TEXT');
addColumnIfNotExists('firms', 'industry_type TEXT');
addColumnIfNotExists('firms', 'establishment_year INTEGER');
addColumnIfNotExists('firms', 'employee_count INTEGER');
addColumnIfNotExists('firms', 'registration_number TEXT');
addColumnIfNotExists('firms', 'registration_date TEXT');
addColumnIfNotExists('firms', 'cin_number TEXT');
addColumnIfNotExists('firms', 'pan_number TEXT');
addColumnIfNotExists('firms', 'gst_number TEXT');
addColumnIfNotExists('firms', 'tax_id TEXT');
addColumnIfNotExists('firms', 'vat_number TEXT');
addColumnIfNotExists('firms', 'bank_account_number TEXT');
addColumnIfNotExists('firms', 'bank_name TEXT');
addColumnIfNotExists('firms', 'bank_branch TEXT');
addColumnIfNotExists('firms', 'ifsc_code TEXT');
addColumnIfNotExists('firms', 'payment_terms TEXT');
addColumnIfNotExists('firms', 'license_numbers TEXT');
addColumnIfNotExists('firms', 'insurance_details TEXT');
addColumnIfNotExists('firms', 'currency TEXT DEFAULT "INR"');
addColumnIfNotExists('firms', 'timezone TEXT DEFAULT "Asia/Kolkata"');
addColumnIfNotExists('firms', 'fiscal_year_start TEXT');
addColumnIfNotExists('firms', 'invoice_prefix TEXT');
addColumnIfNotExists('firms', 'quote_prefix TEXT');
addColumnIfNotExists('firms', 'po_prefix TEXT');
addColumnIfNotExists('firms', 'logo_url TEXT');
addColumnIfNotExists('firms', 'invoice_template TEXT');
addColumnIfNotExists('firms', 'enable_e_invoice INTEGER DEFAULT 0');

/* ---- settings missing columns ---- */
addColumnIfNotExists('settings', 'description TEXT');

/* ---- firm_settings missing columns ---- */
addColumnIfNotExists('firm_settings', 'description TEXT');

/* ---------- FIRM ---------- */
export const Firm = {
  create: db.prepare(`
    INSERT INTO firms (name, code, description, legal_name, address, city, state, country, pincode, phone_number, secondary_phone, email, website, business_type, industry_type, establishment_year, employee_count, registration_number, registration_date, cin_number, pan_number, gst_number, tax_id, vat_number, bank_account_number, bank_name, bank_branch, ifsc_code, payment_terms, status, license_numbers, insurance_details, currency, timezone, fiscal_year_start, invoice_prefix, quote_prefix, po_prefix, logo_url, invoice_template, enable_e_invoice)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`SELECT * FROM firms WHERE id = ?`),

  getByCode: db.prepare(`SELECT * FROM firms WHERE code = ?`),

  getAll: db.prepare(`SELECT * FROM firms ORDER BY created_at DESC`),

  updateStatus: db.prepare(`
    UPDATE firms 
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `),

  update: db.prepare(`
    UPDATE firms 
    SET name = COALESCE(?, name),
        code = COALESCE(?, code),
        description = COALESCE(?, description),
        legal_name = COALESCE(?, legal_name),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        country = COALESCE(?, country),
        pincode = COALESCE(?, pincode),
        phone_number = COALESCE(?, phone_number),
        secondary_phone = COALESCE(?, secondary_phone),
        email = COALESCE(?, email),
        website = COALESCE(?, website),
        business_type = COALESCE(?, business_type),
        industry_type = COALESCE(?, industry_type),
        establishment_year = COALESCE(?, establishment_year),
        employee_count = COALESCE(?, employee_count),
        registration_number = COALESCE(?, registration_number),
        registration_date = COALESCE(?, registration_date),
        cin_number = COALESCE(?, cin_number),
        pan_number = COALESCE(?, pan_number),
        gst_number = COALESCE(?, gst_number),
        tax_id = COALESCE(?, tax_id),
        vat_number = COALESCE(?, vat_number),
        bank_account_number = COALESCE(?, bank_account_number),
        bank_name = COALESCE(?, bank_name),
        bank_branch = COALESCE(?, bank_branch),
        ifsc_code = COALESCE(?, ifsc_code),
        payment_terms = COALESCE(?, payment_terms),
        status = COALESCE(?, status),
        license_numbers = COALESCE(?, license_numbers),
        insurance_details = COALESCE(?, insurance_details),
        currency = COALESCE(?, currency),
        timezone = COALESCE(?, timezone),
        fiscal_year_start = COALESCE(?, fiscal_year_start),
        invoice_prefix = COALESCE(?, invoice_prefix),
        quote_prefix = COALESCE(?, quote_prefix),
        po_prefix = COALESCE(?, po_prefix),
        logo_url = COALESCE(?, logo_url),
        invoice_template = COALESCE(?, invoice_template),
        enable_e_invoice = COALESCE(?, enable_e_invoice),
        updated_at = datetime('now')
    WHERE id = ?
  `),

  delete: db.prepare(`DELETE FROM firms WHERE id = ?`)
};

/* ---------- USER ---------- */
export const User = {
  create: db.prepare(`
    INSERT INTO users (username, email, fullname, password, role, firm_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`
    SELECT u.*, 
           CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE NULL END as firm_name,
           CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code,
           CASE WHEN u.firm_id IS NOT NULL THEN f.status ELSE NULL END as firm_status
    FROM users u
    LEFT JOIN firms f ON f.id = u.firm_id
    WHERE u.id = ?
  `),

  getByEmail: db.prepare(`
    SELECT u.*, 
           CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE NULL END as firm_name,
           CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code,
           CASE WHEN u.firm_id IS NOT NULL THEN f.status ELSE NULL END as firm_status
    FROM users u
    LEFT JOIN firms f ON f.id = u.firm_id
    WHERE u.email = ?
  `),

  getByUsername: db.prepare(`
    SELECT u.*, 
           CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE NULL END as firm_name,
           CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code,
           CASE WHEN u.firm_id IS NOT NULL THEN f.status ELSE NULL END as firm_status
    FROM users u
    LEFT JOIN firms f ON f.id = u.firm_id
    WHERE u.username = ?
  `),

  updateLastLogin: db.prepare(`
    UPDATE users 
    SET last_login = datetime('now') 
    WHERE id = ?
  `),

  updateStatus: db.prepare(`
    UPDATE users 
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `),

  getAllPending: db.prepare(`
    SELECT u.*, 
           CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE NULL END as firm_name,
           CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code
    FROM users u
    LEFT JOIN firms f ON f.id = u.firm_id
    WHERE u.status = 'pending'
    ORDER BY u.created_at DESC
  `)
};

/* ---------- MASTER ROLL ---------- */
export const MasterRoll = {
  create: db.prepare(`
    INSERT INTO master_rolls (
      firm_id,
      employee_name,
      father_husband_name,
      date_of_birth,
      aadhar,
      pan,
      phone_no,
      address,
      bank,
      account_no,
      ifsc,
      branch,
      uan,
      esic_no,
      s_kalyan_no,
      category,
      p_day_wage,
      project,
      site,
      date_of_joining,
      date_of_exit,
      doe_rem,
      status,
      created_by,
      updated_by
    ) VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )
  `),

  getById: db.prepare(`
    SELECT mr.*, f.name as firm_name, f.code as firm_code,
           cu.fullname as created_by_name, uu.fullname as updated_by_name
    FROM master_rolls mr
    JOIN firms f ON f.id = mr.firm_id
    LEFT JOIN users cu ON cu.id = mr.created_by
    LEFT JOIN users uu ON uu.id = mr.updated_by
    WHERE mr.id = ?
  `),

  getByFirm: db.prepare(`
    SELECT mr.*, f.name as firm_name, f.code as firm_code,
           cu.fullname as created_by_name, uu.fullname as updated_by_name
    FROM master_rolls mr
    JOIN firms f ON f.id = mr.firm_id
    LEFT JOIN users cu ON cu.id = mr.created_by
    LEFT JOIN users uu ON uu.id = mr.updated_by
    WHERE mr.firm_id = ?
    ORDER BY mr.created_at DESC
  `),

  update: db.prepare(`
    UPDATE master_rolls
    SET employee_name = ?, father_husband_name = ?, date_of_birth = ?,
        aadhar = ?, pan = ?, phone_no = ?, address = ?, bank = ?,
        account_no = ?, ifsc = ?, branch = ?, uan = ?, esic_no = ?,
        s_kalyan_no = ?, category = ?, p_day_wage = ?, project = ?,
        site = ?, date_of_joining = ?, date_of_exit = ?, doe_rem = ?,
        status = ?, updated_by = ?, updated_at = ?
    WHERE id = ? AND firm_id = ?
  `)

};

/* ---------- WAGE ---------- */
export const Wage = {
  create: db.prepare(`
    INSERT INTO wages (
      firm_id,
      master_roll_id,
      p_day_wage,
      wage_days,
      gross_salary,
      net_salary,
      salary_month,
      epf_deduction,
      esic_deduction,
      other_deduction,
      other_benefit,
      paid_date,
      cheque_no,
      paid_from_bank_ac,
      created_by,
      updated_by
    ) VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )
  `),

  getById: db.prepare(`
    SELECT w.*, mr.employee_name, mr.aadhar, f.name as firm_name
    FROM wages w
    JOIN master_rolls mr ON mr.id = w.master_roll_id
    JOIN firms f ON f.id = w.firm_id
    WHERE w.id = ? AND w.firm_id = ?
  `),

  getByFirm: db.prepare(`
    SELECT * FROM wages 
    WHERE firm_id = ?
    ORDER BY salary_month DESC, created_at DESC
  `),

  getByFirmAndMonth: db.prepare(`
    SELECT w.*, mr.employee_name, mr.aadhar
    FROM wages w
    JOIN master_rolls mr ON mr.id = w.master_roll_id
    WHERE w.firm_id = ? AND w.salary_month = ?
    ORDER BY mr.employee_name
  `),

  getLastWageForEmployee: db.prepare(`
    SELECT wage_days, gross_salary, salary_month
    FROM wages
    WHERE master_roll_id = ? AND firm_id = ?
    ORDER BY salary_month DESC
    LIMIT 1
  `),

  update: db.prepare(`
    UPDATE wages
    SET 
      p_day_wage = ?,
      wage_days = ?,
      gross_salary = ?,
      epf_deduction = ?,
      esic_deduction = ?,
      other_deduction = ?,
      other_benefit = ?,
      net_salary = ?,
      paid_date = ?,
      cheque_no = ?,
      paid_from_bank_ac = ?,
      updated_by = ?,
      updated_at = datetime('now')
    WHERE id = ? AND firm_id = ?
  `),

  delete: db.prepare(`
    DELETE FROM wages
    WHERE id = ? AND firm_id = ?
  `),

  checkExists: db.prepare(`
    SELECT id FROM wages
    WHERE firm_id = ? AND master_roll_id = ? AND salary_month = ?
  `),

  getBulkByIds: db.prepare(`
    SELECT * FROM wages
    WHERE id IN (SELECT id FROM wages WHERE firm_id = ?)
    ORDER BY salary_month DESC
  `)
};

/* --------------------------------------------------
   MANY TO MANY HELPERS
-------------------------------------------------- */

export const Relations = {
  assignUserToMasterRoll: db.prepare(`
    INSERT OR IGNORE INTO user_master_rolls (user_id, master_roll_id)
    VALUES (?, ?)
  `),

  assignUserToWage: db.prepare(`
    INSERT OR IGNORE INTO user_wages (user_id, wage_id)
    VALUES (?, ?)
  `),

  getMasterRollUsers: db.prepare(`
    SELECT u.*
    FROM users u
    JOIN user_master_rolls umr ON umr.user_id = u.id
    WHERE umr.master_roll_id = ?
  `),

  getUserWages: db.prepare(`
    SELECT w.*
    FROM wages w
    JOIN user_wages uw ON uw.wage_id = w.id
    WHERE uw.user_id = ?
  `)
};

/* ---------- INVENTORY: STOCKS ---------- */
export const Stock = {
  create: db.prepare(`
    INSERT INTO stocks (firm_id, item, pno, oem, hsn, qty, uom, rate, grate, total, mrp, batches, user)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`
    SELECT * FROM stocks WHERE id = ? AND firm_id = ?
  `),

  getByFirm: db.prepare(`
    SELECT * FROM stocks WHERE firm_id = ? ORDER BY created_at DESC
  `),

  getByItem: db.prepare(`
    SELECT * FROM stocks WHERE firm_id = ? AND item = ?
  `),

  update: db.prepare(`
    UPDATE stocks 
    SET item = ?, pno = ?, oem = ?, hsn = ?, qty = ?, uom = ?, 
        rate = ?, grate = ?, total = ?, mrp = ?, batches = ?, user = ?, updated_at = datetime('now')
    WHERE id = ? AND firm_id = ?
  `),

  delete: db.prepare(`
    DELETE FROM stocks WHERE id = ? AND firm_id = ?
  `)
};

/* ---------- INVENTORY: PARTIES ---------- */
export const Party = {
  create: db.prepare(`
    INSERT INTO parties (firm_id, firm, gstin, contact, state, state_code, addr, pin, pan, usern, supply)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`
    SELECT * FROM parties WHERE id = ? AND firm_id = ?
  `),

  getByFirm: db.prepare(`
    SELECT * FROM parties WHERE firm_id = ? ORDER BY created_at DESC
  `),

  getByName: db.prepare(`
    SELECT * FROM parties WHERE firm_id = ? AND firm = ?
  `),

  update: db.prepare(`
    UPDATE parties 
    SET firm = ?, gstin = ?, contact = ?, state = ?, state_code = ?, 
        addr = ?, pin = ?, pan = ?, supply = ?, updated_at = datetime('now')
    WHERE id = ? AND firm_id = ?
  `),

  delete: db.prepare(`
    DELETE FROM parties WHERE id = ? AND firm_id = ?
  `)
};

/* ---------- INVENTORY: BILLS ---------- */
export const Bill = {
  create: db.prepare(`
    INSERT INTO bills (firm_id, bno, bdate, supply, addr, gstin, state, pin, state_code, gtot, ntot, rof, btype, usern, firm, party_id, oth_chg_json, order_no, vehicle_no, dispatch_through, narration, reverse_charge, cgst, sgst, igst, consignee_name, consignee_gstin, consignee_address, consignee_state, consignee_pin, consignee_state_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`
    SELECT * FROM bills WHERE id = ? AND firm_id = ?
  `),

  getByBillNo: db.prepare(`
    SELECT * FROM bills WHERE firm_id = ? AND bno = ?
  `),

  getByFirm: db.prepare(`
    SELECT * FROM bills WHERE firm_id = ? ORDER BY bdate DESC, created_at DESC
  `),

  update: db.prepare(`
    UPDATE bills 
    SET bno = ?, bdate = ?, supply = ?, addr = ?, gstin = ?, state = ?, pin = ?, state_code = ?, 
        gtot = ?, ntot = ?, rof = ?, btype = ?, usern = ?, firm = ?, party_id = ?, 
        oth_chg_json = ?, order_no = ?, vehicle_no = ?, dispatch_through = ?, 
        narration = ?, reverse_charge = ?, cgst = ?, sgst = ?, igst = ?,
        consignee_name = ?, consignee_gstin = ?, consignee_address = ?, 
        consignee_state = ?, consignee_pin = ?, consignee_state_code = ?,
        updated_at = datetime('now')
    WHERE id = ? AND firm_id = ?
  `),

  updateStatus: db.prepare(`
    UPDATE bills 
    SET status = ?, cancellation_reason = ?, cancelled_at = ?, cancelled_by = ?, updated_at = datetime('now')
    WHERE id = ? AND firm_id = ?
  `),

  delete: db.prepare(`
    DELETE FROM bills WHERE id = ? AND firm_id = ?
  `)
};

/* ---------- INVENTORY: STOCK REGISTER ---------- */
export const StockReg = {
  create: db.prepare(`
    INSERT INTO stock_reg (firm_id, type, bno, bdate, supply, item, item_narration, batch, hsn, qty, uom, rate, grate, disc, total, stock_id, bill_id, user, firm, qtyh)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`
    SELECT * FROM stock_reg WHERE id = ? AND firm_id = ?
  `),

  getByBillId: db.prepare(`
    SELECT * FROM stock_reg WHERE bill_id = ? AND firm_id = ? ORDER BY created_at
  `),

  getByStockId: db.prepare(`
    SELECT * FROM stock_reg WHERE stock_id = ? AND firm_id = ? ORDER BY bdate DESC, created_at DESC
  `),

  getByFirm: db.prepare(`
    SELECT * FROM stock_reg WHERE firm_id = ? ORDER BY bdate DESC, created_at DESC
  `),

  delete: db.prepare(`
    DELETE FROM stock_reg WHERE id = ? AND firm_id = ?
  `),

  deleteByBillId: db.prepare(`
    DELETE FROM stock_reg WHERE bill_id = ? AND firm_id = ?
  `)
};

/* ---------- ACCOUNTING: LEDGER ---------- */
export const Ledger = {
  create: db.prepare(`
    INSERT INTO ledger (firm_id, voucher_id, voucher_type, voucher_no, account_head, account_type, debit_amount, credit_amount, narration, bill_id, party_id, tax_type, tax_rate, transaction_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`
    SELECT * FROM ledger WHERE id = ? AND firm_id = ?
  `),

  getByVoucherId: db.prepare(`
    SELECT * FROM ledger WHERE voucher_id = ? AND firm_id = ? ORDER BY created_at
  `),

  getByBillId: db.prepare(`
    SELECT * FROM ledger WHERE bill_id = ? AND firm_id = ? ORDER BY created_at
  `),

  getByFirm: db.prepare(`
    SELECT * FROM ledger WHERE firm_id = ? ORDER BY transaction_date DESC, created_at DESC
  `),

  getByAccountHead: db.prepare(`
    SELECT * FROM ledger WHERE firm_id = ? AND account_head = ? ORDER BY transaction_date DESC
  `),

  delete: db.prepare(`
    DELETE FROM ledger WHERE id = ? AND firm_id = ?
  `),

  deleteByVoucherId: db.prepare(`
    DELETE FROM ledger WHERE voucher_id = ? AND voucher_type = ? AND firm_id = ?
  `)
};

/* ---------- BILL SEQUENCES ---------- */
export const BillSequence = {
  create: db.prepare(`
    INSERT INTO bill_sequences (firm_id, financial_year, last_sequence, voucher_type)
    VALUES (?, ?, ?, ?)
  `),

  getByFirmAndYear: db.prepare(`
    SELECT * FROM bill_sequences WHERE firm_id = ? AND financial_year = ?
  `),

  update: db.prepare(`
    UPDATE bill_sequences 
    SET last_sequence = ?, updated_at = datetime('now')
    WHERE firm_id = ? AND financial_year = ? AND (voucher_type IS NULL OR voucher_type = ?)
  `)
};

/* ---------- SETTINGS ---------- */
export const Settings = {
  create: db.prepare(`
    INSERT INTO settings (setting_key, setting_value, description)
    VALUES (?, ?, ?)
  `),

  getByKey: db.prepare(`
    SELECT * FROM settings WHERE setting_key = ?
  `),

  getAll: db.prepare(`
    SELECT * FROM settings ORDER BY setting_key
  `),

  update: db.prepare(`
    UPDATE settings SET setting_value = ?, description = ?, updated_at = datetime('now')
    WHERE setting_key = ?
  `)
};

/* ---------- FIRM SETTINGS ---------- */
export const FirmSettings = {
  create: db.prepare(`
    INSERT INTO firm_settings (firm_id, setting_key, setting_value, description)
    VALUES (?, ?, ?, ?)
  `),

  getByFirmAndKey: db.prepare(`
    SELECT * FROM firm_settings WHERE firm_id = ? AND setting_key = ?
  `),

  getByFirm: db.prepare(`
    SELECT * FROM firm_settings WHERE firm_id = ? ORDER BY setting_key
  `),

  update: db.prepare(`
    UPDATE firm_settings SET setting_value = ?, description = ?, updated_at = datetime('now')
    WHERE firm_id = ? AND setting_key = ?
  `)
};


console.log('✅ Database initialized with multi-firm support and payment tracking');

// Seed super admin on initialization
try {
  import('./seed-super-admin.js').then(module => {
    module.seedSuperAdmin();
  }).catch(err => {
    console.log('⚠️  Super admin seeding skipped:', err.message);
  });
} catch (err) {
  console.log('⚠️  Super admin seeding failed:', err.message);
}

// Export database instance
export { db };
