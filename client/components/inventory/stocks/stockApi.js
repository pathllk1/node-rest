/**
 * STOCK API MODULE
 * Handles all API calls for stock management
 */

import { fetchWithCSRF } from '../../../utils/api.js';

const API_BASE = '/api/inventory/sales';

export async function fetchStocks() {
    try {
        const response = await fetchWithCSRF(`${API_BASE}/stocks`, {
            method: 'GET'
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (result.success) {
            return Array.isArray(result.data) ? result.data : [];
        } else {
            throw new Error(result.error || 'Failed to fetch stocks');
        }
    } catch (error) {
        console.error('Error fetching stocks:', error);
        throw error;
    }
}

export async function createStock(stockData) {
    try {
        const response = await fetchWithCSRF(`${API_BASE}/stocks`, {
            method: 'POST',
            body: JSON.stringify(stockData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating stock:', error);
        throw error;
    }
}

export async function updateStock(stockId, stockData) {
    try {
        const response = await fetchWithCSRF(`${API_BASE}/stocks/${stockId}`, {
            method: 'PUT',
            body: JSON.stringify(stockData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
}

export async function deleteStock(stockId) {
    try {
        const response = await fetchWithCSRF(`${API_BASE}/stocks/${stockId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
}

export async function getStockMovements(stockId) {
    try {
        const response = await fetch(`${API_BASE}/stock-movements/${stockId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result.data || [];
    } catch (error) {
        throw error;
    }
}
