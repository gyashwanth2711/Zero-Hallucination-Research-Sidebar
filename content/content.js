let verifyBtn = null;

document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length > 0) {
        // Wait a small amount of time to allow user to finish selecting
        setTimeout(() => {
            if (verifyBtn && verifyBtn.parentNode) return;
            const newSelection = window.getSelection();
            if (newSelection.toString().trim() === text) {
               showVerifyButton(newSelection, text);
            }
        }, 300);
    } else {
        removeVerifyButton();
    }
});

document.addEventListener('mousedown', (e) => {
    // If clicking outside the button, remove it
    if (verifyBtn && !verifyBtn.contains(e.target)) {
        removeVerifyButton();
    }
});

function showVerifyButton(selection, text) {
    removeVerifyButton();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    verifyBtn = document.createElement('button');
    verifyBtn.id = 'zero-hallucination-verify-btn';
    verifyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        Verify Claim
    `;
    
    verifyBtn.style.top = `${window.scrollY + rect.top - 40}px`;
    verifyBtn.style.left = `${window.scrollX + rect.left + (rect.width / 2) - 50}px`;
    
    verifyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        verifyBtn.innerHTML = 'Verifying...';
        verifyBtn.disabled = true;
        
        try {
            chrome.runtime.sendMessage({ action: 'VERIFY_CLAIM', claim: text }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Extension communication error. Make sure the side panel is open.");
                    verifyBtn.innerHTML = "Open Side Panel first!";
                    setTimeout(removeVerifyButton, 2000);
                } else {
                    setTimeout(removeVerifyButton, 1000);
                }
            });
        } catch (err) {
            console.error('Zero-Hallucination Extension error:', err);
        }
    });

    document.body.appendChild(verifyBtn);
}

function removeVerifyButton() {
    if (verifyBtn && verifyBtn.parentNode) {
        verifyBtn.parentNode.removeChild(verifyBtn);
        verifyBtn = null;
    }
}
