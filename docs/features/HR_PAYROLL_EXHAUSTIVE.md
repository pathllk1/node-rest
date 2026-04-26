# HR & Payroll (Exhaustive)

The HR module is a comprehensive employee management and payroll processing system integrated with firm-level accounting.

## 1. Master Roll (Employee Management)
Managed by `masterRoll.controller.js`, the Master Roll is the single source of truth for employee data.

### Employee Lifecycle
*   **Onboarding**: Captures personal, banking, and statutory details (AADHAR, PAN, UAN, ESIC).
*   **Category Mapping**: Assigns employees to categories (`UNSKILLED`, `SKILLED`, `HIGHLY SKILLED`) which are linked to minimum wage rates.
*   **Status Tracking**: Tracks `Active` vs. `Inactive` (with exit dates and remarks).
*   **Linking**: Employees are linked to a specific `Firm` but can also be assigned to specific `Users` for management.

## 2. Wage Processing & Calculation
Managed by `wages.controller.js`, the system automates complex salary calculations.

### The Wage Equation
*   **Gross Salary**: `p_day_wage * wage_days`.
*   **EPF Deduction**: (Automated) Calculated as 12% (standard) of the applicable wage base, stored in `epf_deduction`.
*   **ESIC Deduction**: (Automated) Calculated as 0.75% (standard) of gross, stored in `esic_deduction`.
*   **Other Benefits**: Added to gross before final calculation.
*   **Other Deductions**: Subtracted from gross after statutory deductions.
*   **Net Salary**: `Gross + Benefits - (EPF + ESIC + Other Deductions)`.

### Payment & Reporting
*   **Salary Cycles**: Wages are grouped by `salary_month` (e.g., `2024-04`).
*   **Payment Modes**: Supports `Cash`, `Cheque`, and `Bank Transfer`.
*   **Ledger Integration**: When a wage is marked as "Paid," it can optionally trigger a ledger posting to reflect the outflow from a `BankAccount`.

## 3. Automated Document Generation
The system bridges data and official correspondence through the `appointmentLetterGenerator.js`.

### .DOCX Generation Logic
1.  **Template Retrieval**: Pulls employee data from the `MasterRoll` collection.
2.  **Dynamic Substitution**: Replaces placeholders in a pre-formatted Word document with employee-specific values (Name, Salary, DOJ, etc.).
3.  **Output**: Delivers a downloadable `.docx` file directly to the user's browser.

## 4. Wages Dashboard & Analytics
*   **Expenditure Tracking**: Visualizes total payroll cost per month.
*   **Headcount Analytics**: Reports on employee distribution by category and project/site.
*   **Compliance Monitoring**: Tracks missing statutory numbers (UAN/ESIC) to ensure reporting readiness.

## 5. Security & Access Control
*   **Role-Based Access**: Standard users can only view employees they are assigned to (`UserMasterRoll` model).
*   **Audit Trail**: Every update to an employee record or wage entry logs the `created_by` and `updated_by` user IDs for accountability.
