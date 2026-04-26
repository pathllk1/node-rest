import mongoose from 'mongoose';

const { Schema } = mongoose;

const advanceSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    master_roll_id: {
      type: Schema.Types.ObjectId,
      ref: 'MasterRoll',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['ADVANCE', 'REPAYMENT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: String,
      required: true, // YYYY-MM-DD
    },
    payment_mode: {
      type: String,
      enum: ['CASH', 'BANK', 'WAGE_DEDUCTION'],
      default: 'CASH',
    },
    bank_account_details: {
      type: String,
    },
    wage_id: {
      type: Schema.Types.ObjectId,
      ref: 'Wage',
      index: true,
    },
    remarks: {
      type: String,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const Advance = mongoose.model('Advance', advanceSchema);

export default Advance;
