import mongoose from 'mongoose';

const { Schema } = mongoose;

const batchSchema = new Schema({
  batch:   { type: String },
  qty:     { type: Number, required: true },
  uom:     { type: String, required: true, default: 'PCS' },
  rate:    { type: Number, required: true },   // lot purchase rate (for FIFO if ever needed)
  grate:   { type: Number, required: true, default: 18 },
  expiry:  { type: Date },
  mrp:     { type: Number },
}, { _id: true });

const stockSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    item:    { type: String, required: true },
    pno:     { type: String },
    oem:     { type: String },
    hsn:     { type: String, required: true },
    qty:     { type: Number, required: true, default: 0 },
    uom:     { type: String, required: true, default: 'pcs' },

    // Weighted Average Cost per unit across all batches.
    // Updated on every purchase via WAC blend formula.
    // Do NOT update on sale — rate stays constant, total reduces with qty.
    rate:    { type: Number, required: true, default: 0 },

    grate:   { type: Number, required: true, default: 0 },

    // Total inventory value at WAC (= qty × rate after every purchase WAC blend).
    // This is the source of truth for WAC calculation on the next purchase.
    total:   { type: Number, required: true, default: 0 },

    mrp:     { type: Number },
    batches: [batchSchema],
    user:    { type: String },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────
// Unique item name per firm — mirrors Party's firm_id + firm constraint.
// MIGRATION NOTE: run deduplication query before creating this index if
// existing data already has duplicate (firm_id, item) pairs.
stockSchema.index({ firm_id: 1, item: 1 }, { unique: true });

const Stock = mongoose.model('Stock', stockSchema);

export default Stock;