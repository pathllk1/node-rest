import mongoose from 'mongoose';

const { Schema } = mongoose;

const partySchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    firm:       { type: String, required: true },
    
    /*
     * Legacy single-GSTIN fields — kept for backward compatibility.
     * For new parties with multi-GST, these are synced from gstLocations[primary_gstin_index].
     * Do NOT write to these directly for multi-GST parties; update gstLocations[] instead.
     */
    gstin:      { type: String, default: 'UNREGISTERED' },
    contact:    { type: String },
    state:      { type: String },
    state_code: { type: String },
    addr:       { type: String },
    pin:        { type: String },
    pan:        { type: String },
    
    /*
     * Multi-GST Support (similar to Firm.locations).
     * 
     * In Indian GST law, a party (customer/supplier) can have multiple GST registrations
     * across different states (PPOB in one state, APOB in another).
     * Each GSTIN is registered to exactly one physical address.
     *
     * Rules enforced here:
     *  • state_code is always the first two digits of gstin (auto-derived)
     *  • Each location is a separate GST registration with its own address
     *  • primary_gstin_index points to the default/primary GSTIN (0-based)
     *  • Exactly one entry should be marked as primary at any time
     *  • For backward compatibility, single-GSTIN parties have empty gstLocations[]
     */
    gstLocations: [
      {
        gstin:           { type: String },          // 15-char GSTIN
        state_code:      { type: String },          // 2-digit, derived from gstin[0:2]
        state:           { type: String },          // human-readable state name
        address:         { type: String },          // street / locality / building
        city:            { type: String },
        pincode:         { type: String },
        contact:         { type: String },          // location-specific contact
        is_primary:      { type: Boolean, default: false },
      },
    ],
    primary_gstin_index: { type: Number, default: 0 },
    
    usern:      { type: String },
    supply:     { type: String },
  },
  { timestamps: true }
);

// FIX: Without this index, two parties with the same name inside the same firm
// are allowed, which causes merged ledger balances and corrupted account reports.
// The unique constraint enforces one canonical party name per firm.
//
// ⚠️  MIGRATION NOTE: If the DB already contains duplicate (firm_id, firm) pairs,
// run a deduplication script before creating this index, otherwise the index
// creation will fail with a duplicate-key error:
//
//   db.parties.aggregate([
//     { $group: { _id: { firm_id: '$firm_id', firm: '$firm' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
//     { $match: { count: { $gt: 1 } } }
//   ])
partySchema.index({ firm_id: 1, firm: 1 }, { unique: true });

// Index for fast GSTIN lookup across all party locations
partySchema.index({ firm_id: 1, 'gstLocations.gstin': 1 });

const Party = mongoose.model('Party', partySchema);

export default Party;