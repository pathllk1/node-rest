import mongoose from 'mongoose';

const { Schema } = mongoose;

const bankAccountSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    account_name: {
      type: String,
      required: true,
      trim: true,
    },
    account_holder_name: {
      type: String,
      trim: true,
      default: null,
    },
    bank_name: {
      type: String,
      required: true,
      trim: true,
    },
    branch_name: {
      type: String,
      trim: true,
      default: null,
    },
    account_number: {
      type: String,
      required: true,
      trim: true,
    },
    ifsc_code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    account_type: {
      type: String,
      enum: ['SAVINGS', 'CURRENT', 'OD', 'CC', 'OTHER'],
      default: 'CURRENT',
    },
    upi_id: {
      type: String,
      trim: true,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    is_default: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

bankAccountSchema.index({ firm_id: 1, account_number: 1 }, { unique: true });
bankAccountSchema.index({ firm_id: 1, account_name: 1 });
bankAccountSchema.index(
  { firm_id: 1, is_default: 1 },
  { unique: true, partialFilterExpression: { is_default: true } }
);

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

export default BankAccount;
