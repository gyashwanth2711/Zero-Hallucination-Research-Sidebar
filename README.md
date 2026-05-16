# Zero-Hallucination Research Sidebar & Prompt Evaluator

A Chrome Extension powered by a Python-based MCP (Model Context Protocol) Server and the Gemini API. It helps you verify claims, fact-check information, and combat hallucinations directly from your browser sidebar. It also features a new **Prompt Evaluator** tool that analyzes LLM prompts against 9 structured reasoning criteria.

## 🎥 Demonstration
- [Prompt Evaluator Feature Demonstration on YouTube ](https://youtu.be/8Zac6WLFauo)
- [Zero-Hallucination Research: Integrating MCP Servers, CRUD, and Prefab UI](https://youtu.be/lawXa3gSkR0)
- [Zero Hallucination Sidebar with LLM thinking process output Demonstration on Youtube](https://youtu.be/f5Vc3ob0-Vo)
- [Zero Hallucination Sidebar Demonstration on Youtube](https://youtu.be/HFRf8OeA2dM)

## ✨ Features

- **Prompt Evaluator (NEW!):** Highlight a prompt written by a student and evaluate how well it supports structured, step-by-step reasoning. Output is generated as a structured JSON assessment, qualifying criteria such as:
  - Explicit Reasoning Instructions
  - Structured Output Format
  - Separation of Reasoning and Tools
  - Conversation Loop Support
  - Instructional Framing
  - Internal Self-Checks
  - Reasoning Type Awareness
  - Error Handling or Fallbacks
  - Overall Clarity and Robustness
- **Seamless Fact-Checking:** Highlight any text on a webpage and use the context menu to verify it.
- **Python MCP Server Backend:** Uses a local FastAPI and FastMCP server to run research and evaluations, rendering UI components seamlessly to the Chrome Side Panel.
- **AI-Powered Analysis:** Uses Google's Gemini 2.5 Flash model with Tavily Academic search integration.

## 🚀 Installation

1. Clone or download this repository to your local machine.
2. Install Python dependencies: `pip install -r requirements.txt` (Make sure you have FastAPI, Uvicorn, FastMCP, Google GenAI, and Prefab installed).
3. Add your API keys to a `.env` file in the `server` directory (`GEMINI_API_KEY`, `TAVILY_API_KEY`).
4. Run the backend server: `python server/server.py`
5. Open Google Chrome and navigate to `chrome://extensions/`.
6. Enable **Developer mode** using the toggle in the top right corner.
7. Click on **Load unpacked** and select the folder containing this extension.
8. Open the Side Panel (click the extension icon or the side panel icon in the Chrome toolbar).

## 💡 Usage

### Fact-Checking
1. Browse the web as normal.
2. Highlight a controversial claim, a statistic, or any statement you want to double-check.
3. Right-click and select **"Verify Selection in Research Sidebar"**.
4. Watch the side panel process the request and display the verified fact-check with linked sources!

### Prompt Evaluator
1. Highlight an LLM prompt.
2. Right-click and select **"Evaluate Prompt with AI"**.
3. The MCP server will analyze the prompt based on the structured reasoning criteria and display a JSON-based output card in the side panel.

## 🛠️ Built With

- Manifest V3 Chrome Extension API
- Vanilla JavaScript & HTML/CSS
- Python FastAPI & FastMCP
- Prefab UI Components
- [Gemini API](https://ai.google.dev/) (gemini-2.5-flash)
- [Tavily API](https://tavily.com/)
- Tailwind CSS
