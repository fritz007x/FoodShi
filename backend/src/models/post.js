const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Post schema
const postSchema = new Schema({
  content: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

// Post model
const Post = mongoose.model("Post", postSchema);

module.exports = Post;
