-- Admin Hub — Database Schema
-- Run in Cloudflare D1 console

CREATE TABLE IF NOT EXISTS hub_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','manager')),
  passcode TEXT NOT NULL,
  venue TEXT DEFAULT 'All',
  allowed_tools TEXT DEFAULT 'all',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Default admin account
INSERT INTO hub_staff (name, role, passcode, venue, allowed_tools)
VALUES ('Nay Aung Win', 'admin', 'bbb2026', 'All', 'all');
