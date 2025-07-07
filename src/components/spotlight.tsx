"use client";

import { useState, useRef, useEffect } from "react";

export function Spotlight() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(data.response);
      } else {
        setResponse("An error occurred while processing your request.");
      }
    } catch (error) {
      setResponse("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
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
        <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden border border-white/20">
          <form onSubmit={handleSubmit}>
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

          {/* Results Container */}
          {response && (
            <div className="border-t border-gray-100">
              <div className="px-6 py-4 hover:bg-blue-50/50 cursor-pointer transition-colors">
                <div className="flex items-start gap-4">
                  {/* Result Icon */}
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  
                  {/* Result Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-medium text-gray-900">AI Agent Response</h3>
                      <span className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-100 rounded-full">
                        Agent
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{response}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
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
