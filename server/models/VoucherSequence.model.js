import mongoose from 'mongoose';

const { Schema } = mongoose;

const voucherSequenceSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    financial_year: { type: String, required: true },
    last_sequence:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Mirrors UNIQUE(firm_id, financial_year) in SQLite
voucherSequenceSchema.index(
  { firm_id: 1, financial_year: 1 },
  { unique: true }
);

const VoucherSequence = mongoose.model('VoucherSequence', voucherSequenceSchema);

export default VoucherSequence;
