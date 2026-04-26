/**
 * PARTY MANAGEMENT MODULE
 * Handles party selection, creation, and GST lookup
 */

import { fetchWithCSRF } from '../../../utils/api.js';
import { showToast }     from './toast.js';

export function formatPowerfulGSTINAddress(partyData) {
    if (!partyData?.place_of_business_principal) return '';
    const addr = partyData.place_of_business_principal.address;
    if (!addr) return '';
    return [addr.door_num, addr.building_name, addr.floor_num,
            addr.street, addr.location, addr.city, addr.district]
        .filter(p => p && String(p).trim())
        .join(', ');
}

export function extractPowerfulGSTINPinCode(partyData) {
    if (!partyData?.place_of_business_principal) return '';
    const addr = partyData.place_of_business_principal.address;
    if (!addr?.pin_code) return '';
    const pinStr = addr.pin_code.toString().trim();
    return /^\d{6}$/.test(pinStr) ? pinStr : '';
}

export function populatePartyFromRapidAPI(partyData, gstin) {
    // FIX: Removed console.log('Processing GST Data:') — leaks internal data to console
    const displayName = partyData.trade_name || partyData.legal_name || '';
    if (!displayName) {
        // FIX: alert() → showToast
        showToast('No valid company name found in API response.', 'error');
        return;
    }

    const address   = formatPowerfulGSTINAddress(partyData) || '';
    const pinCode   = extractPowerfulGSTINPinCode(partyData) || '';
    let   stateName = partyData.place_of_business_principal?.address?.state
                   || partyData.state_jurisdiction
                   || '';
    stateName = String(stateName).trim();
    if (stateName.includes(' - ')) stateName = stateName.split(' - ')[0].trim();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('new-party-firm',  displayName);
    set('new-party-addr',  address);
    set('new-party-state', stateName);
    set('new-party-pin',   pinCode);
    if (gstin?.length >= 2)  set('new-party-state-code', gstin.substring(0, 2));
    if (gstin?.length >= 12) set('new-party-pan',         gstin.substring(2, 12));
}

export async function fetchPartyByGST(buttonElement) {
    const gstinInput = document.getElementById('new-party-gstin');
    const gstin      = gstinInput?.value?.trim();

    if (!gstin || gstin.length !== 15) {
        // FIX: alert() → showToast
        showToast('Please enter a valid 15-character GSTIN', 'error');
        return;
    }

    const originalText       = buttonElement.innerHTML;
    buttonElement.innerHTML  = '⏳';
    buttonElement.disabled   = true;

    try {
        const response = await fetchWithCSRF('/api/inventory/sales/gst-lookup', {
            method: 'POST',
            body:   JSON.stringify({ gstin }),
        });

        if (!response.ok) {
            const error = await response.json();
            showToast(error.error || `Failed (${response.status})`, 'error');
            return;
        }

        const data = await response.json();
        if (!data.success) {
            showToast(data.error || 'Failed to fetch GST details', 'error');
            return;
        }

        populatePartyFromRapidAPI(data.data || data, gstin);
        buttonElement.innerHTML = '✔';
        setTimeout(() => { buttonElement.innerHTML = originalText; }, 1500);

    } catch (error) {
        console.error('GST Lookup Error:', error);
        showToast('Failed to fetch details. ' + (error.message || 'Server error'), 'error');
        buttonElement.innerHTML = originalText;
    } finally {
        buttonElement.disabled = false;
    }
}