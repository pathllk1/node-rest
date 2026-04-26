/**
 * System Config Controller — Mongoose version
 * Reads firm-specific settings first, falls back to global settings.
 * Uses Settings + FirmSettings Mongoose models.
 */

import { Settings, FirmSettings } from '../../models/index.js';

/* ── GET ALL ─────────────────────────────────────────────────────────────── */

export const getAllSettings = async (req, res) => {
  try {
    const globalSettings = await Settings.find().sort({ setting_key: 1 }).lean();

    let firmSettings = [];
    if (req.user?.firm_id) {
      firmSettings = await FirmSettings.find({ firm_id: req.user.firm_id }).sort({ setting_key: 1 }).lean();
    }

    res.json({ success: true, data: { global_settings: globalSettings, firm_settings: firmSettings } });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET ONE (firm-specific first, global fallback) ─────────────────────── */

export const getSetting = async (req, res) => {
  try {
    const { key } = req.params;

    if (req.user?.firm_id) {
      const firmSetting = await FirmSettings.findOne({ firm_id: req.user.firm_id, setting_key: key }).lean();
      if (firmSetting) return res.json({ success: true, data: firmSetting });
    }

    const setting = await Settings.findOne({ setting_key: key }).lean();
    if (!setting) return res.status(404).json({ success: false, error: 'Setting not found' });

    res.json({ success: true, data: setting });
  } catch (err) {
    console.error('Error fetching setting:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── UPDATE (upsert firm setting or update global) ──────────────────────── */

export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { setting_value, description } = req.body;

    if (!setting_value) {
      return res.status(400).json({ success: false, error: 'Setting value is required' });
    }

    if (req.user?.firm_id) {
      // Upsert firm-specific setting
      const updated = await FirmSettings.findOneAndUpdate(
        { firm_id: req.user.firm_id, setting_key: key },
        {
          $set: {
            setting_value,
            ...(description !== undefined && { description }),
          },
          $setOnInsert: {
            firm_id:     req.user.firm_id,
            setting_key: key,
            description: description ?? `Firm-specific ${key} setting`,
          },
        },
        { new: true, upsert: true }
      );
      const verb = updated.createdAt?.getTime() === updated.updatedAt?.getTime() ? 'created' : 'updated';
      return res.json({ success: true, message: `Setting ${verb} successfully`, data: updated });
    }

    // No firm context — update global setting
    const existing = await Settings.findOne({ setting_key: key });
    if (!existing) return res.status(404).json({ success: false, error: 'Setting not found' });

    existing.setting_value = setting_value;
    if (description !== undefined) existing.description = description;
    await existing.save();

    res.json({ success: true, message: 'Setting updated successfully', data: existing });
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET GST STATUS ─────────────────────────────────────────────────────── */

export const getGstStatus = async (req, res) => {
  try {
    if (req.user?.firm_id) {
      const firmSetting = await FirmSettings.findOne({
        firm_id:     req.user.firm_id,
        setting_key: 'gst_enabled',
      }).lean();

      if (firmSetting) {
        return res.json({ success: true, data: { gst_enabled: firmSetting.setting_value === 'true' } });
      }
    }

    const setting = await Settings.findOne({ setting_key: 'gst_enabled' }).lean();
    const gstEnabled = setting ? setting.setting_value === 'true' : true; // default true

    res.json({ success: true, data: { gst_enabled: gstEnabled } });
  } catch (err) {
    console.error('Error fetching GST status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── TOGGLE GST STATUS ──────────────────────────────────────────────────── */

export const toggleGstStatus = async (req, res) => {
  try {
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({ success: false, error: 'Enabled parameter is required (true/false)' });
    }

    const settingValue = enabled ? 'true' : 'false';

    if (req.user?.firm_id) {
      await FirmSettings.findOneAndUpdate(
        { firm_id: req.user.firm_id, setting_key: 'gst_enabled' },
        {
          $set: { setting_value: settingValue },
          $setOnInsert: {
            firm_id:     req.user.firm_id,
            setting_key: 'gst_enabled',
            description: 'Firm-specific GST calculation toggle',
          },
        },
        { upsert: true }
      );
    } else {
      await Settings.findOneAndUpdate(
        { setting_key: 'gst_enabled' },
        {
          $set: { setting_value: settingValue },
          $setOnInsert: { setting_key: 'gst_enabled', description: 'Global GST calculation toggle' },
        },
        { upsert: true }
      );
    }

    res.json({
      success: true,
      message: `GST has been ${enabled ? 'enabled' : 'disabled'} successfully`,
      data:    { gst_enabled: enabled },
    });
  } catch (err) {
    console.error('Error updating GST status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
