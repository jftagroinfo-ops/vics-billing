/* --- PRICE LIST & CRM PIPELINE MODULE --- */

function calculateQuote() {
    const base = parseFloat(document.getElementById('quote-base-inr').value) || 0;
    const rate = parseFloat(document.getElementById('quote-rate').value) || 1;
    const curr = document.getElementById('quote-currency').value;
    const comm = document.getElementById('quote-comm').value;
    
    let finalPrice = 0;
    if(curr === 'USD' || curr === 'EUR' || curr === 'GBP') {
        finalPrice = (base / rate).toFixed(2);
    } else {
        finalPrice = base.toFixed(2); 
    }

    const commEl = document.getElementById('qc-comm');
    if(commEl) commEl.innerText = comm || "Product Name";
    
    const priceEl = document.getElementById('qc-price');
    if(priceEl) priceEl.innerText = finalPrice;
    
    const currEl = document.getElementById('qc-curr');
    // SECURED: Basic sanitization of DOM input to prevent layout breaking
    if(currEl) currEl.innerText = curr.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
    
    const dateEl = document.getElementById('qc-date');
    if(dateEl && typeof formatDateIN === 'function') dateEl.innerText = formatDateIN(new Date());
}

async function fetchLiveRate() {
    const currRaw = document.getElementById('quote-currency').value;
    // SECURED: Validate currency code to prevent API injection/SSRF vectors
    const curr = currRaw.replace(/[^A-Z]/g, '').substring(0, 3);
    
    const btn = document.getElementById('btn-fetch-rate');
    const rateInput = document.getElementById('quote-rate');
    
    if(curr === 'INR' || !curr) {
        rateInput.value = 1;
        calculateQuote();
        return;
    }

    const originalText = btn ? btn.innerText : 'Fetch Live Rate';

    try {
        if (btn) {
            btn.innerText = "⏳ Fetching...";
            btn.disabled = true;
        }

        const response = await fetch(`https://open.er-api.com/v6/latest/${curr}`);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const data = await response.json();
        
        if (data && data.rates && data.rates.INR) {
            const liveRate = data.rates.INR;
            rateInput.value = liveRate.toFixed(2);
            if(typeof Enterprise !== 'undefined') {
                Enterprise.notify(`✅ Live Rate Fetched: 1 ${curr} = ₹${liveRate.toFixed(2)}`, "success");
            }
            calculateQuote(); 
        } else {
            throw new Error("Invalid data structure");
        }
    } catch (error) {
        console.error("Error fetching live rate:", error);
        if(typeof Enterprise !== 'undefined') {
            Enterprise.notify("⚠️ Failed to fetch live rate. Please enter manually.", "danger");
        }
    } finally {
        if (btn) {
            btn.innerText = "🔄 Fetch Live Rate";
            btn.disabled = false;
        }
    }
}

function convertQuoteToProforma() {
    const comm = document.getElementById('qc-comm').innerText;
    const price = document.getElementById('qc-price').innerText;
    const curr = document.getElementById('qc-curr').innerText;

    // SECURED: Restrict action. External B2B Portal Buyers shouldn't create internal docs.
    if (sessionStorage.getItem('jft_role') === 'buyer') {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Access Denied: Action restricted.", "danger");
        return;
    }

    if (price === "0.00" || !price) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Calculate a valid quote first!", "warning");
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
                if(typeof addItemRow === 'function') {
                    addItemRow({ desc: comm, qty: 1, unit: 'MT', rate: parseFloat(price) });
                }
                if(typeof calcDocTotals === 'function') calcDocTotals();
            }
            if(typeof Enterprise !== 'undefined') Enterprise.notify("🚀 Quote transferred to Proforma!", "success");
        }, 300);
    }
}

function shareQuoteWhatsApp() {
    const comm = document.getElementById('qc-comm').innerText;
    const price = document.getElementById('qc-price').innerText;
    const curr = document.getElementById('qc-curr').innerText;

    if (price === "0.00" || !price) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Calculate a valid quote first!", "warning");
        return;
    }

    const text = `*JFT AGRO OVERSEAS*\n\n*Commodity:* ${comm}\n*Price:* ${curr} ${price} / MT\n\n_System Generated Quote_`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
}

function generateQuoteImage() {
    const card = document.getElementById('quote-card-element');
    if(!card) return;
    
    if(typeof html2canvas === 'undefined') {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("⚠️ Error: html2canvas library not loaded.", "danger");
        return;
    }

    html2canvas(card, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        const commName = document.getElementById('qc-comm').innerText || 'Quote';
        
        // SECURED: Prevent path traversal or illegal characters in filename
        const safeFilename = commName.replace(/[\/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
        
        link.download = `JFT_Quote_${safeFilename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        if(typeof Enterprise !== 'undefined') {
            Enterprise.notify("📸 Quote Image Downloaded Successfully!", "success");
        }
    });
}

