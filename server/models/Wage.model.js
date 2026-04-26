import mongoose from 'mongoose';

const { Schema } = mongoose;

const wageSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    master_roll_id: {
      type: Schema.Types.ObjectId,
      ref: 'MasterRoll',
      required: true,
    },
    p_day_wage:       { type: Number },
    wage_days:        { type: Number, default: 26 },
    project:          { type: String },
    site:             { type: String },
    gross_salary:     { type: Number },
    epf_deduction:    { type: Number },
    esic_deduction:   { type: Number },
    other_deduction:  { type: Number },
    other_benefit:    { type: Number },
    advance_deduction: { type: Number, default: 0 },
    net_salary:       { type: Number },
    remarks:          { type: String },
    salary_month:     { type: String, required: true },
    paid_date:        { type: String },
    cheque_no:        { type: String },
    paid_from_bank_ac: { type: String },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const Wage = mongoose.model('Wage', wageSchema);

export default Wage;
