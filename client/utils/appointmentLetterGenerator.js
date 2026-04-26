/**
 * APPOINTMENT LETTER GENERATOR - Server-side .docx generation
 * Generates professional appointment letters in .docx format
 * 
 * Server-side implementation:
 * - Avoids CSP restrictions (no external CDN required)
 * - Uses npm docx package on backend
 * - A4 single-page format with proper margins
 * - Indian business standards
 * - Police verification requirement (6 months mandatory)
 * - All statutory information included
 */

import { fetchWithCSRF } from './api.js';

/**
 * Download appointment letter for an employee
 * Calls server endpoint to generate .docx file
 * 
 * @param {string} employeeId - Master Roll ID
 * @param {string} employeeName - Employee name (for filename)
 * @returns {Promise<void>}
 */
export async function downloadAppointmentLetter(employeeId, employeeName) {
  try {
    if (!employeeId) {
      throw new Error('Employee ID is required');
    }

    const response = await fetchWithCSRF(
      `/api/master-rolls/${employeeId}/appointment-letter`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: `Server error: ${response.status} ${response.statusText}`
      }));
      throw new Error(error.error || `Server error: ${response.status}`);
    }

    // Get filename from response headers or use default
    const contentDisposition = response.headers.get('content-disposition');
    let filename = 'Appointment_Letter.docx';
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    } else if (employeeName) {
      filename = `Appointment_Letter_${employeeName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
    }

    // Convert response to blob
    const blob = await response.blob();
    
    // Verify we got a valid .docx file
    const expectedMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (blob.type !== expectedMimeType) {
      console.warn(`Expected MIME type ${expectedMimeType}, got ${blob.type}`);
    }

    // Size validation (should be > 5KB for valid .docx)
    if (blob.size < 5000) {
      throw new Error(`Invalid document: file too small (${blob.size} bytes)`);
    }

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    // Show success toast
    if (window.Toastify) {
      window.Toastify({
        text: `✅ Appointment letter downloaded successfully!`,
        className: 'bg-green-500 text-white',
        duration: 3000,
        gravity: 'top',
        position: 'right'
      }).showToast();
    }

  } catch (error) {
    console.error('❌ [APPOINTMENT LETTER]', error.message, error);
    
    // Show error toast
    if (window.Toastify) {
      window.Toastify({
        text: `❌ Error: ${error.message}`,
        className: 'bg-red-500 text-white',
        duration: 4000,
        gravity: 'top',
        position: 'right'
      }).showToast();
    } else {
      alert(`Error generating appointment letter: ${error.message}`);
    }
    
    throw error;
  }
}
