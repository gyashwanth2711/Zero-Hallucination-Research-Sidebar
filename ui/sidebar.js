chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "VERIFY_TEXT" || message.type === "EVALUATE_PROMPT") {
        const isEval = message.type === "EVALUATE_PROMPT";
        const endpoint = isEval ? "/evaluate" : "/verify";
        const statusPrefix = isEval ? "Evaluating Prompt: " : "Verifying: ";
        
        document.getElementById('status').innerText = statusPrefix + message.text.substring(0, 50) + "...";
        document.getElementById('loader').classList.remove('hidden');
        document.getElementById('app-root').innerHTML = "";

        // Call the local server to run the pipeline
        fetch("http://127.0.0.1:8001" + endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message.text })
        })
        .then(response => response.json())
        .then(uiJson => {
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('status').innerText = (isEval ? "Evaluation" : "Verification") + " complete.";
            renderPrefabUI(uiJson, document.getElementById('app-root'));
        })
        .catch(err => {
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('status').innerText = "Error connecting to server. Is it running on port 8001?";
            console.error(err);
        });
    }
});

function renderPrefabUI(node, container) {
    if (!node) return;
    
    // If we're at the root of a PrefabApp response, render its view instead
    if (node.$prefab && node.view) {
        renderPrefabUI(node.view, container);
        return;
    }

    if (typeof node === "string") {
        container.appendChild(document.createTextNode(node));
        return;
    }

    const el = document.createElement("div");
    
    // Apply basic mapping for our Prefab types to CSS classes
    const classMap = {
        "PrefabApp": "prefab-app",
        "Card": "card",
        "CardHeader": "card-header",
        "CardTitle": "card-title",
        "CardContent": "card-content",
        "Column": "column",
        "H3": "h3",
        "Text": "text",
        "Badge": "badge",
        "Code": "code",
        "Muted": "muted"
    };

    const componentType = node.component || node.type;
    if (classMap[componentType]) {
        el.className = classMap[componentType];
    }

    if (node.cssClass) el.className += " " + node.cssClass;
    if (node.props) {
        if (node.props.css_class) el.className += " " + node.props.css_class;
        if (node.props.text) el.innerText = node.props.text;
        if (node.props.gap) el.style.gap = (node.props.gap * 0.25) + "rem";
    }
    
    if (node.content) el.innerText = node.content;

    if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => renderPrefabUI(child, el));
    }

    container.appendChild(el);
}
