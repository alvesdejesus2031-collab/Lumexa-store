require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const { authenticator } = require("otplib");
const path = require("path");

const app = express();

app.set("trust proxy", 1);

const port = Number(process.env.PORT || 3000);
const whatsapp = process.env.WHATSAPP_NUMBER || "244937770994";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is required.");
  process.exit(1);
}

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      totp_secret TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      image TEXT DEFAULT '',
      available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const email = String(process.env.ADMIN_EMAIL)
    .toLowerCase()
    .trim();

  const existing = await pool.query(
    "SELECT id FROM admins WHERE email = $1",
    [email]
  );

  if (existing.rows.length === 0) {
    const passwordHash = await bcrypt.hash(
      String(process.env.ADMIN_PASSWORD),
      12
    );

    await pool.query(
      `INSERT INTO admins
       (email, password_hash, totp_secret)
       VALUES ($1, $2, $3)`,
      [
        email,
        passwordHash,
        process.env.ADMIN_TOTP_SECRET || null
      ]
    );

    console.log("Initial admin created.");
  }
}
