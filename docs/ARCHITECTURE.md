# Architecture Overview

This application is built as a Single Page Application (SPA) with a modern Node.js backend.

## Technology Stack

### Backend
*   **Runtime:** Node.js (v18+)
*   **Framework:** Express.js
*   **Database ORM:** Prisma
*   **Database:** MongoDB
*   **Authentication:** JWT (JSON Web Tokens) & Refresh Tokens
*   **Storage:** Vercel Blob (for static assets/uploads)
*   **Logging:** Morgan
*   **Security:** 
    *   CSRF Middleware
    *   XSS Protection (xss library)
    *   Rate Limiting (RateLimit model and middleware)
    *   Input Sanitization

### Frontend
*   **Framework:** Vanilla JavaScript (ES Modules)
*   **Routing:** Navigo.js (Hash: false)
*   **Styling:** Tailwind CSS (v4)
*   **API Client:** Axios
*   **Components:** Modular JS components for layout and logic.
*   **Libraries:**
    *   ExcelJS (XLSX generation)
    *   PdfMake (PDF generation)
    *   Docx (Word document generation)
    *   Date-fns (Date manipulation)
    *   Chart.js (Data visualization)

## System Design

The application follows a modular architecture where the frontend and backend are decoupled but integrated through a set of RESTful APIs.

### Directory Structure
*   `api/`: Vercel-specific serverless entry points.
*   `client/`: Frontend codebase.
    *   `components/`: Reusable UI elements.
    *   `pages/`: Route-specific page renderers.
    *   `utils/`: Shared frontend utilities (API calls, auth logic).
*   `server/`: Backend codebase.
    *   `controllers/`: Logic for processing API requests.
    *   `models/`: Prisma/Mongoose data schemas.
    *   `routes/`: API endpoint definitions.
    *   `utils/`: Shared backend utilities (PDF, Excel, Token generation).
*   `prisma/`: Prisma schema defining the MongoDB data model.

### Key Workflows
1.  **Request Flow:** Client → Middleware (Auth, CSRF, Sanitize) → Router → Controller → Database → Response.
2.  **Auth Flow:** Login → Generate Access (15m) & Refresh (30d) Tokens → Set as HTTP-only cookies → Client uses Axios interceptors for automatic refresh.
3.  **Data Flow:** Models like `Firm`, `User`, `MasterRoll`, `Wage`, `Stock`, `Bill`, and `Ledger` form a relational-like structure in MongoDB, managed via Prisma.
