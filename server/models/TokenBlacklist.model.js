import mongoose from 'mongoose';

const { Schema } = mongoose;

const tokenBlacklistSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token_hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ['logout', 'security', 'pw-change', 'device-block', 'manual-revoke'],
      default: 'logout',
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index: auto-delete when expires_at is reached
    },
  },
  { timestamps: true }
);

const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

export default TokenBlacklist;
