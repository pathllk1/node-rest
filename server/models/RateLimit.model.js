/**
 * RateLimit Model
 * Replaces the in-memory Map used in rateLimitMiddleware.
 * MongoDB-backed so rate limit state survives server restarts,
 * is shared across all worker processes, and works on Vercel/serverless.
 *
 * TTL index on expires_at auto-deletes stale entries — no manual cleanup needed.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const rateLimitSchema = new Schema(
  {
    // Composite key, e.g. "login:ip:1.2.3.4"
    key: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    // Number of attempts in the current window
    count: {
      type:    Number,
      default: 1,
    },
    // Start of the current window
    first_attempt: {
      type:    Date,
      default: Date.now,
    },
    // When the IP lock expires (null = not locked)
    locked_until: {
      type:    Date,
      default: null,
    },
    // TTL: MongoDB auto-deletes the document at this time
    expires_at: {
      type:     Date,
      required: true,
      index:    { expires: 0 }, // TTL index
    },
  },
  { timestamps: false, collection: 'rate_limits' }
);

export default mongoose.model('RateLimit', rateLimitSchema);
