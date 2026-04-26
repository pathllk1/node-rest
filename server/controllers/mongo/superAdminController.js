import User from '../../models/User.model.js';
import Firm from '../../models/Firm.model.js';

export async function getSuperAdminStats(req, res) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const userCount = await User.countDocuments();
    const firmCount = await Firm.countDocuments();
    const approvedUsers = await User.countDocuments({ status: 'approved' });
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const rejectedUsers = await User.countDocuments({ status: 'rejected' });

    res.json({
      userCount,
      firmCount,
      approvedUsers,
      pendingUsers,
      rejectedUsers,
    });
  } catch (err) {
    console.error('Error fetching super admin stats:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAllUsersForAdmin(req, res) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const users = await User.find()
      .populate('firm_id', 'name')
      .select('fullname username email role status firm_id createdAt')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (err) {
    console.error('Error fetching all users for admin:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateUserRole(req, res) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { userId, newRole } = req.body;

  if (!userId || !newRole) {
    return res.status(400).json({ error: 'userId and newRole are required' });
  }

  if (!['super_admin', 'admin', 'manager', 'user'].includes(newRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true }
    ).populate('firm_id', 'name');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User role updated successfully', user });
  } catch (err) {
    console.error('Error updating user role:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAllFirmsForAdmin(req, res) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const firms = await Firm.find()
      .select('name code legal_name address city state country pincode phone_number secondary_phone email website business_type industry_type gst_number pan_number cin_number registration_number status locations createdAt')
      .sort({ createdAt: -1 });

    res.json({ firms });
  } catch (err) {
    console.error('Error fetching all firms for admin:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}