import mongoose from 'mongoose';
import {
  Stock, Party, Bill, StockReg, Ledger, Firm,
} from '../../../../models/index.js';
import {
  getActorUsername, getFirmId, validateObjectId,
  normalizeOptionalText, normalizeOptionalMultilineText,
  getNextBillNumber, previewNextBillNumber, getNextVoucherNumber,
  isGstEnabled, calcBillTotals, getLocalDateString,
  isServiceItem, getEffectiveItemQty,
} from '../billUtils.js';
import { postSalesLedger, postCreditNoteLedger } from '../inventoryLedgerHelper.js';
import { getStateCode } from '../../../../utils/mongo/gstCalculator.js';

/* ── Resolve consignee state code from GSTIN, state name, or explicit value ── */
function resolveConsigneeStateCode(consignee = {}) {
  const explicit = normalizeOptionalText(consignee.stateCode, 2);
  const gstin = normalizeOptionalText(consignee.gstin, 15);
  const stateName = normalizeOptionalText(consignee.state, 80);

  const derivedFromGstin = gstin && gstin !== 'UNREGISTERED' && /^\d{2}/.test(gstin)
    ? gstin.substring(0, 2)
    : null;
  const derivedFromState = stateName ? getStateCode(stateName) : null;
  const normalizedExplicit = explicit && /^\d{2}$/.test(explicit) ? explicit : null;

  const resolved = derivedFromGstin || derivedFromState || normalizedExplicit || null;

  if (normalizedExplicit && resolved && normalizedExplicit !== resolved) {
    throw new Error(
      `Consignee state code mismatch: provided ${normalizedExplicit} does not match consignee GST/state (${resolved}).`
    );
  }

  return resolved;
}

/* ── Re-export everything shared ─────────────────────────────────────────── */
export {
  getAllStocks, createStock, getStockById, updateStock, deleteStock,
  getAllParties, createParty, updateParty, deleteParty,
  getBillById, getAllBills, exportBillsExcel, exportBillsToPdf,
  getStockBatches, getStockMovements, exportStockMovementsToExcel,
  getStockMovementsByStock, createStockMovement,
  getOtherChargesTypes, lookupGST, getServiceSuggestions,
} from '../sharedStockHandlers.js';

/* ── Sales-specific: getCurrentUserFirmName (includes locations[]) ───────── */

