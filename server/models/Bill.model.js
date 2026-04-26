import mongoose from 'mongoose';

const { Schema } = mongoose;

const billSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    // voucher_id is kept as String for backward compatibility with existing data.
    // New bills store the integer as a string (e.g. "1"). Old bills stored zero-padded
    // strings (e.g. "00000001"). Mongoose's type coercion makes both work for Ledger
    // queries (Number field) because String("00000001") and String("1") both cast to
    // the same integer via Number().
    voucher_id:   { type: String },
    bno:          { type: String, required: true },
    bdate:        { type: String, required: true },

    // ── Party (Bill-To) fields ─────────────────────────────────────────────
    supply:       { type: String },   // party firm name
    addr:         { type: String },   // party address
    gstin:        { type: String },   // party GSTIN
    state:        { type: String },   // party state name
    pin:          { type: String },
    state_code:   { type: String },   // party state code (GSTIN[0:2])

    // ── Firm (Supplier) fields ─────────────────────────────────────────────
    // FIX: Added firm_gstin, firm_state, firm_state_code to record WHICH firm
    // GSTIN / location was used when raising this bill.
    //
    // With multiple GST registrations across states, a firm may bill from
    // Maharashtra (27) for one customer and Karnataka (29) for another.
    // Storing these here is essential for:
    //   • GST type validation (intra vs inter-state correctness)
    //   • GSTR-1 filing — each GSTIN files its own outward supply return
    //   • Credit note / debit note reversal — must match the original GSTIN
    //   • Audit trail — which registration was the supplier at time of sale
    //
    // NULL on legacy bills created before this field was introduced —
    // fall back to firm.locations[is_default] when generating those reports.
    firm_gstin:      { type: String, default: null },
    firm_state:      { type: String, default: null },
    firm_state_code: { type: String, default: null },

    gtot:         { type: Number, required: true, default: 0 },
    ntot:         { type: Number, required: true, default: 0 },
    rof:          { type: Number, default: 0 },
    btype:        { type: String, default: 'SALES' },
    bill_subtype: { type: String },
    usern:        { type: String },
    firm:         { type: String },   // firm name (display)
    party_id: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
    },
    oth_chg_json:         { type: String },
    other_charges:        [{ type: Schema.Types.Mixed }],
    supplier_bill_no:     { type: String },
    order_no:             { type: String },
    vehicle_no:           { type: String },
    dispatch_through:     { type: String },
    narration:            { type: String },
    reverse_charge:       { type: Boolean, default: false },
    cgst:                 { type: Number, default: 0 },
    sgst:                 { type: Number, default: 0 },
    igst:                 { type: Number, default: 0 },
    
    // ── Credit/Debit Note Reference ────────────────────────────────────────
    // For CREDIT_NOTE (sales return) or DEBIT_NOTE (purchase return), this links
    // back to the original SALES or PURCHASE bill being returned.
    // NULL for regular bills (SALES, PURCHASE, etc.)
    ref_bill_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
    },
    
    status:               { type: String, default: 'ACTIVE' },
    cancellation_reason:  { type: String },
    cancelled_at:         { type: Date, default: null },
    cancelled_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    consignee_name:       { type: String },
    consignee_gstin:      { type: String },
    consignee_address:    { type: String },
    consignee_state:      { type: String },
    consignee_pin:        { type: String },
    consignee_state_code: { type: String },

    // ── File Upload fields ────────────────────────────────────────────────
    // Used for attaching scanned copies of purchase bills or physical invoices.
    file_url:         { type: String, default: null },
    file_path:        { type: String, default: null }, // local relative path
    file_uploaded_by: { type: String, default: null }, // username of uploader
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────
// bno is unique per firm (each firm has its own sequential bill numbers)
billSchema.index({ firm_id: 1, bno: 1 }, { unique: true });
// Common list/filter queries
billSchema.index({ firm_id: 1, btype: 1, createdAt: -1 });
billSchema.index({ firm_id: 1, party_id: 1 });
billSchema.index({ firm_id: 1, status: 1 });
// ensureUniqueSupplierBillNo runs on every purchase create/update
billSchema.index({ firm_id: 1, party_id: 1, supplier_bill_no: 1, status: 1 });
// GSTR-1 filing queries: all bills for a given firm GSTIN in a date range
billSchema.index({ firm_id: 1, firm_gstin: 1, bdate: 1 });
// Contextual return queries: find notes linked to a specific original bill
billSchema.index({ ref_bill_id: 1 });

const Bill = mongoose.model('Bill', billSchema);

export default Bill;