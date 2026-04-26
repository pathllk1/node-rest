/**
 * STATE MANAGEMENT MODULE
 * Handles global state initialization, data fetching, and state updates
 */

/**
 * GST-registered state codes for all Indian states and UTs (zero-padded strings).
 * Keys are lower-cased state name variants; value is the 2-digit code from GSTIN[0:2].
 * Used as a fallback to resolve state_code from a state name string,
 * particularly for unregistered parties where GSTIN is absent.
 */
export const INDIA_STATE_CODES = {
    'jammu and kashmir':           '01', 'j&k':                       '01', 'jk':             '01',
    'himachal pradesh':            '02', 'hp':                        '02',
    'punjab':                      '03',
    'chandigarh':                  '04',
    'uttarakhand':                 '05', 'uttaranchal':               '05',
    'haryana':                     '06',
    'delhi':                       '07', 'new delhi':                 '07',
    'rajasthan':                   '08',
    'uttar pradesh':               '09', 'up':                        '09',
    'bihar':                       '10',
    'sikkim':                      '11',
    'arunachal pradesh':           '12',
    'nagaland':                    '13',
    'manipur':                     '14',
    'mizoram':                     '15',
    'tripura':                     '16',
    'meghalaya':                   '17',
    'assam':                       '18',
    'west bengal':                 '19', 'wb':                        '19',
    'jharkhand':                   '20',
    'odisha':                      '21', 'orissa':                    '21',
    'chhattisgarh':                '22',
    'madhya pradesh':              '23', 'mp':                        '23',
    'gujarat':                     '24',
    'daman and diu':               '25', 'daman & diu':               '25',
    'dadra and nagar haveli':      '26', 'dadra & nagar haveli':      '26',
    'maharashtra':                 '27',
    'andhra pradesh':              '28', 'ap':                        '28',
    'karnataka':                   '29',
    'goa':                         '30',
    'lakshadweep':                 '31',
    'kerala':                      '32',
    'tamil nadu':                  '33', 'tn':                        '33',
    'puducherry':                  '34', 'pondicherry':               '34',
    'andaman and nicobar islands': '35', 'andaman & nicobar islands': '35',
    'telangana':                   '36', 'ts':                        '36',
    'andhra pradesh (new)':        '37',
    'ladakh':                      '38',
    'other territory':             '97',
};

export function createInitialState() {
    return {
        stocks:                [],
        parties:               [],
        cart:                  [],
        selectedParty:         null,
        selectedConsignee:     null,
        consigneeSameAsBillTo: true,
        historyCache:          {},
        meta: {
            billNo:          '',
            billDate:        new Date().toISOString().split('T')[0],
            billType:        'intra-state',
            reverseCharge:   false,
            referenceNo:     '',
            vehicleNo:       '',
            dispatchThrough: '',
            narration:       '',
        },
        otherCharges:    [],
        currentFirmName: 'Your Company Name',
        gstEnabled:      true,

        // FIX: Firm GST locations — needed for multi-GSTIN tax-type determination.
        // firmLocations[]  = all locations from Firm.locations
        // activeFirmLocation = whichever the user has selected for this bill
        //   (defaults to the is_default location; user can change via dropdown)
        firmLocations:      [],
        activeFirmLocation: null,
    };
}

