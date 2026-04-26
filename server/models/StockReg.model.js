import mongoose from 'mongoose';

const { Schema } = mongoose;

const stockRegSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    type:           { type: String, required: true },
    bno:            { type: String },
    bdate:          { type: String },
    supply:         { type: String },
    item_type:      { type: String, default: 'GOODS' },
    show_qty:       { type: Boolean, default: true },
    item:           { type: String, required: true },
    item_narration: { type: String },
    batch:          { type: String },
    hsn:            { type: String },
    qty:            { type: Number, required: true },
    uom:            { type: String },
    rate:           { type: Number, default: 0 },   // selling rate (for SALE) or purchase rate (for PURCHASE)
    grate:          { type: Number, default: 0 },
    disc:           { type: Number, default: 0 },
    total:          { type: Number, default: 0 },   // line value at transaction rate (selling or purchase)

    // Weighted Average Cost at the time of this movement.
    // For SALE: WAC per unit at moment of sale — used for COGS and credit-note reversal.
    // For PURCHASE: purchase rate of this specific lot.
    // Null on older records — callers fall back to Stock.rate when absent.
    cost_rate: { type: Number, default: null },

    stock_id: {
      type: Schema.Types.ObjectId,
      ref: 'Stock',
      default: null,
    },
    bill_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
    },
    user:  { type: String },
    firm:  { type: String },
    qtyh: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────
// bill_id + firm_id: used by getBillById, updateBill step-1 restore, cancelBill restore
stockRegSchema.index({ firm_id: 1, bill_id: 1 });
// stock_id + type: used by getPartyItemHistory, getStockMovementsByStock
stockRegSchema.index({ firm_id: 1, stock_id: 1, type: 1 });
// type: used by exportStockMovementsToExcel, getStockMovements
stockRegSchema.index({ firm_id: 1, type: 1 });

const StockReg = mongoose.model('StockReg', stockRegSchema);

export default StockReg;