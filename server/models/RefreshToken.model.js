import mongoose from 'mongoose';

const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
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
    device_id: {
      type: String,
      default: null,
      index: true,
    },
    ip_address: {
      type: String,
      default: null,
    },
    token_family_id: {
      type: String,
      default: null,
      index: true,
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index: auto-delete when expired
    },
    is_revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revoked_reason: {
      type: String,
      default: null,
    },
    revoked_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
