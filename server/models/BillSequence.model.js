import mongoose from 'mongoose';

const { Schema } = mongoose;

const billSequenceSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    financial_year: { type: String, required: true },
    last_sequence:  { type: Number, default: 0 },
    voucher_type:   { type: String, default: null },
  },
  { timestamps: true }
);

// Mirrors UNIQUE(firm_id, financial_year, voucher_type) in SQLite
billSequenceSchema.index(
  { firm_id: 1, financial_year: 1, voucher_type: 1 },
  { unique: true }
);

const BillSequence = mongoose.model('BillSequence', billSequenceSchema);

export default BillSequence;
