import 'dotenv/config.js';

import { connectDB, disconnectDB } from './mongoose.config.js';
import { Ledger, Party } from '../../models/index.js';
import { normalizeLedgerAccountHead } from './ledgerAccountResolver.js';

const APPLY_CHANGES = process.argv.includes('--apply');

const SYSTEM_ACCOUNT_TYPES = new Map([
  ['sales', 'INCOME'],
  ['purchase', 'EXPENSE'],
  ['round off', 'GENERAL'],
  ['cgst payable', 'LIABILITY'],
  ['sgst payable', 'LIABILITY'],
  ['igst payable', 'LIABILITY'],
  ['cgst input credit', 'ASSET'],
  ['sgst input credit', 'ASSET'],
  ['igst input credit', 'ASSET'],
]);

function mapKey(...parts) {
  return parts.map((part) => String(part ?? '')).join('::');
}

function pickCanonicalRow(rows) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  })[0];
}

async function fixPartyLedgers() {
  const parties = await Party.find({}, '_id firm').lean();
  const partyNameMap = new Map(parties.map((party) => [String(party._id), normalizeLedgerAccountHead(party.firm, 'Party')]));
  const rows = await Ledger.find({ party_id: { $ne: null } }, '_id firm_id party_id account_head account_type createdAt updatedAt').lean();

  const groups = new Map();
  for (const row of rows) {
    const key = mapKey(row.firm_id, row.party_id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let updatedGroups = 0;
  let updatedRows   = 0;

  for (const groupedRows of groups.values()) {
    const sample          = groupedRows[0];
    const canonicalRow    = pickCanonicalRow(groupedRows);
    const canonicalHead   = partyNameMap.get(String(sample.party_id)) || normalizeLedgerAccountHead(canonicalRow.account_head, 'Party');
    const canonicalType   = canonicalRow.account_type || 'DEBTOR';
    const needsWrite      = groupedRows.some((row) => row.account_head !== canonicalHead || row.account_type !== canonicalType);

    if (!needsWrite) continue;

    updatedGroups += 1;
    updatedRows   += groupedRows.length;

    if (APPLY_CHANGES) {
      await Ledger.updateMany(
        { firm_id: sample.firm_id, party_id: sample.party_id },
        { $set: { account_head: canonicalHead, account_type: canonicalType } }
      );
    }
  }

  return { updatedGroups, updatedRows };
}

async function fixGeneralLedgers() {
  const rows = await Ledger.find({ party_id: null }, '_id firm_id account_head account_type createdAt updatedAt').lean();
  const groups = new Map();

  for (const row of rows) {
    const normalizedHead = normalizeLedgerAccountHead(row.account_head).toLowerCase();
    const key = mapKey(row.firm_id, normalizedHead);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let updatedGroups = 0;
  let updatedRows   = 0;

  for (const groupedRows of groups.values()) {
    const sample        = groupedRows[0];
    const canonicalRow  = pickCanonicalRow(groupedRows);
    const canonicalHead = normalizeLedgerAccountHead(canonicalRow.account_head);
    const canonicalType = SYSTEM_ACCOUNT_TYPES.get(canonicalHead.toLowerCase()) || canonicalRow.account_type || 'GENERAL';
    const needsWrite    = groupedRows.some((row) => row.account_head !== canonicalHead || row.account_type !== canonicalType);

    if (!needsWrite) continue;

    updatedGroups += 1;
    updatedRows   += groupedRows.length;

    if (APPLY_CHANGES) {
      await Ledger.updateMany(
        { _id: { $in: groupedRows.map((row) => row._id) } },
        { $set: { account_head: canonicalHead, account_type: canonicalType } }
      );
    }
  }

  return { updatedGroups, updatedRows };
}

async function main() {
  await connectDB();

  try {
    const [partyResult, generalResult] = await Promise.all([
      fixPartyLedgers(),
      fixGeneralLedgers(),
    ]);

    console.log(`Mode: ${APPLY_CHANGES ? 'APPLY' : 'DRY_RUN'}`);
    console.log(`Party ledger groups to fix: ${partyResult.updatedGroups}`);
    console.log(`Party ledger rows to rewrite: ${partyResult.updatedRows}`);
    console.log(`General ledger groups to fix: ${generalResult.updatedGroups}`);
    console.log(`General ledger rows to rewrite: ${generalResult.updatedRows}`);
  } finally {
    await disconnectDB();
  }
}

main().catch(async (err) => {
  console.error('[FIX_LEDGER_ACCOUNT_CONSISTENCY] Failed:', err);
  try {
    await disconnectDB();
  } catch {
    // ignore disconnect errors during fatal exit
  }
  process.exit(1);
});
