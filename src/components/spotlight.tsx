"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Globe, Search, File, Folder, Settings, KeyRound } from 'lucide-react';

// --- Type Definitions ---

interface Tool {
  name: string;
  description: string;
  input_schema: any;
}

interface HistoryItem {
  role: 'user' | 'model' | 'function';
  parts: { text?: string; functionCall?: any; functionResponse?: any }[];
}

interface FileSearchResult {
  path: string;
  is_dir: boolean;
}

type ResultItem = 
  | { type: 'text'; content: string }
  | { type: 'file'; content: FileSearchResult };

// --- Helper Functions ---

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

  useEffect(() => {
    inputRef.current?.focus();
    invoke<Tool[]>("list_tools").then(setTools).catch(console.error);
    const storedApiKey = localStorage.getItem("gemini_api_key");
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
  }, []);

  const handleSaveApiKey = () => {
    localStorage.setItem("gemini_api_key", apiKey);
    setShowSettings(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setStatus("Thinking...");
    setResults([]);
    
    const currentHistory: HistoryItem[] = [...history, { role: "user", parts: [{ text: query }] }];
    setHistory(currentHistory);

    try {
      const geminiTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      }));

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          tools: [{ functionDeclarations: geminiTools }],
          history: currentHistory,
          apiKey,
        }),
      });

      const agentResponse = await res.json();

      if (agentResponse.type === "text") {
        setResults([{ type: 'text', content: agentResponse.response }]);
        setHistory(prev => [...prev, { role: "model", parts: [{ text: agentResponse.response }] }]);
      } else if (agentResponse.type === "tool_call") {
        setStatus(`Calling tools: ${agentResponse.tool_calls.map((tc: any) => tc.name).join(', ')}`);
        
        const toolResults = await Promise.all(agentResponse.tool_calls.map(async (toolCall: any) => {
          try {
            const result = await invoke("call_tool", {
              serverName: "filesystem", // This should be dynamic based on the tool
              toolName: toolCall.name,
              args: toolCall.args,
            });
            return { toolCall, result };
          } catch (e) {
            return { toolCall, result: { error: `Failed to execute tool ${toolCall.name}: ${e}` } };
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
        setStatus("Summarizing...");
        const secondRes = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: "Summarize the results. If they are files, just say you've found some files.",
              tools: [{ functionDeclarations: geminiTools }],
              history: newHistory
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

  const renderResultItem = (item: ResultItem, index: number) => {
    switch (item.type) {
      case 'text':
        return (
          <div key={index} className="px-6 py-3 text-gray-700 text-base">
            {item.content}
          </div>
        );
      case 'file':
        const { path, is_dir } = item.content;
        const fileName = path.split('/').pop();
        return (
          <div key={index} className="flex items-center px-6 py-3 hover:bg-gray-100 rounded-lg transition-colors duration-150 cursor-pointer">
            <div className="mr-4">
              {is_dir ? <Folder className="w-8 h-8 text-yellow-500" /> : getFileIcon(path)}
            </div>
            <div className="flex-grow">
              <p className="font-medium text-gray-800">{fileName}</p>
              <p className="text-sm text-gray-500">{path}</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

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
            {results.length > 0 ? (
              <div className="py-2">
                {results.map(renderResultItem)}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>{status}</p>
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
