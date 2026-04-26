
import mongoose from 'mongoose';
import ExcelJS   from 'exceljs';
import {
  Stock, Party, Bill, StockReg, Firm,
} from '../../../models/index.js';
import { exportBillsToExcel } from './exportUtils.js';
import { exportBillsToPdf } from './pdfExportController.js';
import {
  getActorUsername,
  getFirmId,
  validateObjectId,
  normalizeOptionalText,
  normalizeOptionalMultilineText,
  escapeRegex,
} from './billUtils.js';
import { getStateCode } from '../../../utils/mongo/gstCalculator.js';

/* ═══════════════════════════════════════════════════════════════════════════
   STOCKS
═══════════════════════════════════════════════════════════════════════════ */

export const getAllStocks = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_ALL_STOCKS');
    if (!firmId) return;

    const stocks = await Stock.find({ firm_id: firmId }).lean();

    const flattenedStocks = stocks.map(stock => {
      const flattened = { ...stock, id: stock._id.toString() };
      if (stock.batches?.length > 0) {
        const b0 = stock.batches[0];
        flattened.batch      = b0.batch;
        flattened.mrp        = b0.mrp;
        flattened.expiryDate = b0.expiry;
        if (!flattened.qty  && b0.qty)  flattened.qty  = b0.qty;
        if (!flattened.rate && b0.rate) flattened.rate = b0.rate;
      }
      flattened.pno   = flattened.pno  || '';
      flattened.oem   = flattened.oem  || '';
      flattened.hsn   = flattened.hsn  || '0000';
      flattened.qty   = flattened.qty  || 0;
      flattened.uom   = flattened.uom  || 'PCS';
      flattened.rate  = flattened.rate || 0;
      flattened.grate = flattened.grate || 18;
      flattened.total = flattened.total || (flattened.qty * flattened.rate);
      flattened.mrp   = flattened.mrp  || flattened.rate * 1.2;
      return flattened;
    });

    res.json({ success: true, data: flattenedStocks });
  } catch (err) {
    console.error('[GET_ALL_STOCKS] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getServiceSuggestions = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_SERVICE_SUGGESTIONS');
    if (!firmId) return;

    // Fetch all SERVICE items from StockReg for this firm
    const services = await StockReg.find({
      firm_id: firmId,
      item_type: 'SERVICE',
      item: { $exists: true, $ne: '' }
    })
    .select('item hsn uom rate grate')
    .lean();

    // Remove duplicates by item name and format response
    const uniqueServices = [];
    const seen = new Set();
    
    for (const service of services) {
      if (!seen.has(service.item)) {
        seen.add(service.item);
        uniqueServices.push({
          item: service.item || '',
          hsn: service.hsn || '',
          uom: service.uom || '',
          rate: parseFloat(service.rate) || 0,
          grate: parseFloat(service.grate) || 18,
        });
      }
    }

    res.json({ success: true, data: uniqueServices });
  } catch (err) {
    console.error('[GET_SERVICE_SUGGESTIONS] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getStockById = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'GET_STOCK_BY_ID');
    if (!firmId) return;
    const stockId = validateObjectId(req.params.id, 'stock ID', res);
    if (!stockId) return;
    const stock = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean();
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    res.json({ success: true, data: stock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createStock = async (req, res) => {
  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
    const firmId = getFirmId(req, res, 'CREATE_STOCK');
    if (!firmId) return;

    let { item, pno, batch, oem, hsn, qty, uom, rate, grate, mrp, expiryDate, batches } = req.body;

    let parsedBatches = null;
    if (batches) {
      try {
        parsedBatches = Array.isArray(batches) ? batches : JSON.parse(batches);
        if (!Array.isArray(parsedBatches)) parsedBatches = null;
      } catch { /* ignore */ }
    }

    if (parsedBatches?.length > 0 && !batch && !qty && !rate && !mrp && !expiryDate) {
      const b0 = parsedBatches[0] || {};
      batch = b0.batch ?? batch; qty = b0.qty ?? qty; rate = b0.rate ?? rate;
      mrp = b0.mrp ?? mrp; expiryDate = b0.expiry ?? expiryDate;
    }

    const existingStock = await Stock.findOne({ firm_id: firmId, item }).lean();

    if (existingStock) {
      let existingBatches = Array.isArray(existingStock.batches) ? [...existingStock.batches] : [];

      if (parsedBatches?.length > 0) {
        const b0 = parsedBatches[0] || {};
        batch = b0.batch ?? batch; qty = b0.qty ?? qty; rate = b0.rate ?? rate;
        mrp = b0.mrp ?? mrp; expiryDate = b0.expiry ?? expiryDate;
      }

      const existingBatchIdx = existingBatches.findIndex(b => b.batch === batch);
      if (existingBatchIdx !== -1) {
        existingBatches[existingBatchIdx].qty += parseFloat(qty);
        if (mrp !== undefined && mrp !== null && mrp !== '')       existingBatches[existingBatchIdx].mrp    = parseFloat(mrp);
        if (expiryDate)                                            existingBatches[existingBatchIdx].expiry = expiryDate;
        if (rate !== undefined && rate !== null && rate !== '')    existingBatches[existingBatchIdx].rate   = parseFloat(rate);
        if (uom  !== undefined && uom  !== null && uom  !== '')   existingBatches[existingBatchIdx].uom    = uom;
        if (grate !== undefined && grate !== null && grate !== '') existingBatches[existingBatchIdx].grate  = parseFloat(grate);
      } else {
        existingBatches.push({
          batch: batch || null, qty: parseFloat(qty), rate: parseFloat(rate),
          uom: uom || 'PCS', grate: parseFloat(grate) || 18,
          expiry: expiryDate || null, mrp: mrp ? parseFloat(mrp) : null,
        });
      }

      const newTotalQty = existingBatches.reduce((s, b) => s + b.qty, 0);
      const newTotal    = newTotalQty * parseFloat(rate);

      await Stock.findOneAndUpdate(
        { _id: existingStock._id, firm_id: firmId },
        { $set: { item, pno: pno || null, oem: oem || null, hsn, qty: newTotalQty, uom, rate: parseFloat(rate), grate: parseFloat(grate), total: newTotal, mrp: mrp ? parseFloat(mrp) : null, batches: existingBatches, user: actorUsername } }
      );
      return res.json({ success: true, id: existingStock._id, message: 'Stock batch updated successfully' });
    } else {
      const batchesToStore = parsedBatches?.length > 0
        ? parsedBatches
        : [{ batch: batch || null, qty: parseFloat(qty), rate: parseFloat(rate), expiry: expiryDate || null, mrp: mrp ? parseFloat(mrp) : null }];
      const total = parseFloat(qty) * parseFloat(rate);
      const newStock = await Stock.create({
        firm_id: firmId, item, pno: pno || null, oem: oem || null, hsn,
        qty: parseFloat(qty) || 0, uom: uom || 'PCS', rate: parseFloat(rate) || 0,
        grate: parseFloat(grate) || 0, total,
        mrp: mrp ? parseFloat(mrp) : null, batches: batchesToStore, user: actorUsername,
      });
      return res.json({ success: true, id: newStock._id, message: 'Stock added successfully' });
    }
  } catch (err) {
    console.error('[CREATE_STOCK] Error:', err.message);
    res.status(400).json({ error: err.message });
  }
};

export const updateStock = async (req, res) => {
  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const firmId  = getFirmId(req, res, 'UPDATE_STOCK');
    if (!firmId) return;
    const stockId = validateObjectId(req.params.id, 'stock ID', res);
    if (!stockId) return;

    let { item, pno, batch, oem, hsn, qty, uom, rate, grate, mrp, expiryDate, batches: incomingBatches } = req.body;

    const currentStock = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean();
    if (!currentStock) return res.status(404).json({ success: false, error: 'Stock not found or does not belong to your firm' });

    let batches = Array.isArray(currentStock.batches) ? [...currentStock.batches] : [];

    if (incomingBatches) {
      try {
        const parsed = Array.isArray(incomingBatches) ? incomingBatches : JSON.parse(incomingBatches);
        if (Array.isArray(parsed)) batches = parsed;
      } catch { /* ignore */ }
      const b0 = batches.length > 0 ? batches[0] : null;
      if (b0) {
        if (!batch && b0.batch !== undefined)          batch      = b0.batch;
        if (!qty   && b0.qty   !== undefined)          qty        = b0.qty;
        if (!rate  && b0.rate  !== undefined)          rate       = b0.rate;
        if (!mrp   && b0.mrp   !== undefined)          mrp        = b0.mrp;
        if (!expiryDate && b0.expiry !== undefined)    expiryDate = b0.expiry;
        if (!uom    && b0.uom  !== undefined)          uom        = b0.uom;
        if (!grate  && b0.grate !== undefined)         grate      = b0.grate;
      }
    } else if (batch) {
      const batchIndex = batches.findIndex(b => b.batch === batch);
      if (batchIndex !== -1) {
        batches[batchIndex].qty = parseFloat(qty) || batches[batchIndex].qty;
        if (rate       !== undefined && rate       !== null) batches[batchIndex].rate   = parseFloat(rate);
        if (uom        !== undefined && uom        !== null) batches[batchIndex].uom    = uom;
        if (grate      !== undefined && grate      !== null) batches[batchIndex].grate  = parseFloat(grate);
        if (expiryDate !== undefined && expiryDate !== null) batches[batchIndex].expiry = expiryDate;
        if (mrp        !== undefined && mrp        !== null) batches[batchIndex].mrp    = parseFloat(mrp);
      } else {
        batches.push({ batch, qty: parseFloat(qty), rate: parseFloat(rate), uom: uom || 'PCS', grate: parseFloat(grate) || 18, expiry: expiryDate || null, mrp: mrp ? parseFloat(mrp) : null });
      }
    }

    const newTotalQty = batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);
    let rootRate = parseFloat(rate || currentStock.rate || 0);
    let rootMrp  = mrp ? parseFloat(mrp) : currentStock.mrp;
    if (batches.length > 0 && batches[0].rate !== undefined) rootRate = parseFloat(batches[0].rate);
    if (batches.length > 0 && batches[0].mrp  !== undefined && batches[0].mrp !== null) rootMrp = parseFloat(batches[0].mrp);

    await Stock.findOneAndUpdate(
      { _id: stockId, firm_id: firmId },
      { $set: { item, pno: pno || null, oem: oem || null, hsn, qty: newTotalQty, uom, rate: rootRate, grate: parseFloat(grate), total: newTotalQty * rootRate, mrp: rootMrp, batches, user: actorUsername } }
    );

    res.json({ success: true, message: 'Stock updated successfully' });
  } catch (err) {
    console.error('[UPDATE_STOCK] Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

export const deleteStock = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'DELETE_STOCK');
    if (!firmId) return;
    const stockId = validateObjectId(req.params.id, 'stock ID', res);
    if (!stockId) return;
    const existing = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean();
    if (!existing) return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });
    await Stock.deleteOne({ _id: stockId, firm_id: firmId });
    res.json({ success: true, message: 'Stock deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   PARTIES
═══════════════════════════════════════════════════════════════════════════ */

export const getAllParties = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_ALL_PARTIES');
    if (!firmId) return;
    const parties = await Party.find({ firm_id: firmId }).lean();
    res.json({ success: true, data: parties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createParty = async (req, res) => {
  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
    const firmId = getFirmId(req, res, 'CREATE_PARTY');
    if (!firmId) return;
    
    const { firm, gstin, contact, state, state_code, addr, pin, pan, gstLocations } = req.body;
    
    // Determine if this is multi-GST or single-GST
    const isMultiGst = Array.isArray(gstLocations) && gstLocations.length > 0;
    
    let finalGstin = gstin || 'UNREGISTERED';
    let finalContact = contact || null;
    let finalState = state || '';
    let finalStateCode = state_code || null;
    let finalAddr = addr || null;
    let finalPin = pin || null;
    let finalGstLocations = [];
    let primaryGstinIndex = 0;
    
    if (isMultiGst) {
      // Multi-GST mode: validate and process locations
      finalGstLocations = gstLocations.map((loc, idx) => {
        const locGstin = normalizeOptionalText(loc.gstin, 15);
        const locState = normalizeOptionalText(loc.state, 80);
        const locStateCode = locGstin && locGstin !== 'UNREGISTERED' && /^\d{2}/.test(locGstin)
          ? locGstin.substring(0, 2)
          : (loc.state_code || (locState ? getStateCode(locState) : null));
        
        return {
          gstin: locGstin || 'UNREGISTERED',
          state_code: locStateCode,
          state: locState,
          address: normalizeOptionalText(loc.address, 500) || null,
          city: normalizeOptionalText(loc.city, 100) || null,
          pincode: normalizeOptionalText(loc.pincode, 10) || null,
          contact: normalizeOptionalText(loc.contact, 20) || null,
          is_primary: loc.is_primary === true,
        };
      });
      
      // Find primary location (should be exactly one)
      const primaryIdx = finalGstLocations.findIndex(l => l.is_primary);
      if (primaryIdx !== -1) {
        primaryGstinIndex = primaryIdx;
      } else if (finalGstLocations.length > 0) {
        // Default to first if none marked as primary
        finalGstLocations[0].is_primary = true;
        primaryGstinIndex = 0;
      }
      
      // Sync legacy fields from primary location
      const primaryLoc = finalGstLocations[primaryGstinIndex];
      if (primaryLoc) {
        finalGstin = primaryLoc.gstin;
        finalState = primaryLoc.state;
        finalStateCode = primaryLoc.state_code;
        finalAddr = primaryLoc.address;
        finalPin = primaryLoc.pincode;
        finalContact = primaryLoc.contact;
      }
    } else {
      // Single-GST mode (legacy): derive state code from GSTIN or state name
      if (finalGstin && finalGstin !== 'UNREGISTERED' && /^\d{2}/.test(finalGstin)) {
        finalStateCode = finalGstin.substring(0, 2);
      } else if (finalState) {
        finalStateCode = getStateCode(finalState);
      }
    }
    
    const newParty = await Party.create({
      firm_id: firmId,
      firm,
      gstin: finalGstin,
      contact: finalContact,
      state: finalState,
      state_code: finalStateCode,
      addr: finalAddr,
      pin: finalPin,
      pan: pan || null,
      gstLocations: finalGstLocations,
      primary_gstin_index: primaryGstinIndex,
      usern: actorUsername,
      supply: finalState,
    });
    
    res.json({
      success: true,
      id: newParty._id,
      firm: newParty.firm,
      gstin: newParty.gstin,
      contact: newParty.contact,
      state: newParty.state,
      state_code: newParty.state_code,
      addr: newParty.addr,
      pin: newParty.pin,
      pan: newParty.pan,
      gstLocations: newParty.gstLocations,
      primary_gstin_index: newParty.primary_gstin_index,
      message: isMultiGst ? 'Party with multiple GST registrations created successfully' : 'Party created successfully',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateParty = async (req, res) => {
  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
    const firmId = getFirmId(req, res, 'UPDATE_PARTY');
    if (!firmId) return;
    const partyId = validateObjectId(req.params.id, 'party ID', res);
    if (!partyId) return;
    
    const { firm, gstin, contact, state, state_code, addr, pin, pan, gstLocations, primary_gstin_index } = req.body;
    
    const existingParty = await Party.findOne({ _id: partyId, firm_id: firmId }).lean();
    if (!existingParty) return res.status(404).json({ error: 'Party not found or does not belong to your firm' });
    
    // Determine if this is multi-GST or single-GST
    const isMultiGst = Array.isArray(gstLocations) && gstLocations.length > 0;
    
    let finalGstin = gstin || 'UNREGISTERED';
    let finalContact = contact || null;
    let finalState = state || '';
    let finalStateCode = state_code || null;
    let finalAddr = addr || null;
    let finalPin = pin || null;
    let finalGstLocations = [];
    let finalPrimaryGstinIndex = 0;
    
    if (isMultiGst) {
      // Multi-GST mode: validate and process locations
      finalGstLocations = gstLocations.map((loc) => {
        const locGstin = normalizeOptionalText(loc.gstin, 15);
        const locState = normalizeOptionalText(loc.state, 80);
        const locStateCode = locGstin && locGstin !== 'UNREGISTERED' && /^\d{2}/.test(locGstin)
          ? locGstin.substring(0, 2)
          : (loc.state_code || (locState ? getStateCode(locState) : null));
        
        return {
          gstin: locGstin || 'UNREGISTERED',
          state_code: locStateCode,
          state: locState,
          address: normalizeOptionalText(loc.address, 500) || null,
          city: normalizeOptionalText(loc.city, 100) || null,
          pincode: normalizeOptionalText(loc.pincode, 10) || null,
          contact: normalizeOptionalText(loc.contact, 20) || null,
          is_primary: loc.is_primary === true,
        };
      });
      
      // Validate primary index
      if (typeof primary_gstin_index === 'number' && primary_gstin_index >= 0 && primary_gstin_index < finalGstLocations.length) {
        finalPrimaryGstinIndex = primary_gstin_index;
      } else {
        const primaryIdx = finalGstLocations.findIndex(l => l.is_primary);
        finalPrimaryGstinIndex = primaryIdx !== -1 ? primaryIdx : 0;
      }
      
      // Ensure exactly one is marked as primary
      finalGstLocations.forEach((loc, idx) => {
        loc.is_primary = idx === finalPrimaryGstinIndex;
      });
      
      // Sync legacy fields from primary location
      const primaryLoc = finalGstLocations[finalPrimaryGstinIndex];
      if (primaryLoc) {
        finalGstin = primaryLoc.gstin;
        finalState = primaryLoc.state;
        finalStateCode = primaryLoc.state_code;
        finalAddr = primaryLoc.address;
        finalPin = primaryLoc.pincode;
        finalContact = primaryLoc.contact;
      }
    } else {
      // Single-GST mode (legacy)
      if (finalGstin && finalGstin !== 'UNREGISTERED' && /^\d{2}/.test(finalGstin)) {
        finalStateCode = finalGstin.substring(0, 2);
      } else if (finalState) {
        finalStateCode = getStateCode(finalState);
      }
    }
    
    await Party.findOneAndUpdate(
      { _id: partyId, firm_id: firmId },
      {
        $set: {
          firm: firm || existingParty.firm,
          gstin: finalGstin,
          contact: finalContact,
          state: finalState,
          state_code: finalStateCode,
          addr: finalAddr,
          pin: finalPin,
          pan: pan || existingParty.pan || null,
          gstLocations: finalGstLocations,
          primary_gstin_index: finalPrimaryGstinIndex,
          supply: finalState,
        },
      }
    );
    
    res.json({
      success: true,
      message: isMultiGst ? 'Party with multiple GST registrations updated successfully' : 'Party updated successfully',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteParty = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'DELETE_PARTY');
    if (!firmId) return;
    const partyId = validateObjectId(req.params.id, 'party ID', res);
    if (!partyId) return;
    
    const existingParty = await Party.findOne({ _id: partyId, firm_id: firmId }).lean();
    if (!existingParty) return res.status(404).json({ error: 'Party not found or does not belong to your firm' });
    
    await Party.deleteOne({ _id: partyId, firm_id: firmId });
    res.json({ success: true, message: 'Party deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   BILLS (read-only — getBillById and getAllBills are identical in both controllers)
═══════════════════════════════════════════════════════════════════════════ */

export const getBillById = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_BILL_BY_ID');
    if (!firmId) return;
    const billId = validateObjectId(req.params.id, 'bill ID', res);
    if (!billId) return;
    const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: { ...bill, items, otherCharges: bill.other_charges ?? [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllBills = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_ALL_BILLS');
    if (!firmId) return;
    const bills = await Bill.find({ firm_id: firmId }).sort({ createdAt: -1 }).lean();
    res.json(bills.map(b => ({ ...b, otherCharges: b.other_charges ?? [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const exportBillsExcel = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'EXPORT_BILLS_EXCEL');
    if (!firmId) return;
    const { type, searchTerm, dateFrom, dateTo } = req.query;
    let bills = await Bill.find({ firm_id: firmId }).sort({ createdAt: -1 }).lean();
    if (type)       bills = bills.filter(b => b.btype === type);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      bills = bills.filter(b => (b.bno || '').toLowerCase().includes(term) || (b.firm || '').toLowerCase().includes(term));
    }
    if (dateFrom || dateTo) {
      bills = bills.filter(b => {
        const bdate = new Date(b.bdate);
        if (dateFrom && bdate < new Date(dateFrom)) return false;
        if (dateTo) { const t = new Date(dateTo); t.setHours(23, 59, 59, 999); if (bdate > t) return false; }
        return true;
      });
    }
    const buffer = await exportBillsToExcel(bills);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=bills-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
};

export { exportBillsToPdf };

/* ═══════════════════════════════════════════════════════════════════════════
   STOCK MOVEMENTS
═══════════════════════════════════════════════════════════════════════════ */

export const getStockBatches = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'GET_STOCK_BATCHES');
    if (!firmId) return;
    const stockId = validateObjectId(req.params.id, 'stock ID', res);
    if (!stockId) return;
    const stock = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean();
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    res.json({ success: true, data: { id: stock._id, item: stock.item, batches: stock.batches ?? [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getStockMovements = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_STOCK_MOVEMENTS');
    if (!firmId) return;

    const { type, batchFilter, searchTerm, page = 1, limit = 50, partyId, stockId } = req.query;
    const pageInt  = Math.max(1, parseInt(page));
    const limitInt = Math.max(1, parseInt(limit));
    const fid      = new mongoose.Types.ObjectId(firmId);

    const matchStage = { firm_id: fid, stock_id: { $ne: null } };
    if (type)        matchStage.type  = type;
    if (batchFilter) matchStage.batch = batchFilter;
    if (searchTerm?.trim()) {
      const regex = new RegExp(searchTerm.trim(), 'i');
      matchStage.$or = [{ item: regex }, { bno: regex }];
    }
    if (stockId && mongoose.Types.ObjectId.isValid(stockId)) {
      matchStage.stock_id = new mongoose.Types.ObjectId(stockId);
    }

    const pipeline = [
      { $match: matchStage },
      { $lookup: { from: 'stocks',  localField: 'stock_id',         foreignField: '_id', as: 'stockDoc' } },
      { $lookup: { from: 'bills',   localField: 'bill_id',          foreignField: '_id', as: 'billDoc'  } },
    ];
    if (partyId && mongoose.Types.ObjectId.isValid(partyId)) {
      pipeline.push({ $match: { 'billDoc.party_id': new mongoose.Types.ObjectId(partyId) } });
    }
    pipeline.push(
      { $lookup: { from: 'parties', localField: 'billDoc.party_id', foreignField: '_id', as: 'partyDoc' } },
      { $addFields: { stock_item: { $arrayElemAt: ['$stockDoc.item', 0] }, bill_date: { $arrayElemAt: ['$billDoc.bdate', 0] }, party_name: { $arrayElemAt: ['$partyDoc.firm', 0] } } },
      { $project: { stockDoc: 0, billDoc: 0, partyDoc: 0 } },
      { $sort:  { createdAt: -1 } },
      { $skip:  (pageInt - 1) * limitInt },
      { $limit: limitInt },
    );

    const rows = await StockReg.aggregate(pipeline);
    res.json({ success: true, data: { page: pageInt, limit: limitInt, rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const exportStockMovementsToExcel = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'EXPORT_STOCK_MOVEMENTS_EXCEL');
    if (!firmId) return;
    const { type, searchTerm } = req.query;
    const fid = new mongoose.Types.ObjectId(firmId);

    const matchStage = { firm_id: fid, stock_id: { $ne: null } };
    if (type) matchStage.type = type;
    if (searchTerm?.trim()) {
      const regex = new RegExp(searchTerm.trim(), 'i');
      matchStage.$or = [{ item: regex }, { bno: regex }];
    }

    const rows = await StockReg.aggregate([
      { $match: matchStage },
      { $lookup: { from: 'stocks',  localField: 'stock_id',         foreignField: '_id', as: 'stockDoc' } },
      { $lookup: { from: 'bills',   localField: 'bill_id',          foreignField: '_id', as: 'billDoc'  } },
      { $lookup: { from: 'parties', localField: 'billDoc.party_id', foreignField: '_id', as: 'partyDoc' } },
      { $addFields: { stock_item: { $arrayElemAt: ['$stockDoc.item', 0] }, bill_date: { $arrayElemAt: ['$billDoc.bdate', 0] }, party_name: { $arrayElemAt: ['$partyDoc.firm', 0] } } },
      { $project: { stockDoc: 0, billDoc: 0, partyDoc: 0 } },
      { $sort: { createdAt: -1 } },
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Business Management App';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Stock Movements');
    ws.columns = [
      { header: 'Date',     key: 'date',     width: 12 },
      { header: 'Type',     key: 'type',     width: 10 },
      { header: 'Bill No',  key: 'billNo',   width: 15 },
      { header: 'Item',     key: 'item',     width: 30 },
      { header: 'Batch',    key: 'batch',    width: 15 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'UOM',      key: 'uom',      width: 10 },
      { header: 'Rate',     key: 'rate',     width: 12 },
      { header: 'Total',    key: 'total',    width: 12 },
      { header: 'Party',    key: 'party',    width: 25 },
    ];
    ws.getColumn('date').numFmt     = 'dd-mm-yyyy';
    ws.getColumn('quantity').numFmt = '0.00';
    ws.getColumn('rate').numFmt     = '0.00';
    ws.getColumn('total').numFmt    = '0.00';
    for (const row of rows) {
      ws.addRow({ date: row.bdate || '', type: row.type || '', billNo: row.bno || '', item: row.item || '', batch: row.batch || '', quantity: row.qty || 0, uom: row.uom || '', rate: row.rate || 0, total: row.total || 0, party: row.party_name || '' });
    }
    ws.getRow(1).font      = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.views               = [{ state: 'frozen', ySplit: 1 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=stock-movements-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[EXPORT_EXCEL] Error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
};

export const getStockMovementsByStock = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'GET_STOCK_MOVEMENTS_BY_STOCK');
    if (!firmId) return;
    const stockId = validateObjectId(req.params.stockId, 'stockId', res);
    if (!stockId) return;
    const { page = 1, limit = 50 } = req.query;
    const pageInt  = Math.max(1, parseInt(page));
    const limitInt = Math.max(1, parseInt(limit));
    const rows = await StockReg.find({ stock_id: stockId, firm_id: firmId })
      .sort({ createdAt: -1 }).skip((pageInt - 1) * limitInt).limit(limitInt).lean();
    res.json({ success: true, data: { stockId, page: pageInt, limit: limitInt, rows } });
  } catch (err) {
    console.error('[GET_STOCK_MOVEMENTS_BY_STOCK] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
};

export const createStockMovement = async (req, res) => {
  try {
    const { type, stockId, batch, qty, uom, rate, total, description, referenceNumber } = req.body;
    if (!type || !stockId || !qty || !uom) return res.status(400).json({ error: 'Type, stockId, qty, and uom are required' });
    const validTypes = ['RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'OPENING'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: `Invalid movement type. Must be one of: ${validTypes.join(', ')}` });

    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
    const firmId = getFirmId(req, res, 'CREATE_STOCK_MOVEMENT');
    if (!firmId) return;
    const validatedStockId = validateObjectId(stockId, 'stockId', res);
    if (!validatedStockId) return;

    const stock = await Stock.findOne({ _id: validatedStockId, firm_id: firmId }).lean();
    if (!stock) return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });

    const absQty          = Math.abs(parseFloat(qty));
    const calculatedTotal = total || (absQty * (rate || 0));
    const today           = new Date().toISOString().split('T')[0];

    await StockReg.create({
      firm_id: firmId, type, bno: referenceNumber || null, bdate: today,
      item: stock.item, batch: batch || null, hsn: stock.hsn, qty: absQty, uom,
      rate: rate || 0, grate: stock.grate || 0, disc: 0, total: calculatedTotal,
      stock_id: validatedStockId, bill_id: null, user: actorUsername,
    });

    const newQty = (stock.qty || 0) + absQty;
    await Stock.findOneAndUpdate(
      { _id: validatedStockId, firm_id: firmId },
      { $set: { qty: newQty, uom: uom || stock.uom, rate: rate || stock.rate, total: newQty * (rate || stock.rate), user: actorUsername } }
    );

    res.json({ success: true, message: `Stock movement (${type}) created successfully` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════════════════ */

export const getOtherChargesTypes = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_OTHER_CHARGES_TYPES');
    if (!firmId) return;
    const bills = await Bill.find({ firm_id: firmId, other_charges: { $exists: true, $ne: null } })
      .select('other_charges').sort({ createdAt: -1 }).limit(100).lean();
    const chargesMap = new Map();
    for (const bill of bills) {
      if (!Array.isArray(bill.other_charges)) continue;
      for (const charge of bill.other_charges) {
        const key = charge.name || charge.type;
        if (key && !chargesMap.has(key)) {
          chargesMap.set(key, { name: charge.name || charge.type, type: charge.type || 'other', hsnSac: charge.hsnSac || '', gstRate: charge.gstRate || 0 });
        }
      }
    }
    res.json({ success: true, data: Array.from(chargesMap.values()) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getCurrentUserFirmName = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_FIRM_NAME');
    if (!firmId) return;
    const firm = await Firm.findById(firmId).select('name address').lean();
    if (!firm) return res.status(404).json({ success: false, error: 'Firm not found' });
    res.json({ success: true, data: firm });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const lookupGST = async (req, res) => {
  const gstin = req.query.gstin || req.body?.gstin;
  if (!gstin) return res.status(400).json({ success: false, error: 'GSTIN is required' });

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) {
    console.error('[GST_LOOKUP] RAPIDAPI_KEY is not set');
    return res.status(500).json({ success: false, error: 'GST lookup service is not configured. Please set RAPIDAPI_KEY.' });
  }

  try {
    const apiResponse = await fetch(
      `https://powerful-gstin-tool.p.rapidapi.com/v1/gstin/${gstin}/details`,
      { method: 'GET', headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': 'powerful-gstin-tool.p.rapidapi.com' } }
    );
    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      console.error(`[GST_LOOKUP] RapidAPI returned ${apiResponse.status}:`, errBody);
      return res.status(502).json({ success: false, error: `GST lookup service returned an error (${apiResponse.status}).` });
    }
    const raw = await apiResponse.json();
    res.json({ success: true, data: raw?.data ?? raw });
  } catch (err) {
    console.error('[GST_LOOKUP] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to reach GST lookup service.' });
  }
};