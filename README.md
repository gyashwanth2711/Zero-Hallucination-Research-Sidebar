# Zero-Hallucination Research Sidebar

A Chrome Extension powered by the Gemini API that helps you verify claims, fact-check information, and combat hallucinations directly from your browser sidebar. It leverages **Gemini 2.5 Flash** with **Google Search Grounding** to provide real-time evidence, sources, and a Truth Score for any text you highlight on the web.

## 🎥 Demonstration
[Zero Hallucination Sidebar with LLM thinking process output Demonstration on Youtube](https://youtu.be/f5Vc3ob0-Vo)
[Zero Hallucination Sidebar Demonstration on Youtube](https://youtu.be/HFRf8OeA2dM)

## ✨ Features

- **Seamless Fact-Checking:** Simply highlight any text on a webpage to reveal a floating "Verify Claim" button.
- **Side Panel Integration:** One click opens the Chrome Side Panel displaying the research results without leaving your current tab.
- **AI-Powered Analysis:** Uses Google's Gemini 2.5 Flash model with built-in search grounding.
- **Truth Score & Evidence:** Provides a clear assessment of veracity along with direct links to sources.
- **Markdown Formatting:** Results are beautifully formatted in Markdown for easy reading.

## 🚀 Installation

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click on **Load unpacked** and select the folder containing this extension (`zero-hallucination-sidebar`).
5. Open the Side Panel (click the extension icon or the side panel icon in the Chrome toolbar toolbar).
6. In the extension's side panel settings, enter your **Gemini API Key**. Get one from [Google AI Studio](https://aistudio.google.com/).

## 💡 Usage

1. Browse the web as normal.
2. Highlight a controversial claim, a statistic, or any statement you want to double-check.
3. Click the **"Verify Claim"** button that pops up near the highlighted text.
4. Watch the side panel process the request and display the verified fact-check with linked sources!

## 🛠️ Built With

- Manifest V3 Chrome Extension API
- Vanilla JavaScript & HTML/CSS
- [Gemini API](https://ai.google.dev/) (gemini-2.5-flash with Google Search tool enabled for grounding)
- Tailwind CSS
