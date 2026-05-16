from fastmcp import FastMCP
from prefab_ui.app import PrefabApp
from prefab_ui.components import Card, CardHeader, CardTitle, CardContent, Column, H3, Text, Muted, Badge, Code
from google import genai
import httpx
import json
import os
import threading
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

if not GEMINI_API_KEY or not TAVILY_API_KEY:
    print("Warning: GEMINI_API_KEY or TAVILY_API_KEY is missing from environment variables.")

# Create the MCP Server
mcp = FastMCP("ResearchSidebarMCP")

NOTES_FILE = os.path.join(os.path.dirname(__file__), "notes.json")

@mcp.tool()
def search_academic(query: str) -> str:
    """Fetch academic sources or general web results using the Tavily API."""
    print(f"[MCP Log] Searching Tavily for: {query}")
    if not TAVILY_API_KEY:
        return "Error: TAVILY_API_KEY is not set."
    
    resp = httpx.post(
        'https://api.tavily.com/search',
        json={"api_key": TAVILY_API_KEY, "query": query, "search_depth": "basic", "include_answer": True},
        timeout=10.0
    )
    data = resp.json()
    return data.get("answer") or json.dumps(data.get("results", [])[:3])

@mcp.tool()
def manage_local_notes(action: str, content: str = "") -> str:
    """Perform CRUD operations on a local file. Action can be 'read' or 'write'."""
    print(f"[MCP Log] CRUD local file: action={action}")
    if action == "write":
        with open(NOTES_FILE, "w") as f:
            f.write(content)
        return "Successfully wrote to notes.json"
    elif action == "read":
        if os.path.exists(NOTES_FILE):
            with open(NOTES_FILE, "r") as f:
                return f.read()
        return "File not found."
    return "Invalid action. Use 'read' or 'write'."

@mcp.tool(app=True)
def render_sidebar_ui(data: str) -> PrefabApp:
    """Generate a Prefab UI card to display the results of your research. 
    Pass a JSON string for data containing 'title', 'summary', and 'internet_data' keys."""
    print(f"[MCP Log] Generating Prefab UI with data length {len(data)}")
    try:
        parsed_data = json.loads(data)
    except Exception as e:
        parsed_data = {"title": "Raw Output", "summary": data, "internet_data": "Error parsing JSON data."}

    with PrefabApp(css_class="max-w-md mx-auto p-4") as app:
        with Card():
            with CardHeader():
                CardTitle(parsed_data.get("title", "Verification Results"))
            with CardContent():
                with Column(gap=2):
                    H3("Summary")
                    Text(parsed_data.get("summary", "No summary provided"))
                    Badge("Source Data")
                    Code(parsed_data.get("internet_data", "N/A"))
                    Muted("Verified using RAG Pipeline via Gemini & Tavily")
    return app

# FastAPI for the Extension's orchestration endpoint
fastapi_app = FastAPI()

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@fastapi_app.post("/verify")
async def verify_endpoint(request: Request):
    data = await request.json()
    text = data.get("text", "")
    
    if not text:
        return {"error": "No text provided"}
    
    if not GEMINI_API_KEY:
        # Return a simple Prefab error app serialized
        app = render_sidebar_ui(json.dumps({"title": "Error", "summary": "GEMINI_API_KEY is not set.", "internet_data": "N/A"}))
        return app.to_json()
        
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Step 1: Use MCP Tool to search
        academic_data = search_academic(text)
        
        # Step 2: Use Gemini to analyze
        prompt = f"""You are a fact-checking AI. 
Claim to verify: "{text}"
Search Results: "{academic_data}"

Evaluate the claim against the search results. Provide a short summary of your findings.
Return your response as a JSON string with keys: 'title', 'summary', 'internet_data'.
The 'internet_data' should be a snippet of the search results used to verify the claim.
Do not use markdown blocks, just raw JSON string."""
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        response_text = response.text.strip()
        if response_text.startswith('```json'):
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            
        # Step 3: Save notes using MCP tool
        manage_local_notes("write", response_text)
        
        # Step 4: Render UI using MCP tool
        try:
            # Check if valid JSON
            json.loads(response_text)
            ui_app = render_sidebar_ui(response_text)
        except:
            ui_app = render_sidebar_ui(json.dumps({"title": "Verification Results", "summary": response_text, "internet_data": academic_data[:200] + "..."}))
            
        # We must properly serialize the PrefabApp for FastAPI
        return ui_app.to_json()
        
    except Exception as e:
        print("[RAG Error]", str(e))
        error_app = render_sidebar_ui(json.dumps({"title": "Error", "summary": f"An error occurred: {str(e)}", "internet_data": "N/A"}))
        return error_app.to_json()

