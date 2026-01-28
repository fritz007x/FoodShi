-- FOODSHI Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    firebase_uid VARCHAR(128) UNIQUE,
    wallet_address VARCHAR(42),
    name VARCHAR(100),
    bio TEXT,
    profile_pic VARCHAR(500),
    karma_points INTEGER DEFAULT 0,
    pending_karma INTEGER DEFAULT 0,
    is_verified_donor BOOLEAN DEFAULT FALSE,
    stake_amount DECIMAL(36, 18) DEFAULT 0,
    stake_unlock_date TIMESTAMP,
    fraud_strikes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Donations table
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID NOT NULL REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    receiver_latitude DECIMAL(10, 8),
    receiver_longitude DECIMAL(11, 8),
    description TEXT NOT NULL,
    photo_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed', 'expired', 'cancelled')),
    points_awarded INTEGER DEFAULT 0,
    challenge_deadline TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts (Microblog) table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    image_url VARCHAR(500),
    likes_count INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Likes table
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- Reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id),
    reported_user_id UUID REFERENCES users(id),
    reported_post_id UUID REFERENCES posts(id),
    reported_donation_id UUID REFERENCES donations(id),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Invitations table
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID NOT NULL REFERENCES users(id),
    email VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP
);

-- Medal progress tracking
CREATE TABLE medal_progress (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    first_donation_date TIMESTAMP,
    total_confirmed_donations INTEGER DEFAULT 0,
    bronze_earned_at TIMESTAMP,
    silver_earned_at TIMESTAMP,
    gold_earned_at TIMESTAMP,
    platinum_earned_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily points tracking (for emission pool)
CREATE TABLE daily_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    day_date DATE NOT NULL,
    points INTEGER DEFAULT 0,
    synced_to_chain BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, day_date)
);

-- Karma transactions log
CREATE TABLE karma_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('donation_given', 'donation_received', 'dispute_lost', 'exchange', 'bonus', 'penalty')),
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Token exchange requests
CREATE TABLE exchange_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    karma_amount INTEGER NOT NULL,
    token_amount DECIMAL(36, 18) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Contributions (fiat/crypto payments)
CREATE TABLE contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(18, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('stripe', 'crypto')),
    payment_id VARCHAR(255),
    tx_hash VARCHAR(66),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_donations_donor ON donations(donor_id);
CREATE INDEX idx_donations_receiver ON donations(receiver_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_created ON donations(created_at);
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_created ON posts(created_at);
CREATE INDEX idx_likes_post ON likes(post_id);
CREATE INDEX idx_likes_user ON likes(user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_daily_points_date ON daily_points(day_date);
CREATE INDEX idx_karma_transactions_user ON karma_transactions(user_id);
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medal_progress_updated_at BEFORE UPDATE ON medal_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