export const getCurrentUserFirmName = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_CURRENT_FIRM');
    if (!firmId) return;

    const firm = await Firm.findById(firmId)
      .select('name locations')
      .lean();

    if (!firm) return res.status(404).json({ success: false, error: 'Firm not found' });

    res.json({
      success: true,
      data: {
        name:      firm.name,
        locations: firm.locations || [],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── Sales-specific: party item history (type: SALE) ─────────────────────── */

export const getPartyItemHistory = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'GET_PARTY_ITEM_HISTORY');
    if (!firmId) return;
    const partyId = validateObjectId(req.query.partyId, 'partyId', res);
    if (!partyId) return;
    const stockId = validateObjectId(req.query.stockId, 'stockId', res);
    if (!stockId) return;

    const limitParam = req.query.limit;
    const limit = limitParam === 'all' ? null : Math.min(parseInt(limitParam) || 10, 500);
    const fid = new mongoose.Types.ObjectId(firmId);
    const pid = new mongoose.Types.ObjectId(partyId);
    const sid = new mongoose.Types.ObjectId(stockId);

    const pipeline = [
      { $match: { firm_id: fid, stock_id: sid, type: 'SALE' } },
      { $lookup: { from: 'bills', localField: 'bill_id', foreignField: '_id', as: 'billDoc' } },
      { $unwind: { path: '$billDoc', preserveNullAndEmptyArrays: false } },
      { $match: { 'billDoc.party_id': pid } },
      { $sort:  { bdate: -1, createdAt: -1 } },
      ...(limit !== null ? [{ $limit: limit }] : []),
      { $project: { reg_id: '$_id', stock_id: 1, item: 1, batch: 1, hsn: 1, qty: 1, uom: 1, rate: 1, grate: 1, disc: 1, total: 1, bno: 1, bdate: 1, createdAt: 1, bill_id: '$billDoc._id', party_id: '$billDoc.party_id', firm: '$billDoc.firm', usern: '$billDoc.usern' } },
    ];

    const rows = await StockReg.aggregate(pipeline);
    res.json({ success: true, data: { partyId, stockId, rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ── Sales-specific: bill number preview ─────────────────────────────────── */

export const getNextBillNumberPreviewEndpoint = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'PREVIEW_BILL_NUMBER');
    if (!firmId) return;
    const billNo = await previewNextBillNumber(firmId, 'SALES');
    res.json({ success: true, nextBillNumber: billNo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── Sales-specific: party balance (DEBTOR orientation) ──────────────────── */

export const getPartyBalance = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'GET_PARTY_BALANCE');
    if (!firmId) return;
    const partyId = validateObjectId(req.params.partyId, 'partyId', res);
    if (!partyId) return;

    const [result] = await Ledger.aggregate([
      { $match: { firm_id: new mongoose.Types.ObjectId(firmId), party_id: new mongoose.Types.ObjectId(partyId) } },
      { $group: { _id: null, total_debit: { $sum: '$debit_amount' }, total_credit: { $sum: '$credit_amount' } } },
    ]);

    const debit   = result?.total_debit  ?? 0;
    const credit  = result?.total_credit ?? 0;
    const balance = debit - credit;
    const balanceType = balance > 0 ? 'Debit' : balance < 0 ? 'Credit' : 'Nil';
    res.json({ success: true, data: { partyId, balance, balance_type: balanceType, outstanding: Math.abs(balance), debit, credit } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   SHARED HELPERS
════════════════════════════════════════════════════════════════════════════ */

/**
 * Resolve and validate the active firm location for a bill.
 */
async function resolveFirmLocation(firmId, firmGstin) {
  const firmDoc = await Firm.findById(firmId).select('locations').lean();
  const locations = firmDoc?.locations || [];

  let firmLoc = null;

  if (firmGstin) {
    firmLoc = locations.find(l => l.gst_number === firmGstin);
    if (!firmLoc) {
      throw new Error(`Firm GSTIN ${firmGstin} not found in firm's registered locations`);
    }
  } else {
    firmLoc = locations.find(l => l.is_default) || locations[0] || null;
  }

  const firmStateCode = firmLoc?.state_code || firmLoc?.gst_number?.substring(0, 2) || null;

  return { firmLoc, firmStateCode };
}

/**
 * Validate GST bill type against firm and party state codes.
 */
function validateGstBillType(billType, firmStateCode, partyStateCode, reverseCharge) {
  if (reverseCharge) return null;
  if (!firmStateCode || !partyStateCode) return null;

  const fCode = parseInt(firmStateCode);
  const pCode = parseInt(partyStateCode);
  const sameState  = fCode === pCode;
  const sentIntra  = billType === 'intra-state' || billType === 'INTRA-STATE';

  if (sameState && !sentIntra) {
    return `GST type mismatch: firm state (${firmStateCode}) and party state (${partyStateCode}) are the same — must use CGST+SGST (intra-state), not IGST.`;
  }
  if (!sameState && sentIntra) {
    return `GST type mismatch: firm state (${firmStateCode}) and party state (${partyStateCode}) differ — must use IGST (inter-state), not CGST+SGST.`;
  }
  return null;
}

function toPositiveNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function aggregateReturnCart(returnCart) {
  const aggregated = new Map();

  for (const item of returnCart) {
    const stockId = item?.stockId ? String(item.stockId) : null;
    const returnQty = toPositiveNumber(item?.returnQty);
    const itemType = String(item?.itemType || item?.item_type || 'GOODS').toUpperCase();
    
    // Allow null stockId for SERVICE items, allow any stockId value (including legacy strings like "ITM1") for GOODS items
    if (!stockId && itemType === 'SERVICE') continue;
    if (!returnQty) {
      throw new Error(`Return quantity must be > 0 for item: ${item?.item ?? '(unknown)'}`);
    }

    const existing = aggregated.get(stockId);
    if (existing) {
      existing.returnQty += returnQty;
      continue;
    }

    aggregated.set(stockId, {
      ...item,
      stockId,
      returnQty,
    });
  }

  return aggregated;
}

function buildAtomicSalesReturnPipeline({ batch, returnedQty, restoredValue, restoredRate, actorUsername }) {
  return [
    {
      $set: {
        batches: {
          $map: {
            input: { $ifNull: ['$batches', []] },
            as: 'b',
            in: {
              $cond: [
                { $eq: [{ $ifNull: ['$$b.batch', null] }, batch ?? null] },
                {
                  $mergeObjects: [
                    '$$b',
                    {
                      qty: { $add: [{ $ifNull: ['$$b.qty', 0] }, returnedQty] },
                    },
                  ],
                },
                '$$b',
              ],
            },
          },
        },
        qty: { $add: [{ $ifNull: ['$qty', 0] }, returnedQty] },
        total: {
          $add: [
            { $ifNull: ['$total', { $multiply: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$rate', 0] }] }] },
            restoredValue,
          ],
        },
        rate: {
          $let: {
            vars: {
              nextQty: { $add: [{ $ifNull: ['$qty', 0] }, returnedQty] },
              nextTotal: {
                $add: [
                  { $ifNull: ['$total', { $multiply: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$rate', 0] }] }] },
                  restoredValue,
                ],
              },
            },
            in: {
              $cond: [
                { $gt: ['$$nextQty', 0] },
                { $round: [{ $divide: ['$$nextTotal', '$$nextQty'] }, 6] },
                restoredRate,
              ],
            },
          },
        },
        user: actorUsername,
      },
    },
  ];
}

function buildAtomicSalesReturnReversalPipeline({ batch, removedQty, removedValue, actorUsername }) {
  return [
    {
      $set: {
        batches: {
          $map: {
            input: { $ifNull: ['$batches', []] },
            as: 'b',
            in: {
              $cond: [
                { $eq: [{ $ifNull: ['$$b.batch', null] }, batch ?? null] },
                {
                  $mergeObjects: [
                    '$$b',
                    {
                      qty: { $max: [0, { $subtract: [{ $ifNull: ['$$b.qty', 0] }, removedQty] }] },
                    },
                  ],
                },
                '$$b',
              ],
            },
          },
        },
        qty: { $max: [0, { $subtract: [{ $ifNull: ['$qty', 0] }, removedQty] }] },
        total: {
          $max: [
            0,
            {
              $subtract: [
                { $ifNull: ['$total', { $multiply: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$rate', 0] }] }] },
                removedValue,
              ],
            },
          ],
        },
        rate: {
          $let: {
            vars: {
              nextQty: { $max: [0, { $subtract: [{ $ifNull: ['$qty', 0] }, removedQty] }] },
              nextTotal: {
                $max: [
                  0,
                  {
                    $subtract: [
                      { $ifNull: ['$total', { $multiply: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$rate', 0] }] }] },
                      removedValue,
                    ],
                  },
                ],
              },
            },
            in: {
              $cond: [
                { $gt: ['$$nextQty', 0] },
                { $round: [{ $divide: ['$$nextTotal', '$$nextQty'] }, 6] },
                { $ifNull: ['$rate', 0] },
              ],
            },
          },
        },
        user: actorUsername,
      },
    },
  ];
}

/* ════════════════════════════════════════════════════════════════════════════
   CREATE BILL (SALES)
════════════════════════════════════════════════════════════════════════════ */

export const createBill = async (req, res) => {
  const { meta, party, cart, otherCharges, consignee } = req.body;
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
  const firmId = getFirmId(req, res, 'CREATE_BILL');
  if (!firmId) return;

  if (!cart || cart.length === 0) return res.status(400).json({ error: 'Cart cannot be empty' });

  const partyIdRaw = party?.id ?? party?._id ?? party;
  if (!partyIdRaw || !mongoose.Types.ObjectId.isValid(partyIdRaw)) {
    return res.status(400).json({ error: 'Invalid party ID' });
  }

  const partyDoc = await Party.findOne({ _id: partyIdRaw, firm_id: firmId }).lean();
  if (!partyDoc) {
    return res.status(404).json({ error: 'Party not found' });
  }

  // FIX: Multi-GST party support — resolve which GSTIN to use
  let selectedPartyGstin = partyDoc.gstin;
  let selectedPartyState = partyDoc.state;
  let selectedPartyStateCode = partyDoc.state_code;
  let selectedPartyAddr = partyDoc.addr;
  let selectedPartyPin = partyDoc.pin;
  let selectedPartyContact = partyDoc.contact;
  
  // If party has multiple GST locations and a specific GSTIN is requested, use it
  if (Array.isArray(partyDoc.gstLocations) && partyDoc.gstLocations.length > 0 && meta?.partyGstin) {
    const selectedLoc = partyDoc.gstLocations.find(l => l.gstin === meta.partyGstin);
    if (selectedLoc) {
      selectedPartyGstin = selectedLoc.gstin;
      selectedPartyState = selectedLoc.state;
      selectedPartyStateCode = selectedLoc.state_code;
      selectedPartyAddr = selectedLoc.address;
      selectedPartyPin = selectedLoc.pincode;
      selectedPartyContact = selectedLoc.contact;
    } else {
      return res.status(400).json({ error: `Party GSTIN ${meta.partyGstin} not found in party's registered locations` });
    }
  }

  let firmLoc, firmStateCode;
  try {
    ({ firmLoc, firmStateCode } = await resolveFirmLocation(firmId, meta?.firmGstin));
  } catch (locErr) {
    return res.status(400).json({ error: locErr.message });
  }

  // FIX: Resolve partyStateCode from selected location or derive from GSTIN/state name
  const partyStateCode = selectedPartyGstin && selectedPartyGstin !== 'UNREGISTERED'
    ? (selectedPartyStateCode || selectedPartyGstin.substring(0, 2))
    : (selectedPartyStateCode || (selectedPartyState ? getStateCode(selectedPartyState) : null));

  const gstTypeError = validateGstBillType(
    meta?.billType, firmStateCode, partyStateCode, meta?.reverseCharge
  );
  if (gstTypeError) {
    return res.status(400).json({ error: gstTypeError });
  }

  const referenceNo = normalizeOptionalText(meta?.referenceNo, 80);
  const vehicleNo   = normalizeOptionalText(meta?.vehicleNo, 40);
  const dispatchVia = normalizeOptionalText(meta?.dispatchThrough, 80);
  const narration   = normalizeOptionalMultilineText(meta?.narration, 2000);
  const billSubtype = meta?.billType ? String(meta.billType).toUpperCase() : null;

  // FIX Bug #1: Resolve consignee state code from GSTIN or state name
  let consigneeStateCode = null;
  try {
    consigneeStateCode = resolveConsigneeStateCode(consignee || {});
  } catch (consigneeErr) {
    return res.status(400).json({ error: consigneeErr.message });
  }

  // Validate cart
  for (const item of cart) {
    const serviceItem = isServiceItem(item);
    if (!normalizeOptionalText(item.item, 200))
      return res.status(400).json({ error: 'Item description is required' });
    if (!serviceItem && (!item.stockId || !mongoose.Types.ObjectId.isValid(item.stockId)))
      return res.status(400).json({ error: `Invalid stockId for item: ${item.item ?? '(unknown)'}` });
    if (!serviceItem && getEffectiveItemQty(item) <= 0)
      return res.status(400).json({ error: `Quantity must be > 0 for item: ${item.item}` });
    if (item.rate === undefined || item.rate === null || parseFloat(item.rate) < 0)
      return res.status(400).json({ error: `Rate must be >= 0 for item: ${item.item}` });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const billNo    = await getNextBillNumber(firmId, 'SALES');
    const voucherId = await getNextVoucherNumber(firmId);

    const gstEnabled = await isGstEnabled(firmId);
    const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(
      cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge, getEffectiveItemQty
    );

    const firmRecord = await Firm.findById(firmId).select('name').lean();
    const firmName   = firmRecord?.name ?? '';

    const [newBill] = await Bill.create([{
      firm_id: firmId, voucher_id: String(voucherId), bno: billNo,
      bdate: meta.billDate, supply: partyDoc.firm || '', firm: firmName,
      addr: selectedPartyAddr || '', gstin: selectedPartyGstin || 'UNREGISTERED',
      state: selectedPartyState || '', pin: selectedPartyPin || null, state_code: selectedPartyStateCode || null,
      firm_gstin:      firmLoc?.gst_number  || null,
      firm_state:      firmLoc?.state       || null,
      firm_state_code: firmStateCode        || null,
      gtot, ntot, rof, btype: 'SALES', bill_subtype: billSubtype,
      usern: actorUsername, party_id: partyDoc._id,
      other_charges: otherCharges?.length > 0 ? otherCharges : null,
      order_no: referenceNo, vehicle_no: vehicleNo, dispatch_through: dispatchVia, narration,
      reverse_charge: Boolean(meta.reverseCharge), cgst, sgst, igst,
      consignee_name: consignee?.name || null, consignee_gstin: consignee?.gstin || null,
      consignee_address: consignee?.address || null, consignee_state: consignee?.state || null,
      consignee_pin: consignee?.pin || null, consignee_state_code: consigneeStateCode,
    }], { session });

    const billId = newBill._id;

    const stockRegDocs      = [];
    const cogsLines         = [];

    for (const item of cart) {
      const serviceItem  = isServiceItem(item);
      const effectiveQty = getEffectiveItemQty(item);
      
      // For services with qty=0 (flat-rate services), line total is just rate * (1 - disc/100)
      // For all other items, line total is qty * rate * (1 - disc/100)
      let lineTotal;
      if (serviceItem && effectiveQty === 0) {
        lineTotal = item.rate * (1 - (item.disc || 0) / 100);
      } else {
        lineTotal = effectiveQty * item.rate * (1 - (item.disc || 0) / 100);
      }

      if (serviceItem) {
        const stockRegId = new mongoose.Types.ObjectId();
        stockRegDocs.push({
          _id: stockRegId, firm_id: firmId, type: 'SALE', bno: billNo,
          bdate: meta.billDate, supply: partyDoc.firm,
          item_type: 'SERVICE', show_qty: item.showQty !== false,
          item: normalizeOptionalText(item.item, 200),
          item_narration: normalizeOptionalMultilineText(item.narration, 1000),
          batch: null, hsn: normalizeOptionalText(item.hsn, 40),
          qty: effectiveQty, uom: normalizeOptionalText(item.uom, 20),
          rate: item.rate, grate: item.grate, disc: item.disc || 0, total: lineTotal,
          cost_rate: 0, stock_id: null, bill_id: billId, user: actorUsername, qtyh: 0,
        });
        continue;
      }

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId })
        .session(session).lean();
      if (!stockRecord)
        throw new Error(`Stock not found: ${item.stockId} (item: ${item.item})`);

      const wacCostRate = stockRecord.rate;
      const cogsValue   = effectiveQty * wacCostRate;

      // FIX Bug #1: Atomic batch decrement using arrayFilters to prevent race conditions
      let batchQuery = { _id: item.stockId, firm_id: firmId };
      let batchIdentifier = {};
      
      if (item.batchIndex !== undefined && item.batchIndex !== null) {
        // We cannot reliably use index with $inc in a multi-user environment if the array size changes,
        // but since we usually don't delete batches during sales, it's safer than Last-Write-Wins.
        // However, if we have a batch name, that's preferred.
        if (item.batch) {
          batchIdentifier = { 'elem.batch': item.batch };
        } else {
          // If no name, we have to trust the index or use a null-batch identifier
          batchIdentifier = { 'elem.batch': null };
        }
      } else {
        batchIdentifier = { 'elem.batch': item.batch || null };
      }

      const updateResult = await Stock.findOneAndUpdate(
        batchQuery,
        { 
          $inc: { 
            'batches.$[elem].qty': -effectiveQty,
            'qty': -effectiveQty,
            'total': -cogsValue
          },
          $set: { user: actorUsername }
        },
        { 
          session,
          arrayFilters: [ batchIdentifier ],
          new: true 
        }
      );

      if (!updateResult) {
        throw new Error(`Failed to update stock for item ${item.item}. Batch not found.`);
      }

      const stockRegId = new mongoose.Types.ObjectId();
      stockRegDocs.push({
        _id: stockRegId, firm_id: firmId, type: 'SALE', bno: billNo,
        bdate: meta.billDate, supply: partyDoc.firm,
        item_type: 'GOODS', show_qty: true,
        item: normalizeOptionalText(item.item, 200),
        item_narration: normalizeOptionalMultilineText(item.narration, 1000),
        batch: item.batch || null, hsn: normalizeOptionalText(item.hsn, 40),
        qty: effectiveQty, uom: normalizeOptionalText(item.uom, 20),
        rate: item.rate, grate: item.grate, disc: item.disc || 0, total: lineTotal,
        cost_rate: wacCostRate,
        stock_id: item.stockId, bill_id: billId, user: actorUsername, qtyh: updateResult.qty,
      });

      cogsLines.push({
        stockId:    item.stockId,
        stockRegId,
        item:       normalizeOptionalText(item.item, 200),
        cogsValue,
      });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    const taxableItemsTotal = cart.reduce((sum, item) => {
      const effectiveQty = getEffectiveItemQty(item);
      const serviceItem = isServiceItem(item);
      
      // For services with qty=0 (flat-rate services), line total is just rate * (1 - disc/100)
      // For all other items, line total is qty * rate * (1 - disc/100)
      let lineTotal;
      if (serviceItem && effectiveQty === 0) {
        lineTotal = item.rate * (1 - (item.disc || 0) / 100);
      } else {
        lineTotal = effectiveQty * item.rate * (1 - (item.disc || 0) / 100);
      }
      
      return sum + lineTotal;
    }, 0);

    await postSalesLedger({
      firmId, billId, voucherId, billNo, billDate: meta.billDate,
      party: partyDoc, ntot, cgst, sgst, igst, rof,
      otherCharges, taxableItemsTotal, cogsLines, actorUsername, session,
    });

    await session.commitTransaction();
    res.json({ success: true, id: billId, billNo, message: 'Bill created successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[CREATE_BILL] Error:', err.message, err.stack);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message || 'Failed to create bill' });
  } finally {
    session.endSession();
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   UPDATE BILL (SALES)
════════════════════════════════════════════════════════════════════════════ */

export const updateBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
    const firmId = getFirmId(req, res, 'UPDATE_BILL');
    if (!firmId) return;
    const billId = validateObjectId(req.params.id, 'bill ID', res);
    if (!billId) return;

    const { meta, party, cart, otherCharges, consignee } = req.body;
    if (!cart?.length) return res.status(400).json({ error: 'Cart cannot be empty' });

    const partyIdRaw = party?.id ?? party?._id;
    if (!partyIdRaw || !mongoose.Types.ObjectId.isValid(partyIdRaw)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid party ID' });
    }
    const partyDoc = await Party.findOne({ _id: partyIdRaw, firm_id: firmId }).lean();
    if (!partyDoc) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Party not found or does not belong to your firm' });
    }

    // FIX: Resolve selected GSTIN from multi-GST locations (same as createBill)
    let selectedPartyGstin = partyDoc.gstin;
    let selectedPartyState = partyDoc.state;
    let selectedPartyStateCode = partyDoc.state_code;
    let selectedPartyAddr = partyDoc.addr;
    let selectedPartyPin = partyDoc.pin;
    let selectedPartyContact = partyDoc.contact;
    
    // If party has multiple GST locations and a specific GSTIN is requested, use it
    if (Array.isArray(partyDoc.gstLocations) && partyDoc.gstLocations.length > 0 && meta?.partyGstin) {
      const selectedLoc = partyDoc.gstLocations.find(l => l.gstin === meta.partyGstin);
      if (selectedLoc) {
        selectedPartyGstin = selectedLoc.gstin;
        selectedPartyState = selectedLoc.state;
        selectedPartyStateCode = selectedLoc.state_code;
        selectedPartyAddr = selectedLoc.address;
        selectedPartyPin = selectedLoc.pincode;
        selectedPartyContact = selectedLoc.contact;
      } else {
        await session.abortTransaction();
        return res.status(400).json({ error: `Party GSTIN ${meta.partyGstin} not found in party's registered locations` });
      }
    }

    let firmLoc, firmStateCode;
    try {
      ({ firmLoc, firmStateCode } = await resolveFirmLocation(firmId, meta?.firmGstin));
    } catch (locErr) {
      await session.abortTransaction();
      return res.status(400).json({ error: locErr.message });
    }

    // FIX Bug #3: Resolve partyStateCode from name for unregistered parties
    const partyStateCode = selectedPartyGstin && selectedPartyGstin !== 'UNREGISTERED'
      ? (selectedPartyStateCode || selectedPartyGstin.substring(0, 2))
      : (selectedPartyStateCode || (selectedPartyState ? getStateCode(selectedPartyState) : null));

    const gstTypeError = validateGstBillType(
      meta?.billType, firmStateCode, partyStateCode, meta?.reverseCharge
    );
    if (gstTypeError) {
      await session.abortTransaction();
      return res.status(400).json({ error: gstTypeError });
    }

    // Validate cart
    for (const item of cart) {
      const serviceItem = isServiceItem(item);
      if (!normalizeOptionalText(item.item, 200))
        return res.status(400).json({ error: 'Item description is required' });
      if (!serviceItem && (!item.stockId || !mongoose.Types.ObjectId.isValid(item.stockId)))
        return res.status(400).json({ error: `Invalid stockId for item: ${item.item ?? '(unknown)'}` });
      if (!serviceItem && getEffectiveItemQty(item) <= 0)
        return res.status(400).json({ error: `Quantity must be > 0 for item: ${item.item}` });
      if (item.rate === undefined || item.rate === null || parseFloat(item.rate) < 0)
        return res.status(400).json({ error: `Rate must be >= 0 for item: ${item.item}` });
    }

    // FIX Bug #1: Resolve consignee state code from GSTIN or state name
    let consigneeStateCode = null;
    try {
      consigneeStateCode = resolveConsigneeStateCode(consignee || {});
    } catch (consigneeErr) {
      await session.abortTransaction();
      return res.status(400).json({ error: consigneeErr.message });
    }

    const existingBill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!existingBill) return res.status(404).json({ error: 'Bill not found' });
    if (existingBill.status === 'CANCELLED') return res.status(400).json({ error: 'Cancelled bills cannot be modified' });
    if (meta.billNo && meta.billNo !== existingBill.bno) return res.status(400).json({ error: 'Bill number cannot be changed' });
    if (existingBill.btype === 'CREDIT_NOTE') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Editing credit notes is not supported. Cancel and recreate the credit note instead.' });
    }

    // Step 1: Restore stock from old sale (add back atomically)
    const existingItems = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const ei of existingItems) {
      if (!ei.stock_id) continue;
      const stockRecord = await Stock.findOne({ _id: ei.stock_id, firm_id: firmId }).session(session).lean();
      if (!stockRecord) continue;

      const cogsValue = ei.cost_rate ? (ei.qty * ei.cost_rate) : 0;

      await Stock.findOneAndUpdate(
        { _id: ei.stock_id, firm_id: firmId },
        { 
          $inc: { 
            'batches.$[elem].qty': ei.qty,
            'qty': ei.qty,
            'total': cogsValue
          },
          $set: { user: actorUsername }
        },
        { 
          session,
          arrayFilters: [{ 'elem.batch': ei.batch || null }]
        }
      );
    }

    // Step 2: Recalculate totals
    const gstEnabled = await isGstEnabled(firmId);
    const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(
      cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge, getEffectiveItemQty
    );

    const firmRecord = await Firm.findById(firmId).select('name').lean();
    const firmName   = firmRecord?.name ?? existingBill.firm ?? '';

    // Step 3: Update bill header
    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      { $set: {
          bdate: meta.billDate, supply: partyDoc.firm || '', firm: firmName,
          addr: selectedPartyAddr || '', gstin: selectedPartyGstin || 'UNREGISTERED',
          state: selectedPartyState || '', pin: selectedPartyPin || null, state_code: selectedPartyStateCode || null,
          firm_gstin:      firmLoc?.gst_number  || null,
          firm_state:      firmLoc?.state       || null,
          firm_state_code: firmStateCode        || null,
          gtot, ntot, rof, btype: 'SALES',
          bill_subtype: meta?.billType ? String(meta.billType).toUpperCase() : null,
          usern: actorUsername, party_id: partyDoc._id,
          other_charges: otherCharges?.length > 0 ? otherCharges : null,
          order_no: normalizeOptionalText(meta?.referenceNo, 80),
          vehicle_no: normalizeOptionalText(meta?.vehicleNo, 40),
          dispatch_through: normalizeOptionalText(meta?.dispatchThrough, 80),
          narration: normalizeOptionalMultilineText(meta?.narration, 2000),
          reverse_charge: Boolean(meta.reverseCharge), cgst, sgst, igst,
          consignee_name: consignee?.name || null, consignee_gstin: consignee?.gstin || null,
          consignee_address: consignee?.address || null, consignee_state: consignee?.state || null,
          consignee_pin: consignee?.pin || null, consignee_state_code: consigneeStateCode,
      }},
      { session }
    );

    // Step 4: Delete old StockReg entries
    await StockReg.deleteMany({ bill_id: billId, firm_id: firmId }, { session });

    // Step 5: Process new cart — deduct stock atomically
    const stockRegDocs      = [];
    const cogsLines         = [];

    for (const item of cart) {
      const serviceItem  = isServiceItem(item);
      const effectiveQty = getEffectiveItemQty(item);
      
      // For services with qty=0 (flat-rate services), line total is just rate * (1 - disc/100)
      // For all other items, line total is qty * rate * (1 - disc/100)
      let lineTotal;
      if (serviceItem && effectiveQty === 0) {
        lineTotal = item.rate * (1 - (item.disc || 0) / 100);
      } else {
        lineTotal = effectiveQty * item.rate * (1 - (item.disc || 0) / 100);
      }

      if (serviceItem) {
        const stockRegId = new mongoose.Types.ObjectId();
        stockRegDocs.push({
          _id: stockRegId, firm_id: firmId, type: 'SALE', bno: existingBill.bno,
          bdate: meta.billDate, supply: partyDoc.firm,
          item_type: 'SERVICE', show_qty: item.showQty !== false,
          item: normalizeOptionalText(item.item, 200),
          item_narration: normalizeOptionalMultilineText(item.narration, 1000),
          batch: null, hsn: normalizeOptionalText(item.hsn, 40),
          qty: effectiveQty, uom: normalizeOptionalText(item.uom, 20),
          rate: item.rate, grate: item.grate, disc: item.disc || 0, total: lineTotal,
          cost_rate: 0, stock_id: null, bill_id: billId, user: actorUsername, qtyh: 0,
        });
        continue;
      }

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId }).session(session).lean();
      if (!stockRecord) throw new Error(`Stock not found for ID: ${item.stockId}`);

      const wacCostRate = stockRecord.rate;
      const cogsValue   = effectiveQty * wacCostRate;

      const updateResult = await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        { 
          $inc: { 
            'batches.$[elem].qty': -effectiveQty,
            'qty': -effectiveQty,
            'total': -cogsValue
          },
          $set: { user: actorUsername }
        },
        { 
          session,
          arrayFilters: [{ 'elem.batch': item.batch || null }],
          new: true
        }
      );

      if (!updateResult) throw new Error(`Failed to update stock for item ${item.item}. Batch not found.`);

      const stockRegId = new mongoose.Types.ObjectId();
      stockRegDocs.push({
        _id: stockRegId, firm_id: firmId, type: 'SALE', bno: existingBill.bno,
        bdate: meta.billDate, supply: partyDoc.firm,
        item_type: 'GOODS', show_qty: true,
        item: normalizeOptionalText(item.item, 200),
        item_narration: normalizeOptionalMultilineText(item.narration, 1000),
        batch: item.batch || null, hsn: normalizeOptionalText(item.hsn, 40),
        qty: effectiveQty, uom: normalizeOptionalText(item.uom, 20),
        rate: item.rate, grate: item.grate, disc: item.disc || 0, total: lineTotal,
        cost_rate: wacCostRate,
        stock_id: item.stockId, bill_id: billId, user: actorUsername, qtyh: updateResult.qty,
      });

      cogsLines.push({ stockId: item.stockId, stockRegId, item: normalizeOptionalText(item.item, 200), cogsValue });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    const taxableItemsTotal = cart.reduce((sum, item) => {
      const effectiveQty = getEffectiveItemQty(item);
      const serviceItem = isServiceItem(item);
      
      // For services with qty=0 (flat-rate services), line total is just rate * (1 - disc/100)
      // For all other items, line total is qty * rate * (1 - disc/100)
      let lineTotal;
      if (serviceItem && effectiveQty === 0) {
        lineTotal = item.rate * (1 - (item.disc || 0) / 100);
      } else {
        lineTotal = effectiveQty * item.rate * (1 - (item.disc || 0) / 100);
      }
      
      return sum + lineTotal;
    }, 0);

    // Step 6: Delete old sales ledger and re-post
    await Ledger.deleteMany({ voucher_id: existingBill.voucher_id, voucher_type: 'SALES', firm_id: firmId }, { session });
    await postSalesLedger({
      firmId, billId, voucherId: existingBill.voucher_id, billNo: existingBill.bno,
      billDate: meta.billDate, party: partyDoc, ntot, cgst, sgst, igst, rof,
      otherCharges, taxableItemsTotal, cogsLines, actorUsername, session,
    });

    await session.commitTransaction();
    res.json({ success: true, message: 'Bill updated successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[UPDATE_BILL] Error:', err.message);
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   CANCEL BILL (SALES)
════════════════════════════════════════════════════════════════════════════ */

export const cancelBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) { await session.abortTransaction(); return res.status(401).json({ error: 'Unauthorized' }); }
    const firmId = getFirmId(req, res, 'CANCEL_BILL');
    if (!firmId) { await session.abortTransaction(); return; }
    const billId = validateObjectId(req.params.id, 'bill ID', res);
    if (!billId) { await session.abortTransaction(); return; }

    const { reason } = req.body;
    const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!bill) { await session.abortTransaction(); return res.status(404).json({ error: 'Bill not found' }); }
    if (bill.status === 'CANCELLED') { await session.abortTransaction(); return res.status(400).json({ error: 'Bill is already cancelled' }); }

    const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const item of items) {
      if (!item.stock_id) continue;
      const cogsValue = item.cost_rate ? (item.qty * item.cost_rate) : 0;
      if (bill.btype === 'CREDIT_NOTE') {
        await Stock.findOneAndUpdate(
          { _id: item.stock_id, firm_id: firmId },
          buildAtomicSalesReturnReversalPipeline({
            batch: item.batch,
            removedQty: item.qty,
            removedValue: cogsValue,
            actorUsername,
          }),
          { session }
        );
      } else {
        await Stock.findOneAndUpdate(
          { _id: item.stock_id, firm_id: firmId },
          {
            $inc: {
              'batches.$[elem].qty': item.qty,
              qty: item.qty,
              total: cogsValue,
            },
            $set: { user: actorUsername },
          },
          {
            session,
            arrayFilters: [{ 'elem.batch': item.batch || null }],
          }
        );
      }
    }

    await Ledger.deleteMany({ voucher_id: bill.voucher_id, voucher_type: bill.btype, firm_id: firmId }, { session });

    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      { $set: { status: 'CANCELLED', cancellation_reason: reason || null, cancelled_at: new Date(), cancelled_by: req.user.id } },
      { session }
    );

    await session.commitTransaction();
    res.json({ success: true, message: 'Bill cancelled successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[CANCEL_BILL] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
};


/**
 * CREATE CREDIT NOTE (Sales Return)
 * 
 * A credit note references an original SALES bill and returns inventory items.
 * Stock quantities are restored using the original WAC (cost_rate).
 * Ledger entries reverse the original sale with matching amounts.
 */
export const createCreditNote = async (req, res) => {
  const { originalBillId, returnCart, narration } = req.body;
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
  
  const firmId = getFirmId(req, res, 'CREATE_CREDIT_NOTE');
  if (!firmId) return;

  const billIdObj = validateObjectId(originalBillId, 'originalBillId', res);
  if (!billIdObj) return;

  if (!returnCart || !Array.isArray(returnCart) || returnCart.length === 0) {
    return res.status(400).json({ error: 'Return cart cannot be empty' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch original bill
    const originalBill = await Bill.findOne({ _id: billIdObj, firm_id: firmId }).session(session).lean();
    if (!originalBill) {
      throw new Error('Original bill not found');
    }
    if (originalBill.btype !== 'SALES') {
      throw new Error('Can only create credit notes for SALES bills');
    }
    if (originalBill.status === 'CANCELLED') {
      throw new Error('Cannot create credit note against a cancelled bill');
    }

    // Fetch original StockReg entries
    const originalStockRegs = await StockReg.find({ bill_id: billIdObj, firm_id: firmId }).session(session).lean();

    // Fetch already-returned quantities for each item
    const returnedQtyByStockId = {};
    const existingCreditNotes = await Bill.find({
      ref_bill_id: billIdObj,
      btype: 'CREDIT_NOTE',
      status: 'ACTIVE',
      firm_id: firmId,
    }).session(session).lean();

    for (const existingCN of existingCreditNotes) {
      const existingRegs = await StockReg.find({ bill_id: existingCN._id, firm_id: firmId }).session(session).lean();
      for (const reg of existingRegs) {
        returnedQtyByStockId[String(reg.stock_id)] = (returnedQtyByStockId[String(reg.stock_id)] || 0) + reg.qty;
      }
    }

    const aggregatedReturnCart = aggregateReturnCart(returnCart);

    // Validate return quantities
    for (const returnItem of aggregatedReturnCart.values()) {
      const originalReg = originalStockRegs.find(r => String(r.stock_id) === String(returnItem.stockId));
      if (!originalReg) {
        throw new Error(`Item not found in original bill: ${returnItem.item}`);
      }
      const alreadyReturned = returnedQtyByStockId[String(returnItem.stockId)] || 0;
      const maxReturnQty = originalReg.qty - alreadyReturned;
      if (returnItem.returnQty > maxReturnQty) {
        throw new Error(`Cannot return ${returnItem.returnQty} units of ${returnItem.item} (max: ${maxReturnQty})`);
      }
    }

    const originalOtherCharges = Array.isArray(originalBill.other_charges) ? originalBill.other_charges : [];
    const originalGoodsTotal = originalStockRegs.reduce((sum, reg) => sum + (parseFloat(reg.total) || 0), 0);

    // Generate credit note number and voucher
    const cnBillNo = await getNextBillNumber(firmId, 'CREDIT_NOTE');
    const cnVoucherId = await getNextVoucherNumber(firmId);

    // Calculate totals for credit note
    const gstEnabled = await isGstEnabled(firmId);
    let returnedGoodsTotal = 0;

    for (const returnItem of aggregatedReturnCart.values()) {
      const lineTotal = returnItem.returnQty * returnItem.rate * (1 - (returnItem.disc || 0) / 100);
      returnedGoodsTotal += lineTotal;
    }

    const returnRatio = originalGoodsTotal > 0 ? Math.min(1, returnedGoodsTotal / originalGoodsTotal) : 0;
    const noteOtherCharges = originalOtherCharges
      .map((charge) => {
        const amount = (parseFloat(charge?.amount) || 0) * returnRatio;
        if (!(amount > 0)) return null;
        return { ...charge, amount };
      })
      .filter(Boolean);

    const returnQtyFn = (item) => parseFloat(item.returnQty) || 0;
    const returnItems = Array.from(aggregatedReturnCart.values());
    const {
      gtot: cnGtot,
      cgst: cnCgst,
      sgst: cnSgst,
      igst: cnIgst,
      ntot: cnNtot,
      rof: cnRof,
    } = calcBillTotals(
      returnItems,
      noteOtherCharges,
      gstEnabled,
      String(originalBill.bill_subtype || '').toLowerCase(),
      Boolean(originalBill.reverse_charge),
      returnQtyFn,
    );

    // Create credit note bill
    const firmRecord = await Firm.findById(firmId).select('name').lean().session(session);
    const [creditNoteBill] = await Bill.create([{
      firm_id: firmId,
      voucher_id: String(cnVoucherId),
      bno: cnBillNo,
      bdate: getLocalDateString(),
      ref_bill_id: billIdObj,
      
      // Copy party info from original
      supply: originalBill.supply,
      addr: originalBill.addr,
      gstin: originalBill.gstin,
      state: originalBill.state,
      pin: originalBill.pin,
      state_code: originalBill.state_code,

      // Copy firm info from original (critical for GSTR-1)
      firm_gstin: originalBill.firm_gstin,
      firm_state: originalBill.firm_state,
      firm_state_code: originalBill.firm_state_code,

      gtot: cnGtot,
      ntot: cnNtot,
      rof: cnRof,
      btype: 'CREDIT_NOTE',
      bill_subtype: originalBill.bill_subtype,
      usern: actorUsername,
      firm: firmRecord?.name || '',
      party_id: originalBill.party_id,
      reverse_charge: originalBill.reverse_charge,
      cgst: cnCgst,
      sgst: cnSgst,
      igst: cnIgst,
      other_charges: noteOtherCharges.length > 0 ? noteOtherCharges : null,
      narration: normalizeOptionalMultilineText(narration, 2000),
    }], { session });

    const cnBillId = creditNoteBill._id;
    const cogsLines = [];
    const stockRegDocs = [];

    // Restore stock and create audit trail
    for (const returnItem of aggregatedReturnCart.values()) {
      const originalReg = originalStockRegs.find(r => String(r.stock_id) === String(returnItem.stockId));
      if (!originalReg) continue;

      // Skip items with invalid/legacy stock_id (treat as SERVICE items that don't track stock)
      const stockId = originalReg.stock_id;
      if (!stockId || !mongoose.Types.ObjectId.isValid(String(stockId))) {
        continue;
      }

      // Use original cost_rate for stock restoration
      const costPerUnit = parseFloat(originalReg.cost_rate);
      if (!Number.isFinite(costPerUnit) || costPerUnit < 0) {
        throw new Error(`Missing original cost rate for item: ${originalReg.item}`);
      }
      const restoredValue = returnItem.returnQty * costPerUnit;
      const stockRecord = await Stock.findOne({ _id: stockId, firm_id: firmId }).session(session).lean();
      if (!stockRecord) {
        throw new Error(`Stock record not found: ${stockId}`);
      }

      // Since a CREDIT_NOTE is a return of goods, we increment stock qty, batch qty, and restore asset value
      const updatedStock = await Stock.findOneAndUpdate(
        { _id: stockId, firm_id: firmId },
        buildAtomicSalesReturnPipeline({
          batch: originalReg.batch,
          returnedQty: returnItem.returnQty,
          restoredValue,
          restoredRate: costPerUnit,
          actorUsername,
        }),
        { session, new: true }
      );
      if (!updatedStock) {
        throw new Error(`Failed to update stock for item ${originalReg.item}`);
      }

      // Create StockReg for audit trail
      const stockRegId = new mongoose.Types.ObjectId();
      stockRegDocs.push({
        _id: stockRegId,
        firm_id: firmId,
        type: 'CREDIT_NOTE',
        bno: cnBillNo,
        bdate: creditNoteBill.bdate,
        supply: originalBill.supply,
        item: originalReg.item,
        item_narration: originalReg.item_narration,
        batch: originalReg.batch,
        hsn: originalReg.hsn,
        qty: returnItem.returnQty,
        uom: originalReg.uom,
        rate: returnItem.rate,
        grate: returnItem.grate,
        disc: returnItem.disc || 0,
        total: returnItem.returnQty * returnItem.rate * (1 - (returnItem.disc || 0) / 100),
        cost_rate: costPerUnit,
        stock_id: stockId,
        bill_id: cnBillId,
        user: actorUsername,
        qtyh: updatedStock.qty,
      });

      // For ledger COGS reversal
      cogsLines.push({
        stockId,
        stockRegId,
        item: originalReg.item,
        cogsValue: returnItem.returnQty * costPerUnit,
      });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    // Post ledger entries (reverse the original sale)
    await postCreditNoteLedger({
      firmId,
      billId: cnBillId,
      voucherId: cnVoucherId,
      billNo: cnBillNo,
      billDate: creditNoteBill.bdate,
      party: { _id: originalBill.party_id, firm: originalBill.supply },
      ntot: cnNtot,
      cgst: cnCgst,
      sgst: cnSgst,
      igst: cnIgst,
      rof: cnRof,
      otherCharges: noteOtherCharges,
      taxableItemsTotal: returnedGoodsTotal,
      cogsLines,
      actorUsername,
      session,
    });

    await session.commitTransaction();
    res.json({ success: true, id: cnBillId, billNo: cnBillNo, message: 'Credit note created successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[CREATE_CREDIT_NOTE] Error:', err.message);
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};
