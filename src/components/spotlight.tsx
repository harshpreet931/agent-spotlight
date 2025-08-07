"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Globe, Search, File, Folder, Settings, KeyRound, Calculator } from 'lucide-react';
import { useDebounce } from "@/hooks/useDebounce";
import ResultItemComponent from "./ResultItem";

// --- Type Definitions ---

interface Tool {
  name: string;
  description: string;
  input_schema: any;
  server_name?: string; // Add server name to track which server provides this tool
}

interface HistoryItem {
  role: 'user' | 'model' | 'function';
  parts: { text?: string; functionCall?: any; functionResponse?: any }[];
}

interface FileSearchResult {
  path: string;
  is_dir: boolean;
}

export type ResultItem =
  | { type: 'text'; content: string }
  | { type: 'file'; content: FileSearchResult }
  | { type: 'math'; content: string }
  | { type: 'tool-list'; content: { name: string; description: string }[] };

// --- Helper Functions ---

// Function to get the server name for a given tool
const getServerNameForTool = (toolName: string, tools: Tool[]): string => {
  const tool = tools.find(t => t.name === toolName);
  if (tool?.server_name) {
    return tool.server_name;
  }
  
  // Fallback to 'filesystem' if no server name is found (for backward compatibility)
  if (process.env.NODE_ENV === 'development') {
    console.warn(`No server name found for tool ${toolName}, falling back to 'filesystem'`);
  }
  return 'filesystem';
};

// A simple function to get a file icon
const getFileIcon = (path: string) => {
  if (path.endsWith('.app')) return <Globe className="w-8 h-8 text-blue-500" />;
  if (path.endsWith('.txt')) return <FileText className="w-8 h-8 text-gray-500" />;
  return <File className="w-8 h-8 text-gray-400" />;
};

// --- Main Component ---

