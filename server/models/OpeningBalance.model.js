import mongoose from 'mongoose';

const { Schema } = mongoose;

const openingBalanceSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    account_head: {
      type: String,
      required: true,
    },
    account_type: {
      type: String,
      enum: [
        'INCOME', 'EXPENSE', 'COGS', 'GENERAL',
        'ASSET', 'LIABILITY', 'CASH', 'BANK',
        'DEBTOR', 'CREDITOR', 'CAPITAL', 'RETAINED_EARNINGS',
        'LOAN', 'PREPAID_EXPENSE', 'ACCUMULATED_DEPRECIATION',
        'ALLOWANCE_FOR_DOUBTFUL_DEBTS', 'DISCOUNT_RECEIVED', 'DISCOUNT_GIVEN'
      ],
      required: true,
    },
    opening_date: {
      type: String,
      required: true,
    },
    debit_amount: {
      type: Number,
      default: 0,
    },
    credit_amount: {
      type: Number,
      default: 0,
    },
    narration: {
      type: String,
      default: 'Opening Balance',
    },
    is_locked: {
      type: Boolean,
      default: false,
    },
    created_by: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
openingBalanceSchema.index({ firm_id: 1, opening_date: 1 });
openingBalanceSchema.index({ firm_id: 1, account_head: 1, opening_date: 1 });
openingBalanceSchema.index({ firm_id: 1, is_locked: 1 });

const OpeningBalance = mongoose.model('OpeningBalance', openingBalanceSchema);

export default OpeningBalance;
