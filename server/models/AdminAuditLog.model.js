import mongoose from 'mongoose';

const { Schema } = mongoose;

const adminAuditLogSchema = new Schema(
  {
    // Admin who performed the action
    admin_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Target user (if applicable)
    target_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Action type: password_change, role_change, status_change, etc.
    action: {
      type: String,
      enum: ['password_change', 'role_change', 'status_change', 'user_create', 'user_delete', 'firm_create', 'firm_delete', 'firm_update', 'other'],
      required: true,
      index: true,
    },
    // Details about what was changed
    details: {
      type: Schema.Types.Mixed,
      default: null,
    },
    // IP address of admin making the change
    ip_address: {
      type: String,
      default: null,
    },
    // User agent of admin making the change
    user_agent: {
      type: String,
      default: null,
    },
    // Success or failure of the action
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
    // Reason for failure (if applicable)
    error_message: {
      type: String,
      default: null,
    },
  },
  { timestamps: true, collection: 'admin_audit_logs' }
);

// Index for efficient querying of admin actions
adminAuditLogSchema.index({ admin_id: 1, createdAt: -1 });
adminAuditLogSchema.index({ target_user_id: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model('AdminAuditLog', adminAuditLogSchema);
