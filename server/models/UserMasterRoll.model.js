import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Junction model for the many-to-many relationship between User and MasterRoll.
 * Mirrors the `user_master_rolls` table used for assignment tracking.
 */
const userMasterRollSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    master_roll_id: {
      type: Schema.Types.ObjectId,
      ref: 'MasterRoll',
      required: true,
    },
  },
  { timestamps: false }
);

// Enforce composite uniqueness (mirrors the composite PRIMARY KEY in SQLite)
userMasterRollSchema.index({ user_id: 1, master_roll_id: 1 }, { unique: true });

const UserMasterRoll = mongoose.model('UserMasterRoll', userMasterRollSchema);

export default UserMasterRoll;