export async function fetchCurrentUserFirmName(state) {
    try {
        const response = await fetch('/api/inventory/sales/current-firm', {
            method:      'GET',
            credentials: 'same-origin',
            headers:     { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success && data.data?.name) {
            state.currentFirmName      = data.data.name;
            window.currentUserFirmName = data.data.name;

            // FIX: also populate firmLocations from the same response
            // (current-firm API already returns the full firm object including locations[])
            if (Array.isArray(data.data.locations)) {
                state.firmLocations = data.data.locations;
                state.activeFirmLocation =
                    data.data.locations.find(l => l.is_default) ||
                    data.data.locations[0] ||
                    null;
            }
        } else if (!data.success) {
            throw new Error(data.error || 'Failed to fetch firm name');
        }
    } catch (error) {
        console.warn('Could not fetch firm name:', error.message);
        state.currentFirmName = 'Your Company Name';
    }
}

export async function fetchNextBillNumber(state) {
    try {
        const response = await fetch('/api/inventory/sales/next-bill-number', {
            method:      'GET',
            credentials: 'same-origin',
            headers:     { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success && data.nextBillNumber) {
            state.meta.billNo = data.nextBillNumber;
        } else if (!data.success) {
            throw new Error(data.error || 'Failed to fetch bill number');
        } else {
            state.meta.billNo = 'Will be generated on save';
        }
    } catch (error) {
        console.warn('Could not fetch bill number:', error.message);
        state.meta.billNo = 'Will be generated on save';
    }
}

export async function loadExistingBillData(state, billId) {
    try {
        const response = await fetch(`/api/inventory/sales/bills/${billId}`, {
            method:      'GET',
            credentials: 'same-origin',
            headers:     { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const billData = await response.json();
        if (!billData.success) throw new Error(billData.error || 'Failed to load bill data');

        const bill = billData.data;
        state.currentBill = bill; // Store full bill for reference (e.g. return mode)

        state.meta = {
            billNo:          bill.bno,
            billDate:        bill.bdate,
            billType:        bill.bill_subtype ? bill.bill_subtype.toLowerCase() : ((bill.cgst || bill.sgst) ? 'intra-state' : 'inter-state'),
            reverseCharge:   Boolean(bill.reverse_charge),
            referenceNo:     bill.order_no         || '',
            vehicleNo:       bill.vehicle_no       || '',
            dispatchThrough: bill.dispatch_through || '',
            narration:       bill.narration        || '',
        };

        if (bill.party_id) {
            state.selectedParty = {
                id:         bill.party_id,
                firm:       bill.supply     || '',
                gstin:      bill.gstin      || '',
                state:      bill.state      || '',
                addr:       bill.addr       || '',
                pin:        bill.pin        || null,
                state_code: bill.state_code || null,
            };
            // FIX BUG #2: Restore the selected GSTIN so it's sent to server on save
            state.selectedPartyGstin = bill.gstin;
            // FIX: Restore the selected location object with all location-specific data
            state.selectedPartyLocation = {
                gstin: bill.gstin,
                state: bill.state,
                state_code: bill.state_code,
                address: bill.addr,
                pincode: bill.pin,
                contact: bill.contact || '',
                is_primary: true
            };
        }

        // FIX: Restore the active firm location that was used when this bill was saved.
        // bill.firm_gstin stores exactly which GSTIN was active — match it back into
        // firmLocations so the header dropdown reflects the correct selection.
        if (bill.firm_gstin && state.firmLocations.length > 0) {
            const match = state.firmLocations.find(l => l.gst_number === bill.firm_gstin);
            if (match) state.activeFirmLocation = match;
        }

        if (bill.consignee_name || bill.consignee_address) {
            state.selectedConsignee = {
                name:                 bill.consignee_name    || '',
                address:              bill.consignee_address || '',
                gstin:                bill.consignee_gstin   || '',
                state:                bill.consignee_state   || '',
                pin:                  bill.consignee_pin     || '',
                contact:              '',
                deliveryInstructions: '',
            };
            state.consigneeSameAsBillTo = false;
        } else {
            state.consigneeSameAsBillTo = true;
        }

        state.cart = (bill.items || []).map(item => {
            const itemType = item.item_type || (item.stock_id ? 'GOODS' : 'SERVICE');
            const parsedQty = parseFloat(item.qty);
            return {
                stockId:   item.stock_id,
                itemType,
                item:      item.item,
                narration: item.item_narration || '',
                batch:     item.batch          || null,
                oem:       item.oem            || '',
                hsn:       item.hsn,
                qty:       Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : (itemType === 'SERVICE' ? 1 : 0),
                showQty:   item.show_qty !== false,
                uom:       item.uom || (item.stock_id ? 'PCS' : ''),
                rate:      parseFloat(item.rate)  || 0,
                grate:     parseFloat(item.grate) || 0,
                disc:      parseFloat(item.disc)  || 0,
            };
        });

        state.otherCharges = (bill.otherCharges || []).map(charge => ({
            name:    charge.name   || charge.type || 'Other Charge',
            type:    charge.type   || 'other',
            hsnSac:  charge.hsnSac || '',
            amount:  parseFloat(charge.amount)  || 0,
            gstRate: parseFloat(charge.gstRate) || 0,
        }));

        state.historyCache = {};
        return true;

    } catch (error) {
        console.error('Error loading bill data:', error);
        throw error;
    }
}

export async function fetchData(state) {
    try {
        // Stocks
        const stockResponse = await fetch('/api/inventory/sales/stocks', {
            method: 'GET', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!stockResponse.ok) {
            console.warn('Failed to fetch stocks:', stockResponse.status);
            state.stocks = [];
        } else {
            const stockData = await stockResponse.json();
            state.stocks = stockData.success && Array.isArray(stockData.data) ? stockData.data : [];
        }

        // Parties
        try {
            const partyResponse = await fetch('/api/inventory/sales/parties', {
                method: 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!partyResponse.ok) {
                console.warn('Failed to fetch parties:', partyResponse.status);
                state.parties = [];
            } else {
                const partyData = await partyResponse.json();
                state.parties = partyData.success && Array.isArray(partyData.data) ? partyData.data : [];
            }
        } catch (e) {
            console.warn('Could not fetch parties:', e.message);
            state.parties = [];
        }

        // Bill number preview (non-incrementing)
        if (!state.meta.billNo || state.meta.billNo === 'Will be generated on save') {
            state.meta.billNo = 'Will be generated on save';
            try {
                const previewResponse = await fetch('/api/inventory/sales/next-bill-number', {
                    method: 'GET', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (previewResponse.ok) {
                    const data = await previewResponse.json();
                    if (data.success && data.nextBillNumber) state.meta.billNo = data.nextBillNumber;
                }
            } catch (e) {
                console.warn('Could not fetch bill number preview:', e.message);
            }
        }

        // GST status
        try {
            const gstResponse = await fetch('/api/settings/system-config/gst-status', {
                method: 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!gstResponse.ok) {
                console.warn('Failed to fetch GST status:', gstResponse.status);
                state.gstEnabled = true;
            } else {
                const gstData = await gstResponse.json();
                state.gstEnabled = gstData.success ? (gstData.data?.gst_enabled !== false) : true;
            }
        } catch (e) {
            console.warn('Could not fetch GST status:', e.message);
            state.gstEnabled = true;
        }

        // FIX: Firm locations — if fetchCurrentUserFirmName hasn't run yet (or
        // returned before locations were available), populate them now.
        // This is a safety net; the primary path is fetchCurrentUserFirmName().
        if (state.firmLocations.length === 0) {
            try {
                const firmRes = await fetch('/api/inventory/sales/current-firm', {
                    method: 'GET', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (firmRes.ok) {
                    const fd = await firmRes.json();
                    if (fd.success && Array.isArray(fd.data?.locations)) {
                        state.firmLocations = fd.data.locations;
                        if (!state.activeFirmLocation) {
                            state.activeFirmLocation =
                                fd.data.locations.find(l => l.is_default) ||
                                fd.data.locations[0] ||
                                null;
                        }
                    }
                }
            } catch (e) {
                console.warn('Could not fetch firm locations:', e.message);
            }
        }

        return true;
    } catch (err) {
        console.error('Failed to load data:', err);
        throw err;
    }
}

/**
 * Determine the correct GST bill type by comparing firm location state code
 * against the party's state code (both derived from GSTIN[0:2]).
 *
 * Returns 'intra-state' | 'inter-state' | null (null = cannot determine).
 *
 * GST law rule: Section 8 IGST Act
 *   - Supplier state == recipient state → CGST + SGST (intra-state)
 *   - Supplier state != recipient state → IGST (inter-state)
 */
export function determineGstBillType(activeFirmLocation, selectedParty, selectedPartyLocation) {
    const firmCode  = activeFirmLocation?.state_code ||
                      activeFirmLocation?.gst_number?.substring(0, 2);

    // FIX: Use selected location state code if available, otherwise fall back to primary party state code
    // Priority 1: selected location state_code (for multi-GSTIN parties)
    // Priority 2: explicit state_code stored on party document
    // Priority 3: first 2 digits of GSTIN (registered parties)
    // Priority 4: state name → code lookup (unregistered parties whose state was entered)
    const partyCode = selectedPartyLocation?.state_code ||
                      selectedParty?.state_code ||
                      (selectedPartyLocation?.gstin && selectedPartyLocation.gstin !== 'UNREGISTERED'
                          ? selectedPartyLocation.gstin.substring(0, 2)
                          : null) ||
                      (selectedParty?.gstin && selectedParty.gstin !== 'UNREGISTERED'
                          ? selectedParty.gstin.substring(0, 2)
                          : null) ||
                      (selectedPartyLocation?.state
                          ? INDIA_STATE_CODES[selectedPartyLocation.state.trim().toLowerCase()] ?? null
                          : null) ||
                      (selectedParty?.state
                          ? INDIA_STATE_CODES[selectedParty.state.trim().toLowerCase()] ?? null
                          : null);

    if (!firmCode || !partyCode) return null;
    return firmCode === partyCode ? 'intra-state' : 'inter-state';
}
