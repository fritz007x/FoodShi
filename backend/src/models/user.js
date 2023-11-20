const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// User schema
const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  walletAddress: { type: String, required: false },
  donationsQty: { type: Number, required: false },
  coins: { type: Number, required: false }, //can withdraw
  points: { type: Number, required: false }, //redeemed for coins
  medals: { type: Number, required: false }, //transferred
  avatar: { type: String, required: false }, //minted
  createdAt: { type: Date, default: Date.now },
});

// User model
const User = mongoose.model("User", userSchema);

module.exports = User;
