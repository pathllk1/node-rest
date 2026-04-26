import mongoose from 'mongoose';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { put as blobPut, del as blobDel } from '@vercel/blob';
import {
  Stock, Party, Bill, StockReg, Ledger, Firm,
} from '../../../../models/index.js';
import {
  getActorUsername, getFirmId, validateObjectId,
  normalizeOptionalText, normalizeOptionalMultilineText, escapeRegex,
  getNextBillNumber, previewNextBillNumber, getNextVoucherNumber,
  isGstEnabled, ensureUniqueSupplierBillNo, calcBillTotals, getLocalDateString,
} from '../billUtils.js';
import { postPurchaseLedger, postDebitNoteLedger } from '../inventoryLedgerHelper.js';
import { getStateCode } from '../../../../utils/mongo/gstCalculator.js';

/* ── Re-export everything shared ─────────────────────────────────────────── */
export {
  getAllStocks, createStock, getStockById, updateStock, deleteStock,
  getAllParties, createParty, updateParty, deleteParty,
  getBillById, getAllBills, exportBillsExcel, exportBillsToPdf,
  getStockBatches, getStockMovements, exportStockMovementsToExcel,
  getStockMovementsByStock, createStockMovement,
  getOtherChargesTypes, lookupGST,
} from '../sharedStockHandlers.js';

/* ── Purchase-specific: getCurrentUserFirmName (includes locations[]) ────── */

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

/* ── Purchase-specific: party item history ────────────────────────────────── */

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
      { $match: { firm_id: fid, stock_id: sid, type: 'PURCHASE' } },
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

/* ── Purchase-specific: bill number preview ───────────────────────────────── */