export function Spotlight() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Ready");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mathResult, setMathResult] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    inputRef.current?.focus();
    
    // Poll for tools until they're available
    const checkTools = async (retryCount = 0, delay = 500) => {
      const maxRetries = 10; // Maximum number of retry attempts
      const maxDelay = 8000; // Maximum delay of 8 seconds
      
      try {
        const availableTools = await invoke<Tool[]>("list_tools");
        
        // Only log in development to prevent sensitive data exposure
        if (process.env.NODE_ENV === 'development') {
          console.log("Available tools:", availableTools);
        }
        
        if (availableTools.length > 0) {
          setTools(availableTools);
        } else if (retryCount < maxRetries) {
          // Exponential backoff: double the delay each time, up to maxDelay
          const nextDelay = Math.min(delay * 2, maxDelay);
          setTimeout(() => checkTools(retryCount + 1, nextDelay), delay);
        } else {
          console.warn("Maximum retry attempts reached. Tools may not be available.");
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error fetching tools:", error);
        } else {
          console.error("Failed to fetch tools");
        }
        
        // Retry with exponential backoff if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          const nextDelay = Math.min(delay * 2, maxDelay);
          setTimeout(() => checkTools(retryCount + 1, nextDelay), delay);
        } else {
          console.warn("Maximum retry attempts reached. Tools may not be available.");
        }
      }
    };
    
    checkTools();
    
    const storedApiKey = localStorage.getItem("gemini_api_key");
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery.trim().length > 0) {
      // Lazy load mathjs
      import('mathjs').then(math => {
        try {
          // Basic check to see if it's a math expression
          if (/[0-9]/.test(debouncedQuery) && /[\+\-\*\/]/.test(debouncedQuery)) {
            const result = math.evaluate(debouncedQuery);
            setMathResult(result.toString());
          } else {
            setMathResult(null);
          }
        } catch (error) {
          setMathResult(null);
        }
      });
    } else {
      setMathResult(null);
    }
  }, [debouncedQuery]);

  const handleSaveApiKey = () => {
    localStorage.setItem("gemini_api_key", apiKey);
    setShowSettings(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Check for math directly on submit to avoid race condition with debounce
    let evaluatedMathResult: string | null = null;
    let isMath = false;
    try {
        if (/[0-9]/.test(query) && /[\+\-\*\/]/.test(query)) {
            const math = await import('mathjs');
            evaluatedMathResult = math.evaluate(query).toString();
            isMath = true;
        }
    } catch (error) {
        // Not a valid math expression
    }

    if (isMath && evaluatedMathResult) {
        setResults([{ type: 'math', content: evaluatedMathResult }]);
        setQuery(evaluatedMathResult);
        setMathResult(null); // Clear the debounced result
        return;
    }

    setLoading(true);
    setStatus("Thinking...");
    setResults([]);
    
    const currentHistory: HistoryItem[] = [...history, { role: "user", parts: [{ text: query }] }];
    setHistory(currentHistory);

    try {
      // Format tools correctly for Gemini
      const geminiTools = tools.length > 0 ? [{
        functionDeclarations: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema || {
            type: "object",
            properties: {},
            required: []
          }
        }))
      }] : [];

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          tools: geminiTools,
          history: currentHistory,
          apiKey,
        }),
      });

      const agentResponse = await res.json();

      if (agentResponse.type === "text") {
        const responseText = agentResponse.response;
        // Check if the response is a tool list
        if (responseText.includes("I have the following tools available:")) {
          const toolLines = responseText.replace('I have the following tools available: ', '').split('*').filter((line: string) => line.trim());
          const tools = toolLines.map((line: string) => {
            const [name, ...descriptionParts] = line.split(':');
            return {
              name: name.trim().replace(/`/g, ''),
              description: descriptionParts.join(':').trim()
            };
          });
          setResults([{ type: 'tool-list', content: tools }]);
        } else {
          setResults([{ type: 'text', content: responseText }]);
        }
        setHistory(prev => [...prev, { role: "model", parts: [{ text: responseText }] }]);
      } else if (agentResponse.type === "tool_call") {
        const toolNames = agentResponse.tool_calls.map((tc: any) => tc.name).join(', ');
        setStatus(`Calling tools: ${toolNames}`);
        
        const toolResults = await Promise.all(agentResponse.tool_calls.map(async (toolCall: any) => {
          try {
            // Dynamically determine the server name based on the tool
            const serverName = getServerNameForTool(toolCall.name, tools);
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`Calling tool ${toolCall.name} on server ${serverName}`);
            }
            
            const result = await invoke("call_tool", {
              serverName,
              toolName: toolCall.name,
              args: toolCall.args,
            });
            return { toolCall, result };
          } catch (e) {
            // Log detailed error information only in development
            if (process.env.NODE_ENV === 'development') {
              console.error(`Failed to execute tool ${toolCall.name}:`, e);
            } else {
              console.error(`Tool execution failed: ${toolCall.name}`);
            }
            return { toolCall, result: { error: `Failed to execute tool ${toolCall.name}` } };
          }
        }));

        const functionResponseParts = toolResults.map(tr => ({
          functionResponse: { name: tr.toolCall.name, response: tr.result }
        }));
        
        const newHistory: HistoryItem[] = [
          ...currentHistory,
          { role: "model", parts: agentResponse.tool_calls.map((tc: any) => ({ functionCall: tc })) },
          { role: "function", parts: functionResponseParts }
        ];
        setHistory(newHistory);

        // Display file search results immediately
        const fileSearchResults = toolResults.flatMap(tr => 
            tr.result && Array.isArray(tr.result) ? tr.result : []
        );
        
        if (fileSearchResults.length > 0) {
            setResults(fileSearchResults.map((item: any) => ({ type: 'file', content: item })));
        }


        // Send results back to the agent for a summary
        setStatus(`Summarizing results from: ${toolNames}`);
        const secondRes = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: "Summarize the results. If they are files, just say you've found some files.",
              tools: geminiTools,
              history: newHistory,
              apiKey,
            }),
        });

        const finalAgentResponse = await secondRes.json();
        if (finalAgentResponse.type === 'text') {
            // Prepend the summary to the results
            setResults(prev => [{ type: 'text', content: finalAgentResponse.response }, ...prev]);
            setHistory(prev => [...prev, { role: "model", parts: [{ text: finalAgentResponse.response }] }]);
        }
      }
    } catch (error) {
      setStatus("Error");
      setResults([{ type: 'text', content: "An error occurred while processing your request." }]);
      console.error(error);
    } finally {
      setLoading(false);
      setStatus("Ready");
      setQuery("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setQuery("");
      setResults([]);
      setStatus("Ready");
    }
  };

  const renderResultItem = useCallback((item: ResultItem, index: number) => {
    return <ResultItemComponent key={index} item={item} index={index} />;
  }, []);

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-start justify-center pt-[20vh] z-50 font-sans">
      <div className="w-[700px] mx-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 flex flex-col max-h-[70vh]">
          <form onSubmit={handleSubmit} className="flex-shrink-0">
            <div className="flex items-center px-5 py-4">
              <Search className="w-6 h-6 text-gray-400 mr-4" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Agentic Spotlight"
                className="flex-1 text-2xl text-gray-800 placeholder-gray-400 bg-transparent border-none outline-none"
                disabled={loading}
              />
              <button type="button" onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-full hover:bg-gray-200">
                <Settings className="w-5 h-5 text-gray-500" />
              </button>
              {loading && (
                <div className="ml-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-gray-700"></div>
                </div>
              )}
            </div>
          </form>

          {showSettings && (
            <div className="px-5 py-4 border-t border-gray-200/80">
              <div className="flex items-center">
                <KeyRound className="w-5 h-5 text-gray-500 mr-3" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API Key"
                  className="flex-1 text-base text-gray-800 placeholder-gray-400 bg-gray-100 rounded-md px-3 py-2 border-none outline-none"
                />
                <button onClick={handleSaveApiKey} className="ml-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="overflow-y-auto flex-grow border-t border-gray-200/80">
            {mathResult && results.length === 0 ? (
              <div className="py-2">
                {renderResultItem({ type: 'math', content: mathResult }, 0)}
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map(renderResultItem)}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>{status}</p>
                <p className="text-sm mt-2">Tools available: {tools.length}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-sm text-white/70">
            Press <kbd className="px-2 py-1 text-xs font-sans bg-white/20 rounded-md border border-white/30">⌘</kbd> + 
            <kbd className="px-2 py-1 text-xs font-sans bg-white/20 rounded-md border border-white/30 ml-1">`</kbd> to toggle
          </p>
        </div>
      </div>
    </div>
  );
}
