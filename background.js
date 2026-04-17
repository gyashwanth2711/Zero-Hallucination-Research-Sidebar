chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'VERIFY_CLAIM') {
        const claimText = request.claim;

        // Attempt to open side panel
        if (sender.tab && sender.tab.windowId) {
            chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch(() => {
                // Might fail if not directly triggered by user action, silently ignore
            });
        }

        // Give side panel a tiny bit of time to initialize just in case it just opened
        setTimeout(() => {
            chrome.runtime.sendMessage({ action: 'VERIFICATION_STARTED', claim: claimText }).catch(() => { });

            verifyClaimWithGemini(claimText).then(result => {
                chrome.runtime.sendMessage({ action: 'VERIFICATION_SUCCESS', result });
            }).catch(error => {
                chrome.runtime.sendMessage({ action: 'VERIFICATION_ERROR', error: error.message });
            });
        }, 500);

        sendResponse({ received: true });
        return true;
    }
});

async function verifyClaimWithGemini(claimText) {
    const data = await chrome.storage.local.get(['geminiApiKey']);
    const apiKey = data.geminiApiKey;

    if (!apiKey) {
        throw new Error("API Key missing. Please configure it in Settings.");
    }

    // Using gemini-2.0-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: `Verify the following claim explicitly checking for veracity, evidence and sources. Claim: "${claimText}"` }
                ]
            }
        ],
        systemInstruction: {
            parts: [
                { text: "You are a research assistant. Verify the provided claim accurately. Provide a 'Truth Score' (e.g. 0-100%) near the beginning. Include evidence or debunking information. If no evidence is found, state it clearly. Always format output in Markdown." }
            ]
        },
        tools: [
            // Try enabling Google Search for Grounding via Gemini API
            { googleSearch: {} }
        ]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errObj = await response.json().catch(() => ({}));
        throw new Error(errObj.error?.message || `API Error: ${response.status}`);
    }

    const json = await response.json();

    if (!json.candidates || json.candidates.length === 0) {
        throw new Error("No response generated from Gemini.");
    }

    const candidate = json.candidates[0];
    let text = candidate.content?.parts?.[0]?.text || "";
    let searchHtml = "";

    const metadata = candidate.groundingMetadata;
    if (metadata && metadata.groundingChunks) {
        const chunks = metadata.groundingChunks;
        let sourcesText = "\n\n***\n### Grounding Sources:\n";
        chunks.forEach((chunk, index) => {
            if (chunk.web && chunk.web.uri) {
                sourcesText += `[${index + 1}] [${chunk.web.title}](${chunk.web.uri})\n`;
            }
        });
        text += sourcesText;

        if (metadata.searchEntryPoint && metadata.searchEntryPoint.renderedContent) {
            searchHtml = metadata.searchEntryPoint.renderedContent;
        }
    }

    return { text, searchHtml };
}
