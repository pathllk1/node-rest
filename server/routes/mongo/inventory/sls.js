import express from 'express';
import * as inventoryController from '../../../controllers/mongo/inventory/sls/inventory.js';
import { generateInvoicePDF } from '../../../controllers/mongo/inventory/pdfMakeController.js';
import { generateInvoiceExcel } from '../../../controllers/mongo/inventory/exportUtils.js';
import * as firmManagementController from "../../../controllers/mongo/firmManagementController.js";
import { authMiddleware } from '../../../middleware/mongo/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// --- STOCKS API ---
router.get('/stocks', inventoryController.getAllStocks);
router.get('/services', inventoryController.getServiceSuggestions);
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

// --- CREDIT NOTE API ---
router.post('/create-credit-note', inventoryController.createCreditNote);

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