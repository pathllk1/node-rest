# Admin & Firm Management

The admin system is designed for high-level oversight of firms and users within the platform.

## Role-Based Access Control (RBAC)

The system defines four core roles:
*   **Super Admin:** Full platform access, including managing firms and auditing all system activity.
*   **Admin:** Firm-specific administrative access, manages users and settings for their assigned firm.
*   **Manager:** Elevated access within a firm for day-to-day operations like payroll and inventory.
*   **User:** Standard access for data entry and basic tasks.

## Key Modules

### 1. Firm Management
*   **Registration:** New firms register through a dedicated workflow.
*   **Approval:** Super Admins review and approve/reject pending firm requests.
*   **Details:** Comprehensive firm profiles including legal names, GST/PAN numbers, multi-location support, and banking details.
*   **Settings:** Custom firm-specific configurations for currency, timezone, and document prefixes (invoice, purchase order).

### 2. User Management
*   **Approval:** Admins/Super Admins approve or reject user registrations.
*   **Assignment:** Link users to specific firms and assign their roles.
*   **Password Management:** Reset passwords and manage MFA/session status.
*   **Creator Tool:** Simplified user creation interface for admins.

### 3. Monitoring & Auditing
*   **Admin Audit Logs:** Records all critical administrative actions (e.g., firm approval, role changes).
*   **Login Audits:** Tracks login success and failure for security monitoring.
*   **Database Browser:** A secure interface for Super Admins to inspect the MongoDB data directly through the UI.

### 4. System Settings
*   **Global Settings:** Platform-wide configurations (e.g., SMTP settings, API limits).
*   **Firm-Specific Settings:** Tailored configurations for individual business entities.

## Key Implementation Files
*   `server/routes/mongo/admin.js`: Backend routes for admin tasks.
*   `client/pages/superAdmin.js`: UI for the Super Admin dashboard.
*   `client/components/admin/`: Admin UI components (firmManager, userCreator, etc.).
*   `server/models/AdminAuditLog.model.js`: Audit log data structure.
*   `server/models/Firm.model.js`: Business entity data structure.
