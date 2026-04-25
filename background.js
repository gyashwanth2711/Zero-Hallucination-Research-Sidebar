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

    if (apiKey === 'MOCK_TEST_KEY') {
        const fullThoughtProcess = "Thinking Process Turn 1:\n- Initiating Google Search for recent news regarding the claim.\n- Found matching 2026 news reports indicating X.\n- Initiating Semantic Scholar search to find related scientific papers.\n\nThinking Process Turn 2:\n- Cross-referencing web news against academic findings.\n- The papers suggest Y, contradicting the web news on a minor point.\n- Determining truth scope and verifying evidence.";
        const searchHtml = "<div style='font-size: 11px;'><p><strong>Mock Search:</strong> COVID-19 2026 updates...</p><p><strong>Mock Source:</strong> ArXiv: Quantum properties mapping.</p></div>";
        const finalOutput = "# Truth Score: 85%\n\nBased on cross-referencing real-time Google News and Academic data from Semantic Scholar:\n\n1. **Web News**: Reports suggest new developments in 2026.\n2. **Academic Data**: Semantic Scholar paper 'Analysis of claim' supports this largely but notes exceptions.\n\n**Verdict**: The claim is largely true.\n\n***\n### Grounding Sources:\n[1] [News Article](https://example.com)\n[2] [Semantic Scholar Paper](https://semanticscholar.org/mock-paper)";
        
        // Simulate network delay
        await new Promise(r => setTimeout(r, 2000));
        
        return { text: finalOutput, searchHtml, thoughtProcess: fullThoughtProcess };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // --- PHASE 1: Google Search for Web News ---
    const phase1Tools = [ { googleSearch: {} } ];
    
    // We ask the model in Phase 1 to get news and output an academic search query.
    const phase1Contents = [{
        role: "user",
        parts: [{ text: `Search for real-time news/web data via Google to understand this claim: "${claimText}". Summarize the news findings. Then, at the very end, provide explicit keywords to search an academic database inside <query>...</query> tags.` }]
    }];

    let searchHtml = "";
    let finalGroundingSources = "";
    let webNewsSummary = "";

    const phase1Response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: phase1Contents, tools: phase1Tools })
    });

    if (!phase1Response.ok) {
        const errObj = await phase1Response.json().catch(() => ({}));
        throw new Error(errObj.error?.message || `API Error Phase 1: ${phase1Response.status}`);
    }

    const phase1Json = await phase1Response.json();
    if (!phase1Json.candidates || phase1Json.candidates.length === 0) {
        throw new Error("No response generated from Phase 1 web search.");
    }

    const phase1Candidate = phase1Json.candidates[0];
    
    // Log and Extract Grounding Metadata
    const metadata = phase1Candidate.groundingMetadata;
    if (metadata) {
        if (metadata.searchEntryPoint && metadata.searchEntryPoint.renderedContent) {
            console.log("[Grounding Metadata] Search Entry Point present.");
            searchHtml = metadata.searchEntryPoint.renderedContent;
        }
        if (metadata.groundingChunks && metadata.groundingChunks.length > 0) {
            console.log("[Grounding Metadata] Citations (Chunks):", metadata.groundingChunks.length);
            let sourcesText = "\n\n***\n### Grounding Sources:\n";
            metadata.groundingChunks.forEach((chunk, index) => {
                if (chunk.web && chunk.web.uri) {
                    sourcesText += `[${index + 1}] [${chunk.web.title}](${chunk.web.uri})\n`;
                }
            });
            finalGroundingSources = sourcesText;
        }
    }

    if (phase1Candidate.content && phase1Candidate.content.parts) {
        webNewsSummary = phase1Candidate.content.parts.map(p => p.text).join("");
    }

    // Extract query from <query>...</query>. If not found, fallback to the claim text itself.
    let academicQuery = claimText;
    const queryMatch = webNewsSummary.match(/<query>(.*?)<\/query>/);
    if (queryMatch && queryMatch[1]) {
        academicQuery = queryMatch[1].trim();
        webNewsSummary = webNewsSummary.replace(queryMatch[0], ""); // Clean it from the text visually
    }

    console.log(`[Action] Calling Academic Literature with query: ${academicQuery}`);
    
    // --- PHASE 2: Fetch Semantic Scholar ---
    let academicDataText = "No academic papers found.";
    try {
        const semanticUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(academicQuery)}&limit=3&fields=title,abstract,authors,year`;
        const paperReq = await fetch(semanticUrl);
        if (paperReq.ok) {
            const paperJson = await paperReq.json();
            if (paperJson.data && paperJson.data.length > 0) {
                academicDataText = JSON.stringify(paperJson.data, null, 2);
            }
        }
    } catch (e) {
        console.error("Semantic Scholar Error:", e);
        academicDataText = `Error fetching academic data: ${e.message}`;
    }

    // --- PHASE 3: Thinking Phase & Final Output ---
    // Do NOT include googleSearch tools here so it doesn't conflict or overwrite. Enable thinking budget.
    const phase3GenerationConfig = {
        thinkingConfig: {
            thinkingBudget: 4096
        }
    };

    const phase3SystemInstruction = {
        parts: [{ text: "You are a research assistant. Analyze the contradictions or agreements between the provided Google Web News summary and Academic Papers context. First, use your thinking budget to reconcile these details. Then, provide a 'Truth Score' (e.g. 0-100%) near the beginning. Include evidence or debunking information. Always format output in Markdown." }]
    };

    const phase3Contents = [{
        role: "user",
        parts: [{ text: `Verify the claim: "${claimText}"\n\n### Google Web News Summary:\n${webNewsSummary}\n\n### Semantic Scholar Academic Context:\n${academicDataText}` }]
    }];

    let fullThoughtProcess = "[Phase 1] Searched Google Web Data.\n[Phase 2] Found Academic papers for: " + academicQuery + "\n\n[Phase 3 Thinking]:\n";

    const phase3Response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: phase3Contents,
            systemInstruction: phase3SystemInstruction,
            generationConfig: phase3GenerationConfig
        })
    });

    if (!phase3Response.ok) {
        const errObj = await phase3Response.json().catch(() => ({}));
        throw new Error(errObj.error?.message || `API Error Phase 3: ${phase3Response.status}`);
    }

    const phase3Json = await phase3Response.json();
    if (!phase3Json.candidates || phase3Json.candidates.length === 0) {
        throw new Error("No final response generated from Gemini.");
    }

    const phase3Candidate = phase3Json.candidates[0];
    let responseText = "";

    if (phase3Candidate.content && phase3Candidate.content.parts) {
        for (const part of phase3Candidate.content.parts) {
            if ('thought' in part || part.thought === true) {
                const thoughtText = part.text || part.thought; 
                console.log(`[Thinking Process]`, thoughtText);
                fullThoughtProcess += thoughtText + "\n\n";
            } else if (part.text) {
                responseText += part.text;
            }
        }
    }

    if (finalGroundingSources) {
        responseText += finalGroundingSources;
    }
    
    // Save backend console logs to a local file
    try {
        const logContent = `[Backend Log - ${new Date().toISOString()}]\nClaim: ${claimText}\n\nSearch Query: ${academicQuery}\n\nPhase 1 HTML: ${searchHtml}\n\nGrounding Sources: ${finalGroundingSources}\n\nThinking Process:\n${fullThoughtProcess}\n\nFinal Text:\n${responseText}\n`;
        const blobUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(logContent);
        chrome.downloads.download({
            url: blobUrl,
            filename: `truth_engine_logs/log_${Date.now()}.txt`,
            saveAs: false
        });
    } catch (e) {
        console.error("Failed to save log:", e);
    }

    return { text: responseText, searchHtml, thoughtProcess: fullThoughtProcess.trim() };
}