export const getNextBillNumberPreviewEndpoint = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'PREVIEW_BILL_NUMBER');
    if (!firmId) return;
    const billNo = await previewNextBillNumber(firmId, 'PURCHASE');
    res.json({ success: true, nextBillNumber: billNo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── Purchase-specific: party balance (CREDITOR orientation) ──────────────── */

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

    const debit  = result?.total_debit  ?? 0;
    const credit = result?.total_credit ?? 0;
    const balance     = credit - debit; // positive = still payable to supplier
    const balanceType = balance > 0 ? 'Credit' : balance < 0 ? 'Debit' : 'Nil';
    res.json({ success: true, data: { partyId, balance, balance_type: balanceType, outstanding: Math.abs(balance), debit, credit } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   SHARED HELPERS
════════════════════════════════════════════════════════════════════════════ */

/**
 * Resolve and validate the active firm location for a purchase bill.
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
 * Validate GST bill type for a purchase.
 */
function validateGstBillType(billType, firmStateCode, partyStateCode, reverseCharge) {
  if (reverseCharge) return null;
  if (!firmStateCode || !partyStateCode) return null;

  const fCode = parseInt(firmStateCode, 10);
  const pCode = parseInt(partyStateCode, 10);
  const sameState = fCode === pCode;
  const sentIntra = billType === 'intra-state' || billType === 'INTRA-STATE';

  if (sameState && !sentIntra) {
    return `GST type mismatch: firm state (${firmStateCode}) and supplier state (${partyStateCode}) are the same — must use CGST+SGST (intra-state), not IGST.`;
  }
  if (!sameState && sentIntra) {
    return `GST type mismatch: firm state (${firmStateCode}) and supplier state (${partyStateCode}) differ — must use IGST (inter-state), not CGST+SGST.`;
  }
  return null;
}

function normalizeBatchValue(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildBatchDocument(item, qty) {
  return {
    batch:  normalizeBatchValue(item.batch),
    qty,
    uom:    normalizeOptionalText(item.uom, 20) || 'PCS',
    rate:   parseFloat(item.rate) || 0,
    grate:  parseFloat(item.grate) || 0,
    expiry: item.expiry || null,
    mrp:    toNullableNumber(item.mrp),
  };
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

function getOriginalPurchaseUnitCost(originalReg) {
  const qty = parseFloat(originalReg?.qty) || 0;
  const total = parseFloat(originalReg?.total) || 0;
  if (qty > 0 && total >= 0) return total / qty;

  const fallbackCost = parseFloat(originalReg?.cost_rate);
  if (Number.isFinite(fallbackCost) && fallbackCost >= 0) return fallbackCost;

  const fallbackRate = parseFloat(originalReg?.rate);
  if (Number.isFinite(fallbackRate) && fallbackRate >= 0) return fallbackRate;

  return null;
}

function buildAtomicPurchaseAddPipeline({ item, requestedQty, lineValue, actorUsername }) {
  const normalizedBatch = normalizeBatchValue(item.batch);
  const newBatchDoc = buildBatchDocument(item, requestedQty);
  const lineRate = parseFloat(item.rate) || 0;

  return [
    {
      $set: {
        batches: {
          $let: {
            vars: { existingBatches: { $ifNull: ['$batches', []] } },
            in: {
              $cond: [
                {
                  $in: [
                    normalizedBatch,
                    {
                      $map: {
                        input: '$$existingBatches',
                        as: 'b',
                        in: { $ifNull: ['$$b.batch', null] },
                      },
                    },
                  ],
                },
                {
                  $map: {
                    input: '$$existingBatches',
                    as: 'b',
                    in: {
                      $cond: [
                        { $eq: [{ $ifNull: ['$$b.batch', null] }, normalizedBatch] },
                        {
                          $mergeObjects: [
                            '$$b',
                            {
                              qty: { $add: [{ $ifNull: ['$$b.qty', 0] }, requestedQty] },
                              uom: newBatchDoc.uom,
                              rate: newBatchDoc.rate,
                              grate: newBatchDoc.grate,
                              expiry: newBatchDoc.expiry,
                              mrp: newBatchDoc.mrp,
                            },
                          ],
                        },
                        '$$b',
                      ],
                    },
                  },
                },
                { $concatArrays: ['$$existingBatches', [newBatchDoc]] },
              ],
            },
          },
        },
        qty: { $add: [{ $ifNull: ['$qty', 0] }, requestedQty] },
        total: {
          $add: [
            { $ifNull: ['$total', { $multiply: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$rate', 0] }] }] },
            lineValue,
          ],
        },
        rate: {
          $let: {
            vars: {
              nextQty: { $add: [{ $ifNull: ['$qty', 0] }, requestedQty] },
              nextTotal: {
                $add: [
                  { $ifNull: ['$total', { $multiply: [{ $ifNull: ['$qty', 0] }, { $ifNull: ['$rate', 0] }] }] },
                  lineValue,
                ],
              },
            },
            in: {
              $cond: [
                { $gt: ['$$nextQty', 0] },
                { $round: [{ $divide: ['$$nextTotal', '$$nextQty'] }, 6] },
                lineRate,
              ],
            },
          },
        },
        user: actorUsername,
      },
    },
  ];
}

function buildAtomicPurchaseReversePipeline({ batch, removedQty, costValue, actorUsername }) {
  const normalizedBatch = normalizeBatchValue(batch);

  return [
    {
      $set: {
        batches: {
          $map: {
            input: { $ifNull: ['$batches', []] },
            as: 'b',
            in: {
              $cond: [
                { $eq: [{ $ifNull: ['$$b.batch', null] }, normalizedBatch] },
                {
                  $mergeObjects: [
                    '$$b',
                    { qty: { $max: [0, { $subtract: [{ $ifNull: ['$$b.qty', 0] }, removedQty] }] } },
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
                costValue,
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
                      costValue,
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

function extractB2ObjectName(fileUrl) {
  if (!fileUrl) return null;

  try {
    const url = new URL(fileUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const fileIndex = segments.indexOf('file');
    if (fileIndex === -1 || segments.length <= fileIndex + 2) return null;

    return decodeURIComponent(segments.slice(fileIndex + 2).join('/'));
  } catch {
    return null;
  }
}

async function resolveB2BucketName(auth, bucketId) {
  const configuredBucketName = String(process.env.B2_BUCKET_NAME || '').trim();
  if (configuredBucketName) return configuredBucketName;

  const listResp = await axios.post(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
    accountId: auth.accountId,
    bucketId,
  }, {
    headers: { Authorization: auth.authorizationToken },
  });

  const bucket = (listResp.data?.buckets || []).find(entry => entry.bucketId === bucketId);
  return bucket?.bucketName || null;
}

async function normalizeCloudBillFileUrl(fileUrl) {
  if (!fileUrl) return null;
  if (!fileUrl.includes('/file/')) return fileUrl;

  const keyId = String(process.env.B2_APPLICATION_KEY_ID || '').trim();
  const appKey = String(process.env.B2_APPLICATION_KEY || '').trim();
  const bucketId = String(process.env.B2_BUCKET_ID || '').trim();
  const targetName = extractB2ObjectName(fileUrl);

  if (!keyId || !appKey || !bucketId || !targetName) return fileUrl;

  try {
    const authResp = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${appKey}`).toString('base64')}` },
    });
    const auth = authResp.data;
    const bucketName = await resolveB2BucketName(auth, bucketId);

    if (!bucketName) return fileUrl;
    return `${auth.downloadUrl}/file/${bucketName}/${encodeURIComponent(targetName)}`;
  } catch (err) {
    console.warn('[NORMALIZE_CLOUD_BILL_FILE_URL] Failed to normalize B2 URL:', err.message);
    return fileUrl;
  }
}

async function deleteFromBackblazeB2(fileUrl) {
  const keyId = String(process.env.B2_APPLICATION_KEY_ID || '').trim();
  const appKey = String(process.env.B2_APPLICATION_KEY || '').trim();
  const bucketId = String(process.env.B2_BUCKET_ID || '').trim();
  const targetName = extractB2ObjectName(fileUrl);

  if (!keyId || !appKey || !bucketId || !targetName) return false;

  const authResp = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${appKey}`).toString('base64')}` },
  });
  const auth = authResp.data;

  const listResp = await axios.post(`${auth.apiUrl}/b2api/v2/b2_list_file_versions`, {
    bucketId,
    prefix: targetName,
    maxFileCount: 25,
  }, {
    headers: { Authorization: auth.authorizationToken },
  });

  const matches = (listResp.data?.files || []).filter(file => file.fileName === targetName);
  if (!matches.length) return false;

  for (const match of matches) {
    await axios.post(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
      fileName: match.fileName,
      fileId: match.fileId,
    }, {
      headers: { Authorization: auth.authorizationToken },
    });
  }

  return true;
}

async function deleteFromVercelBlob(fileUrl) {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (!token || !fileUrl) return false;

  await blobDel(fileUrl, { token });
  return true;
}

async function deleteCloudBillFile(fileUrl) {
  if (!fileUrl) return false;

  const errors = [];

  if (fileUrl.includes('/file/')) {
    try {
      return await deleteFromBackblazeB2(fileUrl);
    } catch (err) {
      errors.push(err);
    }
  }

  try {
    return await deleteFromVercelBlob(fileUrl);
  } catch (err) {
    errors.push(err);
  }

  if (errors.length) throw errors[0];
  return false;
}

/* ════════════════════════════════════════════════════════════════════════════
   CREATE BILL (PURCHASE)
════════════════════════════════════════════════════════════════════════════ */

export const createBill = async (req, res) => {
  const { meta, party, cart, otherCharges, consignee } = req.body;
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
  const firmId = getFirmId(req, res, 'CREATE_BILL');
  if (!firmId) return;

  if (!cart?.length) return res.status(400).json({ error: 'Cart cannot be empty' });
  if (!party || !mongoose.Types.ObjectId.isValid(party))
    return res.status(400).json({ error: 'Invalid party ID' });

  const partyDoc = await Party.findOne({ _id: party, firm_id: firmId }).lean();
  if (!partyDoc) return res.status(404).json({ error: 'Party not found' });

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

  let consigneeStateCode = null;
  try {
    consigneeStateCode = resolveConsigneeStateCode(consignee || {});
  } catch (consigneeErr) {
    return res.status(400).json({ error: consigneeErr.message });
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

  const supplierBillNo = normalizeOptionalText(meta?.supplierBillNo, 80);
  const referenceNo    = normalizeOptionalText(meta?.referenceNo, 80);
  const vehicleNo      = normalizeOptionalText(meta?.vehicleNo, 40);
  const dispatchVia    = normalizeOptionalText(meta?.dispatchThrough, 80);
  const narration      = normalizeOptionalMultilineText(meta?.narration, 2000);
  const billSubtype    = meta?.billType ? String(meta.billType).toUpperCase() : null;

  for (const item of cart) {
    if (!item.stockId || !mongoose.Types.ObjectId.isValid(item.stockId))
      return res.status(400).json({ error: `Invalid stockId for item: ${item.item ?? '(unknown)'}` });
    if (!item.qty || parseFloat(item.qty) <= 0)
      return res.status(400).json({ error: `Quantity must be > 0 for item: ${item.item}` });
    if (item.rate === undefined || item.rate === null || parseFloat(item.rate) < 0)
      return res.status(400).json({ error: `Rate must be >= 0 for item: ${item.item}` });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await ensureUniqueSupplierBillNo({ firmId, partyId: partyDoc._id, supplierBillNo });

    const billNo    = await getNextBillNumber(firmId, 'PURCHASE');
    const voucherId = await getNextVoucherNumber(firmId);

    const gstEnabled = await isGstEnabled(firmId);
    const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge);

    const firmRecord = await Firm.findById(firmId).select('name').lean();
    const firmName   = firmRecord?.name ?? '';

    const [newBill] = await Bill.create([{
      firm_id: firmId, voucher_id: String(voucherId), bno: billNo,
      supplier_bill_no: supplierBillNo, bdate: meta.billDate,
      supply: partyDoc.firm || '', firm: firmName,
      addr: selectedPartyAddr || '', gstin: selectedPartyGstin || 'UNREGISTERED',
      state: selectedPartyState || '', pin: selectedPartyPin || null,
      state_code: selectedPartyStateCode || null,
      firm_gstin:      firmLoc?.gst_number  || null,
      firm_state:      firmLoc?.state       || null,
      firm_state_code: firmStateCode        || null,
      gtot, ntot, rof, btype: 'PURCHASE', bill_subtype: billSubtype,
      usern: actorUsername, party_id: partyDoc._id,
      other_charges: otherCharges?.length > 0 ? otherCharges : null,
      order_no: referenceNo, vehicle_no: vehicleNo, dispatch_through: dispatchVia,
      narration, reverse_charge: Boolean(meta.reverseCharge),
      cgst, sgst, igst,
      consignee_name: consignee?.name || null, consignee_gstin: consignee?.gstin || null,
      consignee_address: consignee?.address || null, consignee_state: consignee?.state || null,
      consignee_pin: consignee?.pin || null, consignee_state_code: consigneeStateCode,
    }], { session });

    const billId = newBill._id;

    const stockRegDocs  = [];
    const purchasedItems = [];

    for (const item of cart) {
      const requestedQty = parseFloat(item.qty);
      const lineValue    = requestedQty * item.rate * (1 - (item.disc || 0) / 100);

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId })
        .session(session).lean();
      if (!stockRecord) throw new Error(`Stock not found: ${item.stockId} (item: ${item.item})`);

      const updatedStock = await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        buildAtomicPurchaseAddPipeline({ item, requestedQty, lineValue, actorUsername }),
        { session, new: true }
      );
      if (!updatedStock) throw new Error(`Failed to update stock for item ${item.item}`);

      const stockRegId = new mongoose.Types.ObjectId();
      stockRegDocs.push({
        _id:            stockRegId,
        firm_id:        firmId, type: 'PURCHASE', bno: billNo,
        bdate:          meta.billDate, supply: partyDoc.firm,
        item:           item.item, item_narration: item.narration || null,
        batch:          item.batch || null, hsn: item.hsn,
        qty:            item.qty, uom: item.uom, rate: item.rate,
        grate:          item.grate, disc: item.disc || 0,
        total:          lineValue,
        cost_rate:      requestedQty > 0 ? (lineValue / requestedQty) : 0,
        stock_id:       item.stockId, bill_id: billId,
        user:           actorUsername, qtyh: updatedStock.qty,
      });

      purchasedItems.push({ stockId: item.stockId, stockRegId, item: item.item, lineValue });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    await postPurchaseLedger({
      firmId, billId, voucherId, billNo, billDate: meta.billDate,
      party: partyDoc, ntot, cgst, sgst, igst, rof,
      otherCharges, purchasedItems, actorUsername, session,
    });

    await session.commitTransaction();
    res.json({ success: true, id: billId, billNo, message: 'Purchase bill created successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[CREATE_BILL] Error:', err.message, err.stack);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message || 'Failed to create purchase bill' });
  } finally {
    session.endSession();
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   UPDATE BILL (PURCHASE)
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

    if (!party || !mongoose.Types.ObjectId.isValid(party)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid party ID' });
    }

    const partyDoc = await Party.findOne({ _id: party, firm_id: firmId }).lean();
    if (!partyDoc) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Party not found' });
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

    let consigneeStateCode = null;
    try {
      consigneeStateCode = resolveConsigneeStateCode(consignee || {});
    } catch (consigneeErr) {
      await session.abortTransaction();
      return res.status(400).json({ error: consigneeErr.message });
    }

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

    for (const item of cart) {
      if (!item.stockId || !mongoose.Types.ObjectId.isValid(item.stockId))
        return res.status(400).json({ error: `Invalid stockId for item: ${item.item ?? '(unknown)'}` });
      if (!item.qty || parseFloat(item.qty) <= 0)
        return res.status(400).json({ error: `Quantity must be > 0 for item: ${item.item}` });
      if (item.rate === undefined || item.rate === null || parseFloat(item.rate) < 0)
        return res.status(400).json({ error: `Rate must be >= 0 for item: ${item.item}` });
    }

    const existingBill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!existingBill) return res.status(404).json({ error: 'Bill not found' });
    if (existingBill.status === 'CANCELLED') return res.status(400).json({ error: 'Cancelled bills cannot be modified' });
    if (meta.billNo && meta.billNo !== existingBill.bno) return res.status(400).json({ error: 'Bill number cannot be changed' });
    if (existingBill.btype === 'DEBIT_NOTE') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Editing debit notes is not supported. Cancel and recreate the debit note instead.' });
    }

    const supplierBillNo = normalizeOptionalText(meta?.supplierBillNo, 80);
    await ensureUniqueSupplierBillNo({ firmId, partyId: partyDoc._id, supplierBillNo, excludeBillId: billId });

    const existingItems = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const ei of existingItems) {
      const stockRecord = await Stock.findOne({ _id: ei.stock_id, firm_id: firmId }).session(session).lean();
      if (!stockRecord) continue;

      const costValue = ei.total || (ei.qty * (ei.cost_rate ?? ei.rate));
      await Stock.findOneAndUpdate(
        { _id: ei.stock_id, firm_id: firmId },
        buildAtomicPurchaseReversePipeline({ batch: ei.batch, removedQty: ei.qty, costValue, actorUsername }),
        { session }
      );
    }

    const gstEnabled = await isGstEnabled(firmId);
    const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge);

    const firmRecord = await Firm.findById(firmId).select('name').lean();
    const firmName   = firmRecord?.name ?? existingBill.firm ?? '';

    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      { $set: {
          bdate: meta.billDate, supply: partyDoc.firm || '', firm: firmName,
          addr: selectedPartyAddr || '', gstin: selectedPartyGstin || 'UNREGISTERED',
          state: selectedPartyState || '', pin: selectedPartyPin || null, state_code: selectedPartyStateCode || null,
          firm_gstin:      firmLoc?.gst_number  || null,
          firm_state:      firmLoc?.state       || null,
          firm_state_code: firmStateCode        || null,
          gtot, ntot, rof, btype: 'PURCHASE',
          bill_subtype: meta?.billType ? String(meta.billType).toUpperCase() : null,
          usern: actorUsername, party_id: partyDoc._id,
          other_charges: otherCharges?.length > 0 ? otherCharges : null,
          supplier_bill_no: supplierBillNo,
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

    await StockReg.deleteMany({ bill_id: billId, firm_id: firmId }, { session });

    const stockRegDocs   = [];
    const purchasedItems = [];

    for (const item of cart) {
      const requestedQty = parseFloat(item.qty);
      const lineValue    = requestedQty * item.rate * (1 - (item.disc || 0) / 100);

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId }).session(session).lean();
      if (!stockRecord) throw new Error(`Stock not found for ID: ${item.stockId}`);

      const updatedStock = await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        buildAtomicPurchaseAddPipeline({ item, requestedQty, lineValue, actorUsername }),
        { session, new: true }
      );
      if (!updatedStock) throw new Error(`Failed to update stock for item ${item.item}`);

      const stockRegId = new mongoose.Types.ObjectId();
      stockRegDocs.push({
        _id: stockRegId, firm_id: firmId, type: 'PURCHASE',
        bno: existingBill.bno, bdate: meta.billDate, supply: partyDoc.firm,
        item: item.item, item_narration: item.narration || null,
        batch: item.batch || null, hsn: item.hsn, qty: item.qty, uom: item.uom,
        rate: item.rate, grate: item.grate, disc: item.disc || 0,
        total: lineValue, cost_rate: requestedQty > 0 ? (lineValue / requestedQty) : 0,
        stock_id: item.stockId, bill_id: billId, user: actorUsername, qtyh: updatedStock.qty,
      });
      purchasedItems.push({ stockId: item.stockId, stockRegId, item: item.item, lineValue });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    await Ledger.deleteMany({ voucher_id: existingBill.voucher_id, voucher_type: 'PURCHASE', firm_id: firmId }, { session });
    await postPurchaseLedger({
      firmId, billId, voucherId: existingBill.voucher_id, billNo: existingBill.bno,
      billDate: meta.billDate, party: partyDoc, ntot, cgst, sgst, igst, rof,
      otherCharges, purchasedItems, actorUsername, session,
    });

    await session.commitTransaction();
    res.json({ success: true, id: billId, billNo: existingBill.bno, message: 'Bill updated successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[UPDATE_BILL] Error:', err.message);
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   BILL FILE UPLOAD (PURCHASE) — CLOUD-ONLY FOR VERCEL
════════════════════════════════════════════════════════════════════════════ */

/**
 * Upload a buffer to Backblaze B2.
 */
async function uploadToBackblazeB2(buffer, fileName, contentType) {
    const keyId    = String(process.env.B2_APPLICATION_KEY_ID || '').trim();
    const appKey   = String(process.env.B2_APPLICATION_KEY    || '').trim();
    const bucketId = String(process.env.B2_BUCKET_ID          || '').trim();
    const prefix   = String(process.env.B2_BUCKET_PREFIX      || '').trim().replace(/^\/+|\/+$/g, '');

    if (!keyId || !appKey || !bucketId) return null;

    try {
        const authResp = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${appKey}`).toString('base64')}` },
        });
        const auth = authResp.data;

        const urlResp = await axios.post(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, { bucketId }, {
            headers: { Authorization: auth.authorizationToken },
        });
        const uploadInfo = urlResp.data;

        const targetName = prefix ? `${prefix}/${fileName}` : fileName;
        const sha1       = createHash('sha1').update(buffer).digest('hex');

        const uploadResp = await axios.post(uploadInfo.uploadUrl, buffer, {
            headers: {
                Authorization:       uploadInfo.authorizationToken,
                'X-Bz-File-Name':    encodeURIComponent(targetName),
                'Content-Type':      contentType || 'application/octet-stream',
                'Content-Length':    buffer.length,
                'X-Bz-Content-Sha1': sha1,
            },
            maxBodyLength: Infinity,
        });

        // Validate response has required fields
        if (!uploadResp.data.bucketName) {
            console.error('[UPLOAD_TO_B2] Missing bucketName in response:', uploadResp.data);
            return null;
        }

        const fileUrl = `${auth.downloadUrl}/file/${uploadResp.data.bucketName}/${encodeURIComponent(targetName)}`;
        console.log('[UPLOAD_TO_B2] File uploaded successfully:', fileUrl.substring(0, 80) + '...');
        return fileUrl;
    } catch (err) {
        console.error('[UPLOAD_TO_B2] Error:', {
            status: err.response?.status,
            message: err.response?.data?.message || err.message,
            code: err.response?.data?.code,
        });
        return null;
    }
}

/**
 * Upload a buffer to Vercel Blob storage.
 */
async function uploadToVercelBlob(buffer, fileName, contentType) {
    const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    if (!token) return null;

    const blob = await blobPut(fileName, buffer, {
        access:      'public',
        contentType: contentType || 'application/octet-stream',
        token,
    });

    return blob.url;
}

export const uploadBillFile = async (req, res) => {
    try {
        const actorUsername = getActorUsername(req);
        if (!actorUsername) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const firmId = getFirmId(req, res, 'UPLOAD_BILL_FILE');
        if (!firmId) return;

        const billId = validateObjectId(req.params.id, 'bill ID', res);
        if (!billId) return;

        if (!req.file) return res.status(400).json({ success: false, error: 'No file received' });

        const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
        if (!bill) return res.status(404).json({ success: false, error: 'Bill not found' });
        if (bill.status === 'CANCELLED') {
            return res.status(400).json({ success: false, error: 'Cannot attach files to cancelled bills' });
        }
        const previousFileUrl = bill.file_url || null;

        // ── Cloud storage only (Vercel has no persistent fs) ─────────────────
        const userId   = req.user?.id || req.user?._id || 'unknown';
        const safeName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        const cloudPath = `uploads/${firmId}/${userId}/${Date.now()}-${safeName}`;

        let fileUrl = null;

        // Try Backblaze B2 first (only if properly configured)
        const b2Configured = String(process.env.B2_APPLICATION_KEY_ID || '').trim() &&
                             String(process.env.B2_APPLICATION_KEY || '').trim() &&
                             String(process.env.B2_BUCKET_ID || '').trim();
        
        if (b2Configured) {
            try {
                console.log('[UPLOAD_BILL_FILE] Attempting B2 upload...');
                fileUrl = await uploadToBackblazeB2(req.file.buffer, cloudPath, req.file.mimetype);
            } catch (b2Err) {
                console.warn('[UPLOAD_BILL_FILE] Backblaze upload failed:', b2Err.message);
            }
        } else {
            console.log('[UPLOAD_BILL_FILE] B2 not properly configured, skipping to Vercel Blob');
        }

        // Fallback to Vercel Blob if B2 failed or was not configured
        if (!fileUrl) {
            try {
                console.log('[UPLOAD_BILL_FILE] Attempting Vercel Blob upload...');
                fileUrl = await uploadToVercelBlob(req.file.buffer, cloudPath, req.file.mimetype);
            } catch (blobErr) {
                console.error('[UPLOAD_BILL_FILE] Vercel Blob also failed:', blobErr.message);
                return res.status(500).json({
                    success: false,
                    error: 'Cloud storage upload failed. Verify BLOB_READ_WRITE_TOKEN is set. If using B2, ensure B2_BUCKET_ID is valid.',
                });
            }
        }

        if (!fileUrl) {
            return res.status(500).json({
                success: false,
                error: 'Cloud storage upload failed. No valid storage backend available.',
            });
        }

        // ── Persist on Bill document ────────────────────────────────────────
        await Bill.findOneAndUpdate(
            { _id: billId, firm_id: firmId },
            { $set: { file_url: fileUrl, file_uploaded_by: actorUsername } },
        );

        if (previousFileUrl && previousFileUrl !== fileUrl) {
            deleteCloudBillFile(previousFileUrl).catch((cleanupErr) => {
                console.warn('[UPLOAD_BILL_FILE] Previous file cleanup failed:', cleanupErr.message);
            });
        }

        res.json({ success: true, fileUrl, message: 'File uploaded successfully' });
    } catch (err) {
        console.error('[UPLOAD_BILL_FILE] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

export const openBillAttachment = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'OPEN_BILL_ATTACHMENT');
    if (!firmId) return;

    const billId = validateObjectId(req.params.id, 'bill ID', res);
    if (!billId) return;

    const bill = await Bill.findOne({ _id: billId, firm_id: firmId })
      .select('file_url file_path bno')
      .lean();

    if (!bill || (!bill.file_url && !bill.file_path)) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    // Try local file first (legacy support)
    if (bill.file_path) {
      const candidatePath = path.isAbsolute(bill.file_path)
        ? bill.file_path
        : path.resolve(process.cwd(), bill.file_path);

      if (fs.existsSync(candidatePath)) {
        return res.sendFile(candidatePath, {
          headers: {
            'Cache-Control': 'private, no-store',
          },
        });
      }
    }

    if (!bill.file_url) {
      return res.status(404).json({ success: false, error: 'Attachment file is unavailable' });
    }

    // Validate URL before attempting to fetch
    if (bill.file_url.includes('undefined') || bill.file_url.includes('null') || !bill.file_url.startsWith('http')) {
      console.error('[OPEN_BILL_ATTACHMENT] Malformed URL detected:', bill.file_url);
      return res.status(400).json({ 
        success: false, 
        error: 'Attachment URL is corrupted. The file may need to be re-uploaded.' 
      });
    }

    // For cloud URLs, serve through proxy to handle auth headers
    try {
      console.log('[OPEN_BILL_ATTACHMENT] Fetching from URL:', bill.file_url.substring(0, 100) + '...');
      const response = await axios.get(bill.file_url, {
        responseType: 'stream',
        timeout: 30000,
        validateStatus: () => true,
      });

      if (response.status >= 400) {
        console.error('[OPEN_BILL_ATTACHMENT] Cloud returned error:', response.status, response.statusText);
        return res.status(response.status).json({ 
          success: false, 
          error: `Cloud storage error: ${response.status}` 
        });
      }

      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      response.data.pipe(res);
    } catch (cloudErr) {
      console.error('[OPEN_BILL_ATTACHMENT] Cloud file access failed:', {
        message: cloudErr.message,
        code: cloudErr.code,
        status: cloudErr.response?.status,
      });
      return res.status(502).json({ 
        success: false, 
        error: 'Failed to retrieve attachment from cloud storage. File may have expired or been deleted.' 
      });
    }

  } catch (err) {
    console.error('[OPEN_BILL_ATTACHMENT] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};


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
    const attachedFileUrl = bill.file_url || null;

    const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const item of items) {
      if (!item.stock_id) continue;
      const costValue   = item.total || (item.qty * (item.cost_rate ?? item.rate));
      if (bill.btype === 'DEBIT_NOTE') {
        await Stock.findOneAndUpdate(
          { _id: item.stock_id, firm_id: firmId },
          buildAtomicPurchaseAddPipeline({
            item: {
              batch: item.batch,
              uom: item.uom,
              rate: item.cost_rate ?? item.rate,
              grate: item.grate,
              expiry: null,
              mrp: null,
            },
            requestedQty: item.qty,
            lineValue: costValue,
            actorUsername,
          }),
          { session }
        );
      } else {
        await Stock.findOneAndUpdate(
          { _id: item.stock_id, firm_id: firmId },
          buildAtomicPurchaseReversePipeline({ batch: item.batch, removedQty: item.qty, costValue, actorUsername }),
          { session }
        );
      }
    }

    await Ledger.deleteMany({ voucher_id: bill.voucher_id, voucher_type: bill.btype, firm_id: firmId }, { session });

    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      { $set: {
          status: 'CANCELLED',
          cancellation_reason: reason || null,
          cancelled_at: new Date(),
          cancelled_by: req.user.id,
          file_url: null,
          file_uploaded_by: null,
      } },
      { session }
    );

    await session.commitTransaction();

    if (attachedFileUrl) {
      deleteCloudBillFile(attachedFileUrl).catch((cleanupErr) => {
        console.warn('[CANCEL_BILL] Attached file cleanup failed:', cleanupErr.message);
      });
    }

    res.json({ success: true, message: 'Bill cancelled successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[CANCEL_BILL] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

/* ─── DEBIT NOTE (purchase return) ───────────────────────────────────────── */

export const createDebitNote = async (req, res) => {
  const { originalBillId, returnCart, narration } = req.body;
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
  
  const firmId = getFirmId(req, res, 'CREATE_DEBIT_NOTE');
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
    if (originalBill.btype !== 'PURCHASE') {
      throw new Error('Can only create debit notes for PURCHASE bills');
    }
    if (originalBill.status === 'CANCELLED') {
      throw new Error('Cannot create debit note against a cancelled bill');
    }

    // Fetch original StockReg entries
    const originalStockRegs = await StockReg.find({ bill_id: billIdObj, firm_id: firmId }).session(session).lean();

    // Fetch already-returned quantities for each item
    const returnedQtyByStockId = {};
    const existingDebitNotes = await Bill.find({
      ref_bill_id: billIdObj,
      btype: 'DEBIT_NOTE',
      status: 'ACTIVE',
      firm_id: firmId,
    }).session(session).lean();

    for (const existingDN of existingDebitNotes) {
      const existingRegs = await StockReg.find({ bill_id: existingDN._id, firm_id: firmId }).session(session).lean();
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

      const stockRecord = await Stock.findOne({ _id: returnItem.stockId, firm_id: firmId })
        .select('qty')
        .session(session)
        .lean();
      if (!stockRecord) {
        throw new Error(`Stock record not found: ${returnItem.stockId}`);
      }
      if (returnItem.returnQty > (parseFloat(stockRecord.qty) || 0)) {
        throw new Error(`Insufficient stock for ${returnItem.item}. Available: ${stockRecord.qty}, requested return: ${returnItem.returnQty}`);
      }
    }

    const originalOtherCharges = Array.isArray(originalBill.other_charges) ? originalBill.other_charges : [];
    const originalGoodsTotal = originalStockRegs.reduce((sum, reg) => sum + (parseFloat(reg.total) || 0), 0);

    // Generate debit note number and voucher
    const dnBillNo = await getNextBillNumber(firmId, 'DEBIT_NOTE');
    const dnVoucherId = await getNextVoucherNumber(firmId);

    // Calculate totals for debit note
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
      gtot: dnGtot,
      cgst: dnCgst,
      sgst: dnSgst,
      igst: dnIgst,
      ntot: dnNtot,
      rof: dnRof,
    } = calcBillTotals(
      returnItems,
      noteOtherCharges,
      gstEnabled,
      String(originalBill.bill_subtype || '').toLowerCase(),
      Boolean(originalBill.reverse_charge),
      returnQtyFn,
    );

    // Create debit note bill
    const firmRecord = await Firm.findById(firmId).select('name').lean().session(session);
    const [debitNoteBill] = await Bill.create([{
      firm_id: firmId,
      voucher_id: String(dnVoucherId),
      bno: dnBillNo,
      bdate: getLocalDateString(),
      ref_bill_id: billIdObj,
      
      // Copy party info from original
      supply: originalBill.supply,
      addr: originalBill.addr,
      gstin: originalBill.gstin,
      state: originalBill.state,
      pin: originalBill.pin,
      state_code: originalBill.state_code,

      // Copy firm info from original (critical for GSTR-2)
      firm_gstin: originalBill.firm_gstin,
      firm_state: originalBill.firm_state,
      firm_state_code: originalBill.firm_state_code,

      gtot: dnGtot,
      ntot: dnNtot,
      rof: dnRof,
      btype: 'DEBIT_NOTE',
      bill_subtype: originalBill.bill_subtype,
      usern: actorUsername,
      firm: firmRecord?.name || '',
      party_id: originalBill.party_id,
      reverse_charge: originalBill.reverse_charge,
      cgst: dnCgst,
      sgst: dnSgst,
      igst: dnIgst,
      other_charges: noteOtherCharges.length > 0 ? noteOtherCharges : null,
      narration: normalizeOptionalMultilineText(narration, 2000),
    }], { session });

    const dnBillId = debitNoteBill._id;
    const purchasedItemsForLedger = [];
    const stockRegDocs = [];

    // Remove stock (return goods to supplier) and create audit trail
    for (const returnItem of aggregatedReturnCart.values()) {
      const originalReg = originalStockRegs.find(r => String(r.stock_id) === String(returnItem.stockId));
      if (!originalReg) continue;

      // Purchase returns reverse the original net item cost.
      // Bill-level charges are reversed separately through noteOtherCharges.
      const costPerUnit = getOriginalPurchaseUnitCost(originalReg);
      if (!Number.isFinite(costPerUnit) || costPerUnit < 0) {
        throw new Error(`Missing original cost rate for item: ${originalReg.item}`);
      }
      const removedValue = returnItem.returnQty * costPerUnit;

      // Atomic stock decrement (reverse the original increment)
      const stockId = originalReg.stock_id;
      const stockRecord = await Stock.findOne({ _id: stockId, firm_id: firmId }).session(session).lean();
      if (!stockRecord) {
        throw new Error(`Stock record not found: ${stockId}`);
      }

      // Since a DEBIT_NOTE is a return of goods, we decrement stock qty, batch qty, and asset value
      const updatedStock = await Stock.findOneAndUpdate(
        { _id: stockId, firm_id: firmId },
        buildAtomicPurchaseReversePipeline({
          batch: originalReg.batch,
          removedQty: returnItem.returnQty,
          costValue: removedValue,
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
        type: 'DEBIT_NOTE',
        bno: dnBillNo,
        bdate: debitNoteBill.bdate,
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
        bill_id: dnBillId,
        user: actorUsername,
        qtyh: updatedStock.qty,
      });

      // For ledger inventory reversal
      purchasedItemsForLedger.push({
        stockId,
        stockRegId,
        item: originalReg.item,
        lineValue: returnItem.returnQty * costPerUnit,
      });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    // Post ledger entries (reverse the original purchase)
    await postDebitNoteLedger({
      firmId,
      billId: dnBillId,
      voucherId: dnVoucherId,
      billNo: dnBillNo,
      billDate: debitNoteBill.bdate,
      party: { _id: originalBill.party_id, firm: originalBill.supply },
      ntot: dnNtot,
      cgst: dnCgst,
      sgst: dnSgst,
      igst: dnIgst,
      rof: dnRof,
      otherCharges: noteOtherCharges,
      purchasedItems: purchasedItemsForLedger,
      actorUsername,
      session,
    });

    await session.commitTransaction();
    res.json({ success: true, id: dnBillId, billNo: dnBillNo, message: 'Debit note created successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[CREATE_DEBIT_NOTE] Error:', err.message);
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};
