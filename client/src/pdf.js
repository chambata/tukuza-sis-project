import api from './api';

/**
 * Fetches a PDF from the API (with auth header) as a blob and opens it in a
 * new tab. Falls back to triggering a direct download if the popup is blocked.
 */
export async function openPdf(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const win = window.open(blobUrl, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
}
