# HR & Payroll (Master Roll)

The HR module provides a central repository for employee data and a robust system for salary/wage processing.

## Core Features

### 1. Master Roll (Employee Management)
*   **Central Directory:** Store detailed employee profiles, including personal info (AADHAR, PAN), banking details, and contact information.
*   **Category Classification:** Employees are categorized (e.g., UNSKILLED, SKILLED, HIGHLY SKILLED) for standardized wage calculations.
*   **Life Cycle Tracking:** Track employee history from Date of Joining (DOJ) to Date of Exit (DOE), including status (Active/Inactive).
*   **Statutory Compliance:** Record UAN, ESIC, and Kalyan numbers for government compliance reporting.

### 2. Wage & Salary Processing
*   **Flexible Calculations:** Support for daily, monthly, or fixed-rate wages.
*   **Deductions & Benefits:** Automates standard deductions like EPF and ESIC, along with custom "other deductions" and "other benefits."
*   **Gross vs. Net:** Clearly defines the breakdown from Gross Salary to Net Take-Home Pay.
*   **Salary Cycles:** Manage wages by month/year with tracking for paid dates and payment methods (Cheque/Bank Transfer).

### 3. Site & Project Tracking
*   **Resource Allocation:** Link employees and their wages to specific projects or worksites.
*   **Cost Analysis:** Track labor costs across different segments of the business.

### 4. Automated Document Generation
*   **Appointment Letters:** Generate official appointment letters in .DOCX format based on Master Roll data.
*   **Wages Dashboard:** Provides high-level analytics on payroll expenditure, employee counts, and distribution by project/category.

## Key Implementation Files
*   `server/routes/mongo/masterRoll.routes.js`: Employee management endpoints.
*   `server/routes/mongo/wages.routes.js`: Wage processing endpoints.
*   `client/pages/master-roll.js`: UI for employee records.
*   `client/pages/WagesDashboard.js`: Payroll analytics UI.
*   `server/models/MasterRoll.model.js`: Employee data schema.
*   `server/models/Wage.model.js`: Payroll/Salary data schema.
*   `client/utils/appointmentLetterGenerator.js`: Word doc generation logic.
