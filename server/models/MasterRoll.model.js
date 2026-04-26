import mongoose from 'mongoose';

const { Schema } = mongoose;

const masterRollSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    employee_name:       { type: String, required: true },
    father_husband_name: { type: String, required: true },
    date_of_birth:       { type: String, required: true },
    aadhar:              { type: String, required: true },
    pan:                 { type: String },
    phone_no:            { type: String, required: true },
    address:             { type: String, required: true },
    bank:                { type: String, required: true },
    account_no:          { type: String, required: true },
    ifsc:                { type: String, required: true },
    branch:              { type: String },
    uan:                 { type: String },
    esic_no:             { type: String },
    s_kalyan_no:         { type: String },
    category:            { type: String, default: 'UNSKILLED' },
    p_day_wage:          { type: Number },
    project:             { type: String },
    site:                { type: String },
    date_of_joining:     { type: String, required: true },
    date_of_exit:        { type: String },
    doe_rem:             { type: String },
    status:              { type: String, default: 'Active' },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const MasterRoll = mongoose.model('MasterRoll', masterRollSchema);

export default MasterRoll;
