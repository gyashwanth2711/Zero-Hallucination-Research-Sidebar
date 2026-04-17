document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const navSettingsBtn = document.getElementById('nav-settings-btn');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    
    const settingsView = document.getElementById('settings-view');
    const mainView = document.getElementById('main-view');
    
    const apiKeyInput = document.getElementById('api-key-input');
    const toggleKeyBtn = document.getElementById('toggle-key-visibility');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const testKeyBtn = document.getElementById('test-key-btn');
    const settingsStatus = document.getElementById('settings-status');
    
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    const resultsState = document.getElementById('results-state');
    
    const claimPreview = document.getElementById('claim-preview');
    const resultClaimText = document.getElementById('result-claim-text');
    const resultMarkdown = document.getElementById('result-markdown');
    const searchSuggestions = document.getElementById('search-suggestions');

    // --- State Management ---
    // Load config from storage
    chrome.storage.local.get(['geminiApiKey'], (data) => {
        if (data.geminiApiKey) {
            apiKeyInput.value = data.geminiApiKey;
            showMainView();
        } else {
            showSettingsView();
        }
    });
    
    // Check if there was any recent response to show
    chrome.storage.session?.get(['latestVerification'], (data) => {
         if (data.latestVerification) {
             renderResult(data.latestVerification.claim, data.latestVerification.text, data.latestVerification.searchHtml);
         }
    });

    // --- Event Listeners ---
    
    navSettingsBtn.addEventListener('click', showSettingsView);
    backToMainBtn.addEventListener('click', showMainView);
    
    toggleKeyBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
        } else {
            apiKeyInput.type = 'password';
        }
    });
    
    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            chrome.storage.local.set({ geminiApiKey: key }, () => {
                showStatus('Settings saved successfully!', 'success');
                setTimeout(showMainView, 1500);
            });
        } else {
            showStatus('Please enter a valid API key.', 'error');
        }
    });
    
    testKeyBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            showStatus('Please enter an API key to test.', 'error');
            return;
        }
        
        testKeyBtn.disabled = true;
        testKeyBtn.textContent = 'Testing...';
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: "Respond with exactly 'OK'" }] }]
                })
            });
            
            if (response.ok) {
                showStatus('API Key is valid!', 'success');
            } else {
                showStatus('API Key is invalid or rate limited.', 'error');
            }
        } catch (e) {
            showStatus('Network error while testing key.', 'error');
        } finally {
            testKeyBtn.disabled = false;
            testKeyBtn.textContent = 'Test Key';
        }
    });

    // Listen to background worker messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'VERIFICATION_STARTED') {
            showMainView();
            emptyState.classList.add('hidden');
            resultsState.classList.add('hidden');
            loadingState.classList.remove('hidden');
            claimPreview.textContent = `"${request.claim}"`;
            resultClaimText.textContent = `"${request.claim}"`;
        } 
        else if (request.action === 'VERIFICATION_SUCCESS') {
            loadingState.classList.add('hidden');
            renderResult(resultClaimText.textContent, request.result.text, request.result.searchHtml);
            // Optionally persist state
            chrome.storage.session?.set({ 
                latestVerification: { claim: resultClaimText.textContent, ...request.result }
            });
        }
        else if (request.action === 'VERIFICATION_ERROR') {
            loadingState.classList.add('hidden');
            resultsState.classList.remove('hidden');
            resultMarkdown.innerHTML = `<p class="text-red-600 font-semibold">Error:</p><p class="text-red-500">${request.error}</p>`;
            searchSuggestions.innerHTML = '';
            searchSuggestions.classList.add('hidden');
        }
    });

    // --- Helper Functions ---
    
    function showSettingsView() {
        mainView.classList.add('hidden');
        settingsView.classList.remove('hidden');
        settingsStatus.classList.add('hidden');
    }
    
    function showMainView() {
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
    }
    
    function showStatus(message, type) {
        settingsStatus.textContent = message;
        settingsStatus.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
        
        if (type === 'error') {
            settingsStatus.classList.add('bg-red-100', 'text-red-700');
        } else {
            settingsStatus.classList.add('bg-green-100', 'text-green-700');
        }
    }
    
    function renderResult(claim, text, searchHtml) {
        resultsState.classList.remove('hidden');
        
        // Use marked to parse markdown
        if (window.marked) {
            resultMarkdown.innerHTML = marked.parse(text);
        } else {
            resultMarkdown.textContent = text;
        }
        
        if (searchHtml) {
            searchSuggestions.innerHTML = searchHtml;
            searchSuggestions.classList.remove('hidden');
        } else {
            searchSuggestions.innerHTML = '';
            searchSuggestions.classList.add('hidden');
        }
    }
});
