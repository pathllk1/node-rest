/**
 * TOAST NOTIFICATION UTILITY
 */

export function showToast(message, type = 'success') {
    const bgColor = type === 'error'   ? '#ef4444'
                  : type === 'warning' ? '#f59e0b'
                  : '#10b981';
    window.Toastify({
        text:            message,
        backgroundColor: bgColor,
        duration:        3000,
        gravity:         'top',
        position:        'right',
        close:           true,
    }).showToast();
}