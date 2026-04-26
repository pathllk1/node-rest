/**
 * Settings Controller — Mongoose version
 * Global settings CRUD using the Settings Mongoose model.
 */

import { Settings } from '../../models/index.js';

/* ── CREATE ─────────────────────────────────────────────────────────────── */

export const createSetting = async (req, res) => {
  try {
    const { setting_key, setting_value, description } = req.body;

    if (!setting_key || !setting_value) {
      return res.status(400).json({ success: false, error: 'Setting key and value are required' });
    }

    const existing = await Settings.findOne({ setting_key }).lean();
    if (existing) {
      return res.status(409).json({ success: false, error: 'Setting already exists' });
    }

    const newSetting = await Settings.create({ setting_key, setting_value, description: description ?? null });

    res.status(201).json({ success: true, message: 'Setting created successfully', data: newSetting });
  } catch (err) {
    console.error('Error creating setting:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET ALL ─────────────────────────────────────────────────────────────── */

export const getAllSettings = async (req, res) => {
  try {
    const settings = await Settings.find().sort({ setting_key: 1 }).lean();
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET ONE ─────────────────────────────────────────────────────────────── */

export const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await Settings.findOne({ setting_key: key }).lean();

    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    res.json({ success: true, data: setting });
  } catch (err) {
    console.error('Error fetching setting:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── UPDATE ─────────────────────────────────────────────────────────────── */

export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { setting_value, description } = req.body;

    if (!setting_value) {
      return res.status(400).json({ success: false, error: 'Setting value is required' });
    }

    const existing = await Settings.findOne({ setting_key: key });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    existing.setting_value = setting_value;
    if (description !== undefined) existing.description = description;
    await existing.save();

    res.json({ success: true, message: 'Setting updated successfully', data: existing });
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
