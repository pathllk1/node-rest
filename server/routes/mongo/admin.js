import express from "express";
import bcrypt from "bcrypt";
import User from "../../models/User.model.js";
import Firm from "../../models/Firm.model.js";
import AdminAuditLog from "../../models/AdminAuditLog.model.js";
import { authMiddleware as authenticateJWT } from "../../middleware/mongo/authMiddleware.js";
import { requireRole } from "../../middleware/mongo/auth.js";
import * as firmManagementController from "../../controllers/mongo/firmManagementController.js";
import * as superAdminController from "../../controllers/mongo/superAdminController.js";

const router = express.Router();

/* --------------------------------------------------
   USER MANAGEMENT ROUTES  (MongoDB)
   All require super_admin role
-------------------------------------------------- */

// Get all users
router.get("/users", authenticateJWT, requireRole("super_admin"), async (req, res) => {
  try {
    const users = await User.aggregate([
      { $match: { role: { $ne: 'super_admin' } } },
      { $lookup: { from: 'firms', localField: 'firm_id', foreignField: '_id', as: 'firm' } },
      { $unwind: { path: '$firm', preserveNullAndEmptyArrays: true } },
      { $project: {
        id: '$_id',
        username: 1,
        email: 1,
        fullname: 1,
        role: 1,
        status: 1,
        created_at: '$createdAt',
        updated_at: '$updatedAt',
        firm_name: { $ifNull: ['$firm.name', 'No Firm'] },
        firm_code: '$firm.code'
      } },
      { $sort: { created_at: -1 } }
    ]);
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// Get pending users
router.get("/users/pending", authenticateJWT, requireRole("super_admin"), async (req, res) => {
  try {
    const users = await User.aggregate([
      { $match: { status: 'pending' } },
      { $lookup: { from: 'firms', localField: 'firm_id', foreignField: '_id', as: 'firm' } },
      { $unwind: { path: '$firm', preserveNullAndEmptyArrays: true } },
      { $project: {
        id: '$_id',
        username: 1,
        email: 1,
        fullname: 1,
        role: 1,
        status: 1,
        created_at: '$createdAt',
        updated_at: '$updatedAt',
        firm_name: { $ifNull: ['$firm.name', 'No Firm'] },
        firm_code: '$firm.code'
      } },
      { $sort: { created_at: -1 } }
    ]);
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get pending users error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch pending users" });
  }
});

// Approve / Reject user
router.patch("/users/:id/status", authenticateJWT, requireRole("super_admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const updatedUser = await User.findByIdAndUpdate(id, { status }, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, message: `User ${status} successfully` });
  } catch (err) {
    console.error("Update user status error:", err);
    res.status(500).json({ success: false, error: "Failed to update user status" });
  }
});

// Dashboard stats  (MongoDB counts for users; firm counts come from Mongo below if needed)
router.get("/stats", authenticateJWT, requireRole("super_admin"), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: { $ne: 'super_admin' } });
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const approvedUsers = await User.countDocuments({ status: 'approved' });
    const stats = {
      totalUsers,
      pendingUsers,
      approvedUsers,
    };
    res.json({ success: true, stats });
  } catch (err) {
    console.error("Get stats error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

/* --------------------------------------------------
   FIRM MANAGEMENT ROUTES  (MongoDB via firmManagementController)
   NOTE: These must come AFTER the user routes and must not be
   duplicated – Express matches the FIRST registered handler.
-------------------------------------------------- */

// Create firm (with full details + optional admin account)
router.post("/firms", authenticateJWT, requireRole("super_admin"), firmManagementController.createFirm);

// List all firms
router.get("/firms", authenticateJWT, requireRole("super_admin"), firmManagementController.getAllFirms);

// Get single firm by ID
router.get("/firms/:id", authenticateJWT, requireRole("super_admin"), firmManagementController.getFirm);

// Update firm
router.put("/firms/:id", authenticateJWT, requireRole("super_admin"), firmManagementController.updateFirm);

// Delete firm
router.delete("/firms/:id", authenticateJWT, requireRole("super_admin"), firmManagementController.deleteFirm);

// Assign / unassign user to a firm
router.post("/assign-user-to-firm", authenticateJWT, requireRole("super_admin"), firmManagementController.assignUserToFirm);

// Get all users with their assigned firms (MongoDB population)
router.get("/users-with-firms", authenticateJWT, requireRole(["super_admin", "admin"]), firmManagementController.getAllUsersWithFirms);

// Create user (admin only for their firm)
router.post("/users", authenticateJWT, requireRole("admin"), firmManagementController.createUser);
router.put("/users/:id", authenticateJWT, requireRole("admin"), firmManagementController.updateUser);

// Super Admin Routes
router.get('/super-admin/stats', authenticateJWT, requireRole('super_admin'), superAdminController.getSuperAdminStats);
router.get('/super-admin/users', authenticateJWT, requireRole('super_admin'), superAdminController.getAllUsersForAdmin);
router.put('/super-admin/users/role', authenticateJWT, requireRole('super_admin'), superAdminController.updateUserRole);
router.get('/super-admin/firms', authenticateJWT, requireRole('super_admin'), superAdminController.getAllFirmsForAdmin);

/* --------------------------------------------------
   PASSWORD MANAGEMENT ROUTES (MongoDB)
   Super admin only - Update user passwords with audit logging
-------------------------------------------------- */

// Get all users (excluding super_admin) for password management
router.get('/super-admin/users/for-password-update', authenticateJWT, requireRole('super_admin'), async (req, res) => {
  try {
    const users = await User.aggregate([
      { $match: { role: { $ne: 'super_admin' }, status: 'approved' } },
      { $lookup: { from: 'firms', localField: 'firm_id', foreignField: '_id', as: 'firm' } },
      { $unwind: { path: '$firm', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 1,
        id: '$_id',
        username: 1,
        email: 1,
        fullname: 1,
        role: 1,
        status: 1,
        created_at: '$createdAt',
        firm_name: { $ifNull: ['$firm.name', 'No Firm'] },
        firm_code: '$firm.code'
      } },
      { $sort: { fullname: 1 } }
    ]);
    res.json({ success: true, users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Update user password (Super admin only)
router.post('/super-admin/users/update-password', authenticateJWT, requireRole('super_admin'), async (req, res) => {
  console.log('[UPDATE-PASSWORD ROUTE] 🎯 Route handler called!');
  console.log('[UPDATE-PASSWORD ROUTE] req.user:', req.user ? { id: req.user.id, role: req.user.role } : null);
  console.log('[UPDATE-PASSWORD ROUTE] req.body:', req.body);
  
  try {
    const { userId, newPassword } = req.body;
    const adminId = req.user.id;
    const adminIp = req.ip || req.connection.remoteAddress;

    console.log('[UPDATE-PASSWORD] Request details:', { userId, adminId, hasPassword: !!newPassword });

    // Validation: Check inputs
    if (!userId || !newPassword) {
      console.log('[UPDATE-PASSWORD] ❌ Missing inputs: userId or newPassword');
      return res.status(400).json({
        success: false,
        error: 'User ID and new password are required'
      });
    }

    // Validation: Password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Validation: Check if user exists and is not super_admin
    const targetUser = await User.findOne({ _id: userId, role: { $ne: 'super_admin' } });
    if (!targetUser) {
      // Log failed attempt
      await AdminAuditLog.create({
        admin_id: adminId,
        target_user_id: userId,
        action: 'password_change',
        status: 'failed',
        error_message: 'User not found or is super admin',
        ip_address: adminIp,
      });

      return res.status(404).json({
        success: false,
        error: 'User not found or cannot modify super admin password'
      });
    }

    // Hash the new password using bcrypt (12 rounds for consistency)
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    await User.findByIdAndUpdate(
      userId,
      {
        password: hashedPassword,
        // Reset failed login attempts and unlock account
        failed_login_attempts: 0,
        account_locked_until: null,
      },
      { new: true }
    );

    // Log successful password change in AdminAuditLog
    await AdminAuditLog.create({
      admin_id: adminId,
      target_user_id: userId,
      action: 'password_change',
      status: 'success',
      details: {
        username: targetUser.username,
        email: targetUser.email,
        fullname: targetUser.fullname,
      },
      ip_address: adminIp,
    });

    res.json({
      success: true,
      message: `Password updated successfully for ${targetUser.fullname}`,
      user: {
        id: targetUser._id,
        username: targetUser.username,
        email: targetUser.email,
        fullname: targetUser.fullname
      }
    });
  } catch (err) {
    console.error('Error updating user password:', err);

    try {
      await AdminAuditLog.create({
        admin_id: req.user?.id,
        action: 'password_change',
        status: 'failed',
        error_message: err.message,
        ip_address: req.ip || req.connection.remoteAddress,
      });
    } catch (logErr) {
      console.error('Error logging failed password update:', logErr);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update password. Please try again.'
    });
  }
});

// Get password change audit log
router.get('/super-admin/password-audit-log', authenticateJWT, requireRole('super_admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const logs = await AdminAuditLog.aggregate([
      { $match: { action: 'password_change' } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: { from: 'users', localField: 'admin_id', foreignField: '_id', as: 'admin' } },
      { $lookup: { from: 'users', localField: 'target_user_id', foreignField: '_id', as: 'target_user' } },
      { $unwind: { path: '$admin', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$target_user', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 1,
        action: 1,
        status: 1,
        createdAt: 1,
        admin_name: '$admin.fullname',
        admin_username: '$admin.username',
        target_username: '$target_user.username',
        target_fullname: '$target_user.fullname',
        target_email: '$target_user.email',
        details: 1,
        error_message: 1,
        ip_address: 1,
      } }
    ]);

    const total = await AdminAuditLog.countDocuments({ action: 'password_change' });

    res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching password audit log:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log'
    });
  }
});

export default router;
