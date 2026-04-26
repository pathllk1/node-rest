import mongoose from 'mongoose';

const { Schema } = mongoose;

const settingsSchema = new Schema(
  {
    setting_key:   { type: String, required: true, unique: true },
    setting_value: { type: String },
    description:   { type: String },
  },
  { timestamps: true }
);

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
