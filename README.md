# Agent Spotlight 

**Agent Spotlight** is a desktop AI agent that provides a simple, powerful, and extensible interface for interacting with language models. Built with Tauri, Next.js, and Rust, it's designed to be a lightweight and fast way to bring the power of AI to your desktop.

The core feature of Agent Spotlight is its extensibility through the **Model Context Protocol (MCP)**. This allows any user to add their own tools and data sources, creating a personalized AI assistant that can interact with local files, external APIs, and more.

---

## Features

- **Spotlight Interface**: A clean, minimal, and always-on-top interface, accessible with a global hotkey (coming soon!).
- **AI-Powered**: Uses Google's Gemini models to understand queries and orchestrate tasks.
- **Extensible with MCP**: Easily add new capabilities by configuring Model Context Protocol (MCP) servers.
- **Function Calling**: The AI can decide when to use the tools you provide to answer questions or perform actions.
- **Cross-Platform**: Built with Tauri to run on Windows, macOS, and Linux.
- **Web Technologies**: A modern UI built with Next.js, React, and Tailwind CSS.

## Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Desktop Framework**: [Tauri](https://tauri.app/)
- **Backend Language**: [Rust](https://www.rust-lang.org/)
- **AI Model**: [Google Gemini](https://deepmind.google/technologies/gemini/)
- **Extensibility**: [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install)
- A Google AI API Key with the Gemini 2.5 Flash model enabled.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/agent-spotlight-app.git
    cd agent-spotlight-app
    ```

2.  **Install NPM dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your API Key:**
    Create a `.env.local` file in the root of the project and add your Google API key:
    ```
    GOOGLE_API_KEY="YOUR_API_KEY_HERE"
    ```

4.  **Run the application in development mode:**
    ```bash
    npm run tauri dev
    ```
    This will launch the desktop application and automatically reload when you make changes to the code.

---

## How It Works

Agent Spotlight uses a sophisticated agentic architecture to process your requests.

1.  The user enters a query into the Spotlight UI.
2.  The UI sends the query, along with a list of all available tools from the MCP servers, to the backend Agent API.
3.  The agent forwards this to the Gemini LLM.
4.  The LLM decides if it needs to use a tool. If so, it responds with a "tool call" request.
5.  The UI receives the tool call request and instructs the Tauri backend to execute the specific tool.
6.  The Tauri backend sends a `tools/call` request to the appropriate MCP server.
7.  The MCP server performs the action and returns the result.
8.  The result is passed back to the agent, which sends it back to the LLM.
9.  The LLM uses the tool's result to generate a final, natural-language answer for the user.

---

## Adding Your Own Tools (via MCP)

This is the most powerful feature of Agent Spotlight. You can add any tool that complies with the Model Context Protocol.

1.  **Locate the Configuration File**:
    The application uses a configuration file named `mcp_servers.json`. On first launch, a default version of this file is created in your system's application config directory. You can also find and edit the source version in `src-tauri/mcp_servers.json`.

2.  **Define Your Server**:
    Add a new entry to the `mcpServers` object in the JSON file. Each server needs a `command` to run and `args` to pass to it.

    **Example: Adding a Git Log Server**
    Imagine you have a Python script at `~/scripts/mcp_git_log.py` that acts as an MCP server to read git logs. You would add it like this:

    ```json
    {
      "mcpServers": {
        "filesystem": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
        },
      }
    }
    ```

3.  **Restart Agent Spotlight**:
    After saving your changes to `mcp_servers.json`, restart the application. The new server will be launched, and its tools will be available to the AI.

---

## Future Work

- [ ] Implement a global hotkey for showing/hiding the spotlight.
- [ ] Improve the UI for displaying different types of tool results (e.g., images, tables).
- [ ] Add a UI for managing MCP servers directly from the application.
- [ ] Persist conversation history across sessions. Currently, the history is of one conversation.

## License

This project is licensed under the MIT License.
