import mongoose from 'mongoose';

const { Schema } = mongoose;

const firmSettingsSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    setting_key:   { type: String, required: true },
    setting_value: { type: String },
    description:   { type: String },
  },
  { timestamps: true }
);

// Mirrors UNIQUE(firm_id, setting_key) in SQLite
firmSettingsSchema.index({ firm_id: 1, setting_key: 1 }, { unique: true });

const FirmSettings = mongoose.model('FirmSettings', firmSettingsSchema);

export default FirmSettings;
