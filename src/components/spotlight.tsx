"use client";

import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Tool {
  name: string;
  description: string;
  input_schema: any;
}

// Gemini API compatible tool definition
interface GeminiTool {
  functionDeclarations: Tool[];
}

export function Spotlight() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    // Load tools from the backend
    invoke<Tool[]>("list_tools")
      .then(setTools)
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(`Thinking...`);
    
    const currentHistory = [...history, { role: "user", parts: [{ text: query }] }];
    setHistory(currentHistory);

    try {
      // Transform tools to the format expected by the Gemini API
      const geminiTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      }));

      // Initial call to the agent
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query,
          tools: [{ functionDeclarations: geminiTools }],
          history: currentHistory,
        }),
      });

      const agentResponse = await res.json();

      if (agentResponse.type === "text") {
        setResponse(agentResponse.response);
        setHistory(prev => [...prev, { role: "model", parts: [{ text: agentResponse.response }] }]);
      } else if (agentResponse.type === "tool_call") {
        setResponse(`Calling tools: ${agentResponse.tool_calls.map((tc: any) => tc.name).join(', ')}`);
        
        const toolResults = [];
        for (const toolCall of agentResponse.tool_calls) {
          try {
            const result = await invoke("call_tool", {
              serverName: "filesystem", // This needs to be dynamic
              toolName: toolCall.name,
              args: toolCall.args,
            });
            toolResults.push({
              toolCall,
              result,
            });
          } catch (e) {
            toolResults.push({
              toolCall,
              result: { error: `Failed to execute tool ${toolCall.name}: ${e}` },
            });
          }
        }

        // Transform tools for the second call as well
        const geminiTools = tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
        }));

        // Send tool results back to the agent
        const functionResponseParts = toolResults.map(tr => ({
            functionResponse: {
                name: tr.toolCall.name,
                response: tr.result,
            }
        }));

        const secondRes = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: "Please summarize the results of the tool calls.", // A generic prompt to continue
              tools: [{ functionDeclarations: geminiTools }],
              history: [...currentHistory, { role: "model", parts: agentResponse.tool_calls.map((tc: any) => ({ functionCall: tc })) }, { role: "function", parts: functionResponseParts }]
            }),
        });

        const finalAgentResponse = await secondRes.json();
        if (finalAgentResponse.type === 'text') {
            setResponse(finalAgentResponse.response);
            setHistory(prev => [...prev, { role: "model", parts: [{ text: finalAgentResponse.response }] }]);
        } else {
            setResponse("Agent did not provide a final answer after tool call.");
        }
      }
    } catch (error) {
      setResponse("An error occurred while processing your request.");
      console.error(error);
    } finally {
      setLoading(false);
      setQuery("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setQuery("");
      setResponse("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-start justify-center pt-[15vh] z-50">
      <div className="w-[600px] mx-4">
        {/* Spotlight Search Container */}
        <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 flex flex-col max-h-[80vh]">
          <form onSubmit={handleSubmit} className="flex-shrink-0">
            <div className="flex items-center px-6 py-4">
              {/* Search Icon */}
              <svg
                className="w-5 h-5 text-gray-400 mr-4 flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>

              {/* Input Field */}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Spotlight Search"
                className="flex-1 text-2xl text-gray-800 placeholder-gray-400 bg-transparent border-none outline-none font-light"
                disabled={loading}
              />

              {/* Loading Spinner */}
              {loading && (
                <div className="ml-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-600"></div>
                </div>
              )}
            </div>
          </form>

          {/* Scrollable Content Area */}
          <div className="overflow-y-auto flex-grow">
            {/* Results Container */}
            {response && (
              <div className="border-t border-gray-100">
                <div className="px-6 py-4">
                  <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{response}</pre>
                </div>
              </div>
            )}

            {/* Tools List */}
            {showTools && tools.length > 0 && (
              <div className="border-t border-gray-100">
                <div className="px-6 py-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Tools</h4>
                  <ul className="mt-2 text-sm text-gray-700">
                    {tools.map(tool => (
                      <li key={tool.name} className="py-1">- {tool.name}: {tool.description}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tools Button */}
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowTools(!showTools)}
            className="px-4 py-2 text-sm bg-white/20 rounded-md border border-white/30 text-white/70 hover:bg-white/30 transition-colors"
          >
            {showTools ? "Hide" : "Show"} Available Tools
          </button>
        </div>

        {/* Hint text */}
        <div className="mt-3 text-center">
          <p className="text-sm text-white/70">
            Press <kbd className="px-2 py-1 text-xs bg-white/20 rounded border border-white/30">⌘</kbd> + 
            <kbd className="px-2 py-1 text-xs bg-white/20 rounded border border-white/30 ml-1">Space</kbd> to search
          </p>
        </div>
      </div>
    </div>
  );
}
