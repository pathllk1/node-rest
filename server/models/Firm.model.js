import mongoose from 'mongoose';

const { Schema } = mongoose;

const firmSchema = new Schema(
  {
    name:                { type: String, required: true, unique: true },
    code:                { type: String },
    description:         { type: String },
    legal_name:          { type: String },

    /*
     * Legacy top-level fields — kept for backward compatibility.
     * These are always synced from the default location entry by the controller.
     * Do NOT write to these directly; update locations[] instead.
     */
    address:             { type: String },
    city:                { type: String },
    state:               { type: String },
    country:             { type: String },
    pincode:             { type: String },
    gst_number:          { type: String },

    /*
     * Unified Business Locations.
     *
     * In Indian GST law every GSTIN is registered to exactly one physical address
     * — either the Principal Place of Business (PPOB) or an Additional Place of
     * Business (APOB).  A firm with multiple GST registrations therefore has one
     * location entry per GSTIN, and the GSTIN and its address are a single atomic
     * unit that must never be separated.
     *
     * Rules enforced here:
     *  • state_code is always the first two digits of gst_number (auto-derived by
     *    the frontend on input and on fetch — stored for fast querying).
     *  • registration_type distinguishes PPOB from APOB; the PPOB is the firm's
     *    primary registered seat and is always marked is_default: true.
     *  • Exactly one entry should have is_default: true at any time.
     */
    locations: [
      {
        gst_number:        { type: String },          // 15-char GSTIN
        state_code:        { type: String },          // 2-digit, derived from gst_number[0:2]
        state:             { type: String },          // human-readable state name
        registration_type: {                          // PPOB = principal; APOB = additional
          type:    String,
          enum:    ['PPOB', 'APOB'],
          default: 'PPOB',
        },
        address:           { type: String },          // street / locality / building
        city:              { type: String },
        pincode:           { type: String },
        is_default:        { type: Boolean, default: false },
      },
    ],

    phone_number:        { type: String },
    secondary_phone:     { type: String },
    email:               { type: String },
    website:             { type: String },
    business_type:       { type: String },
    industry_type:       { type: String },
    establishment_year:  { type: Number },
    employee_count:      { type: Number },
    registration_number: { type: String },
    registration_date:   { type: String },
    cin_number:          { type: String },
    pan_number:          { type: String },
    tax_id:              { type: String },
    vat_number:          { type: String },

    bank_account_number: { type: String },
    bank_name:           { type: String },
    bank_branch:         { type: String },
    ifsc_code:           { type: String },
    payment_terms:       { type: String },

    status: {
      type:    String,
      enum:    ['pending', 'approved', 'rejected'],
      default: 'approved',
    },

    license_numbers:   { type: String },
    insurance_details: { type: String },
    currency:          { type: String, default: 'INR' },
    timezone:          { type: String, default: 'Asia/Kolkata' },
    fiscal_year_start: { type: String },
    invoice_prefix:    { type: String },
    quote_prefix:      { type: String },
    po_prefix:         { type: String },
    logo_url:          { type: String },
    invoice_template:  { type: String },
    enable_e_invoice:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Firm = mongoose.model('Firm', firmSchema);

export default Firm;