@mcp.tool(app=True)
def render_evaluation_ui(data: str) -> PrefabApp:
    """Generate a Prefab UI card to display prompt evaluation results."""
    print(f"[MCP Log] Generating Evaluation UI with data length {len(data)}")
    try:
        parsed_data = json.loads(data)
    except Exception as e:
        parsed_data = {"overall_clarity": "Error parsing JSON data.", "raw": data}

    with PrefabApp(css_class="max-w-md mx-auto p-4") as app:
        with Card():
            with CardHeader():
                CardTitle("Prompt Evaluation Results")
            with CardContent():
                with Column(gap=2):
                    H3("Criteria Assessment")
                    Text(f"Explicit Reasoning: {parsed_data.get('explicit_reasoning', False)}")
                    Text(f"Structured Output: {parsed_data.get('structured_output', False)}")
                    Text(f"Tool Separation: {parsed_data.get('tool_separation', False)}")
                    Text(f"Conversation Loop: {parsed_data.get('conversation_loop', False)}")
                    Text(f"Instructional Framing: {parsed_data.get('instructional_framing', False)}")
                    Text(f"Internal Self Checks: {parsed_data.get('internal_self_checks', False)}")
                    Text(f"Reasoning Type Awareness: {parsed_data.get('reasoning_type_awareness', False)}")
                    Text(f"Fallbacks: {parsed_data.get('fallbacks', False)}")
                    
                    H3("Overall Clarity")
                    Text(parsed_data.get("overall_clarity", "No summary provided"))
                    
                    if "raw" in parsed_data:
                        Code(parsed_data["raw"])
    return app

@fastapi_app.post("/evaluate")
async def evaluate_endpoint(request: Request):
    data = await request.json()
    text = data.get("text", "")
    
    if not text:
        return {"error": "No prompt text provided"}
    
    if not GEMINI_API_KEY:
        app = render_evaluation_ui(json.dumps({"overall_clarity": "GEMINI_API_KEY is not set."}))
        return app.to_json()
        
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        prompt = f"""You are a Prompt Evaluation Assistant.

You will receive a prompt written by a student. Your job is to review this prompt and assess how well it supports structured, step-by-step reasoning in an LLM (e.g., for math, logic, planning, or tool use).

Evaluate the prompt on the following criteria:

1. Explicit Reasoning Instructions  
2. Structured Output Format  
3. Separation of Reasoning and Tools  
4. Conversation Loop Support  
5. Instructional Framing  
6. Internal Self-Checks  
7. Reasoning Type Awareness  
8. Error Handling or Fallbacks  
9. Overall Clarity and Robustness  

Here is the student's prompt:
\"\"\"{text}\"\"\"

Respond with a structured review in exactly this JSON format, no markdown blocks:
{{
  "explicit_reasoning": true/false,
  "structured_output": true/false,
  "tool_separation": true/false,
  "conversation_loop": true/false,
  "instructional_framing": true/false,
  "internal_self_checks": true/false,
  "reasoning_type_awareness": true/false,
  "fallbacks": true/false,
  "overall_clarity": "String describing overall clarity."
}}
"""
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        response_text = response.text.strip()
        if response_text.startswith('```json'):
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            
        manage_local_notes("write", "Evaluation Results:\n" + response_text)
        
        try:
            json.loads(response_text)
            ui_app = render_evaluation_ui(response_text)
        except:
            ui_app = render_evaluation_ui(json.dumps({"overall_clarity": "Failed to parse JSON", "raw": response_text}))
            
        return ui_app.to_json()
        
    except Exception as e:
        print("[Eval Error]", str(e))
        error_app = render_evaluation_ui(json.dumps({"overall_clarity": f"An error occurred: {str(e)}"}))
        return error_app.to_json()

if __name__ == "__main__":
    print("[MCP Server] Starting MCP SSE transport on port 8002...")
    # Run the MCP server in a separate thread so it doesn't block FastAPI
    def run_mcp():
        mcp.run(transport="sse", host="127.0.0.1", port=8002)
    mcp_thread = threading.Thread(target=run_mcp, daemon=True)
    mcp_thread.start()
    
    print("[FastAPI] Starting Extension Orchestrator on port 8001...")
    uvicorn.run(fastapi_app, host="127.0.0.1", port=8001)
