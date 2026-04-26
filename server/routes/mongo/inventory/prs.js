import express from 'express';
import multer  from 'multer';
import * as inventoryController from '../../../controllers/mongo/inventory/prs/inventory.js';
import { generateInvoicePDF } from '../../../controllers/mongo/inventory/pdfMakeController.js';
import { generateInvoiceExcel } from '../../../controllers/mongo/inventory/exportUtils.js';
import * as firmManagementController from "../../../controllers/mongo/firmManagementController.js";
import { authMiddleware } from '../../../middleware/mongo/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/* ── Multer: bill file upload ──────────────────────────────────────────────
 * Memory storage so the buffer is available for both local write and
 * optional Backblaze upload without touching the filesystem twice.
 * 200 KB hard limit; only PDF and JPEG accepted.
 * ────────────────────────────────────────────────────────────────────────── */
const _multerUpload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 200 * 1024 },          // 200 KB
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and JPEG/JPG files are allowed'), false);
        }
    },
});

/**
 * Inline error handler for multer failures (wrong type, file too large).
 * Converts multer errors into JSON 400 responses before they reach the
 * global error handler, which may format them differently.
 */
function handleBillFileUpload(req, res, next) {
    _multerUpload.single('billFile')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            const msg = err.code === 'LIMIT_FILE_SIZE'
                ? 'File too large. Maximum size is 200 KB.'
                : err.message;
            return res.status(400).json({ success: false, error: msg });
        }
        if (err) return res.status(400).json({ success: false, error: err.message });
        next();
    });
}


// --- STOCKS API ---
router.get('/stocks', inventoryController.getAllStocks);
router.post('/stocks', inventoryController.createStock);
router.get('/stocks/:id', inventoryController.getStockById);
router.put('/stocks/:id', inventoryController.updateStock);
router.delete('/stocks/:id', inventoryController.deleteStock);

// --- PARTIES API ---
router.get('/parties', inventoryController.getAllParties);
router.post('/parties', inventoryController.createParty);
router.put('/parties/:id', inventoryController.updateParty);
router.delete('/parties/:id', inventoryController.deleteParty);

// --- BILLS API ---
router.post('/bills', inventoryController.createBill);
router.post('/bills/:id/upload', handleBillFileUpload, inventoryController.uploadBillFile);
router.get('/bills/:id/attachment', inventoryController.openBillAttachment);
router.get('/bills/export', inventoryController.exportBillsExcel);
router.get('/bills/export/pdf', inventoryController.exportBillsToPdf);
router.get('/bills/:id/pdf', generateInvoicePDF);
router.get('/bills/:id/excel', generateInvoiceExcel);
router.get('/bills/:id', inventoryController.getBillById);
router.get('/bills', inventoryController.getAllBills);
router.put('/bills/:id', inventoryController.updateBill);
router.put('/bills/:id/cancel', inventoryController.cancelBill);
router.delete('/bills/:id', inventoryController.cancelBill);

// --- STOCK MOVEMENTS API ---
router.get('/stock-batches', inventoryController.getStockBatches);
router.get('/stock-movements', inventoryController.getStockMovements);
router.get('/stock-movements/export', inventoryController.exportStockMovementsToExcel);
router.get('/stock-movements/:stockId', inventoryController.getStockMovementsByStock);
router.post('/stock-movements', inventoryController.createStockMovement);

// --- DEBIT NOTE API ---
router.post('/create-debit-note', inventoryController.createDebitNote);

// --- UTILITY ENDPOINTS ---
router.get('/party-item-history', inventoryController.getPartyItemHistory);
router.get('/other-charges-types', inventoryController.getOtherChargesTypes);
router.get('/next-bill-number', inventoryController.getNextBillNumberPreviewEndpoint);
router.get('/current-firm', inventoryController.getCurrentUserFirmName);
router.get('/party-balance/:partyId', inventoryController.getPartyBalance);
router.post('/gst-lookup', inventoryController.lookupGST);
router.get('/lookup-gst', inventoryController.lookupGST);
router.get("/firm-management/firms/:id", firmManagementController.getFirm);

export default router;
