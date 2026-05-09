/* --- PRICELIST MODULE: REDIRECTED TO COSTING → QUICK QUOTE TAB ---
 *
 * The standalone Price List / Quick Quote tool has been consolidated into
 * Costing Calc → "Quick Quote (INR → Export)" sub-tab to reduce sidebar clutter
 * and make pricing tools discoverable alongside the full costing calculator.
 *
 * This shim preserves all existing function names so any code that calls
 * calculateQuote(), fetchLiveRate(), or convertQuoteToProforma() still works.
 * All calls are delegated to the new qqCalculate() / qqFetchLiveRate() equivalents.
 *
 * If a user somehow navigates directly to the 'pricelist' tab ID, showTab() in
 * ui.js already has a redirect shim to Costing → Quick Quote. This file just
 * keeps the old function names alive for backward compatibility.
 */

window.calculateQuote = function() {
    if (typeof window.qqCalculate === 'function') window.qqCalculate();
};

window.fetchLiveRate = async function() {
    if (typeof window.qqFetchLiveRate === 'function') await window.qqFetchLiveRate();
};

window.convertQuoteToProforma = function() {
    // Pull values from the new qq- elements (Quick Quote tab in Costing)
    const comm = document.getElementById('qq-out-product')?.innerText || '';
    const price = document.getElementById('qq-out-price')?.innerText || '';
    const curr = document.getElementById('qq-out-curr')?.innerText || 'USD';

    if (sessionStorage.getItem('jft_role') === 'buyer') {
        if (typeof Enterprise !== 'undefined') Enterprise.notify("Access Denied: Action restricted.", "danger");
        return;
    }
    if (!price || price === '0.00') {
        if (typeof Enterprise !== 'undefined') Enterprise.notify("Generate a quote in Costing → Quick Quote first!", "warning");
        showTab('costing');
        setTimeout(() => { if (typeof switchCostTab === 'function') switchCostTab('quote'); }, 200);
        return;
    }
    if (typeof createNewDoc === 'function' && typeof showTab === 'function') {
        showTab('documents');
        setTimeout(() => {
            createNewDoc('Proforma Invoice');
            const currInput = document.getElementById('doc-currency');
            if (currInput) currInput.value = curr;
            const tbody = document.getElementById('items-body');
            if (tbody) {
                tbody.innerHTML = '';
                if (typeof addItemRow === 'function') addItemRow({ desc: comm, qty: 1, unit: 'MT', rate: parseFloat(price) });
                if (typeof calcDocTotals === 'function') calcDocTotals();
            }
            if (typeof Enterprise !== 'undefined') Enterprise.notify("🚀 Quote transferred to Proforma!", "success");
        }, 300);
    }
};

window.shareQuoteWhatsApp = function() {
    const comm = document.getElementById('qq-out-product')?.innerText || '';
    const price = document.getElementById('qq-out-price')?.innerText || '';
    const curr = document.getElementById('qq-out-curr')?.innerText || 'USD';
    if (!price || price === '0.00') {
        if (typeof Enterprise !== 'undefined') Enterprise.notify("Generate a quote first!", "warning");
        return;
    }
    const text = `*JFT AGRO OVERSEAS*\n\n*Commodity:* ${comm}\n*Price:* ${curr} ${price} / MT\n\n_System Generated Quote_`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
};

console.log('[Pricelist] Shim loaded — Quick Quote is now in Costing Calc → Quick Quote tab.');
