import { Ledger } from '../../models/index.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeLedgerAccountHead(value, fallback = 'Other Charges') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return normalized || fallback;
}

export async function resolveLedgerPostingAccount({
  firmId,
  accountHead,
  fallbackType,
  partyId = null,
  session = null,
}) {
  const normalizedHead = normalizeLedgerAccountHead(accountHead);
  const escapedHead    = escapeRegex(normalizedHead);
  const baseFilter     = {
    firm_id:      firmId,
    account_head: { $regex: `^${escapedHead}$`, $options: 'i' },
  };

  const queryOptions = { sort: { updatedAt: -1, createdAt: -1 } };
  if (session) queryOptions.session = session;

  const filter = partyId
    ? { ...baseFilter, party_id: partyId }
    : { ...baseFilter, party_id: null };

  const existing = await Ledger.findOne(filter, 'account_head account_type', queryOptions).lean();

  return {
    accountHead: existing?.account_head || normalizedHead,
    accountType: existing?.account_type || fallbackType,
  };
}
