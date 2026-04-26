import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Junction model for the many-to-many relationship between User and Wage.
 * Mirrors the `user_wages` table used for wage processing tracking.
 */
const userWageSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    wage_id: {
      type: Schema.Types.ObjectId,
      ref: 'Wage',
      required: true,
    },
  },
  { timestamps: false }
);

// Enforce composite uniqueness (mirrors the composite PRIMARY KEY in SQLite)
userWageSchema.index({ user_id: 1, wage_id: 1 }, { unique: true });

const UserWage = mongoose.model('UserWage', userWageSchema);

export default UserWage;
