-- Add World ID verification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS worldid_nullifier_hash VARCHAR(66) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS worldid_verified_at TIMESTAMP;
