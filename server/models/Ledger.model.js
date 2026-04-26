import mongoose from 'mongoose';

const { Schema } = mongoose;

const ledgerSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    voucher_id:       { type: Number },
    voucher_type:     { type: String },
    voucher_no:       { type: String },
    account_head:     { type: String, required: true },
    account_type: {
      type: String,
      enum: [
        'INCOME', 'EXPENSE', 'COGS', 'GENERAL',
        'ASSET', 'LIABILITY', 'CASH', 'BANK',
        'DEBTOR', 'CREDITOR', 'CAPITAL', 'RETAINED_EARNINGS',
        'LOAN', 'PREPAID_EXPENSE', 'ACCUMULATED_DEPRECIATION',
        'ALLOWANCE_FOR_DOUBTFUL_DEBTS', 'DISCOUNT_RECEIVED', 'DISCOUNT_GIVEN'
      ],
    },
    debit_amount:     { type: Number, default: 0 },
    credit_amount:    { type: Number, default: 0 },
    narration:        { type: String },
    payment_mode:     { type: String, default: null },

    bill_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
    },
    party_id: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
    },
    bank_account_id: {
      type: Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null,
    },
    stock_id: {
      type: Schema.Types.ObjectId,
      ref: 'Stock',
      default: null,
    },
    stock_reg_id: {
      type: Schema.Types.ObjectId,
      ref: 'StockReg',
      default: null,
    },
    ref_type: {
      type: String,
      enum: ['BILL', 'JOURNAL', 'VOUCHER', 'OPENING_BALANCE', 'MANUAL'],
      default: null,
    },
    ref_id: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    tax_type:         { type: String },
    tax_rate:         { type: Number },
    transaction_date: { type: String },
    created_by:       { type: String },
    is_locked:        { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────
ledgerSchema.index({ firm_id: 1, voucher_type: 1, transaction_date: -1 });
ledgerSchema.index({ firm_id: 1, voucher_id: 1 });
ledgerSchema.index({ firm_id: 1, account_head: 1 });
ledgerSchema.index({ firm_id: 1, party_id: 1 });
ledgerSchema.index({ firm_id: 1, bank_account_id: 1 });
ledgerSchema.index({ firm_id: 1, stock_id: 1 });
ledgerSchema.index({ firm_id: 1, ref_type: 1, transaction_date: -1 });
ledgerSchema.index({ firm_id: 1, is_locked: 1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);

export default Ledger;