chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "evaluate-prompt",
    title: "Evaluate Prompt with AI",
    contexts: ["selection"]
  });
  // Keep the old one too if needed, or replace it. Let's keep both.
  chrome.contextMenus.create({
    id: "verify-text",
    title: "Verify Selection in Research Sidebar",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "verify-text" || info.menuItemId === "evaluate-prompt") {
    // Open the side panel first
    chrome.sidePanel.open({ windowId: tab.windowId });
    
    // Wait a bit to ensure the side panel is open, then send the message
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: info.menuItemId === "evaluate-prompt" ? "EVALUATE_PROMPT" : "VERIFY_TEXT",
        text: info.selectionText
      });
    }, 500);
  }
});
