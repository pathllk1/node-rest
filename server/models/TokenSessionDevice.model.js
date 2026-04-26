import mongoose from 'mongoose';

const { Schema } = mongoose;

const tokenSessionDeviceSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    device_id: {
      type: String,
      required: true,
      index: true,
    },
    device_name: {
      type: String,
      default: null,
    },
    device_type: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'unknown'],
      default: 'unknown',
    },
    browser: {
      type: String,
      default: null,
    },
    os: {
      type: String,
      default: null,
    },
    ip_address: {
      type: String,
      required: true,
    },
    is_trusted: {
      type: Boolean,
      default: false,
    },
    last_used_at: {
      type: Date,
      default: Date.now,
    },
    token_family_id: {
      type: String,
      index: true,
      default: null,
    },
  },
  { timestamps: true }
);

const TokenSessionDevice = mongoose.model('TokenSessionDevice', tokenSessionDeviceSchema);

export default TokenSessionDevice;
