// =============================================================================
// modules/utils.js
// Pure utility functions — no side effects, no DOM, no bus.
// =============================================================================

export function escapeAttribute(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function escapeText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatNumber(n) {
    return Intl.NumberFormat().format(Number(n) || 0);
}

export function formatPoints(n) {
    n = Number(n) || 0;
    return formatNumber(n) + ' ' + (n === 1 ? 'point' : 'points');
}

export function formatDiscount(value, type, currencySymbol) {
    return type === 'percentage'
        ? formatNumber(value) + '% off'
        : (currencySymbol || '$') + formatNumber(value) + ' off';
}

export function formatDate(d) {
    return new Date(d).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function formatPointsDisplay(pts) {
    pts = Number(pts) || 0;
    if (pts > 0) return `<span class="nbl-points-positive">+${formatNumber(pts)}</span>`;
    if (pts < 0) return `<span class="nbl-points-negative">${formatNumber(pts)}</span>`;
    return `<span class="nbl-points-neutral">—</span>`;
}