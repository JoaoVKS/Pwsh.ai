
class AiTools {
    constructor(config) {
        this.webWrap = new WebWrapClient();
        this.config = config;
    }

    /**
     * Returns the list of tools in OpenAI/OpenRouter JSON Schema format.
     * PwshExec is defined here but dispatched externally by executeNativeToolCalls in app.js.
     */
    ListTools() {
        return [
            {
                type: "function",
                function: {
                    name: "CurlFetch",
                    description: "Performs an HTTP/Web request described by a curl command string and returns the response body",
                    parameters: {
                        type: "object",
                        properties: {
                            curl: {
                                type: "string",
                                description: "Full curl command string (e.g. curl -X GET https://...)"
                            }
                        },
                        required: ["curl"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "WebSearch",
                    description: "Performs a web search using Brave Search and returns the top results including news",
                    parameters: {
                        type: "object",
                        properties: {
                            search_query: {
                                type: "string",
                                description: "Search query string"
                            }
                        },
                        required: ["search_query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "PwshExec",
                    description: "Executes a PowerShell command on the Windows host and returns the real-time output. Use for filesystem operations, system information, running scripts, registry access, and any Windows-specific tasks.",
                    parameters: {
                        type: "object",
                        properties: {
                            command: {
                                type: "string",
                                description: "PowerShell command string to execute (wrap paths in double quotes)"
                            }
                        },
                        required: ["command"]
                    }
                }
            }
        ];
    }

    /**
     * Execute a tool by name with the provided parsed arguments object.
     * PwshExec is NOT handled here — it is dispatched directly by executeNativeToolCalls in app.js
     * (requires UI confirmation gate and real-time streaming output).
     * @param {string} functionName
     * @param {object|string} args - Parsed JSON arguments object from the tool call
     * @returns {Promise<string>}
     */
    async ToolCall(functionName, args) {
        switch (functionName) {
            case "CurlFetch": {
                const curlStr = (typeof args === 'string') ? args : (args?.curl ?? JSON.stringify(args));
                return this.handleCurlFetch(curlStr);
            }
            case "WebSearch": {
                const query = (typeof args === 'string') ? args : (args?.search_query ?? JSON.stringify(args));
                return this.handleWebSearch(query);
            }
            default:
                throw new Error(`Unknown tool: ${functionName}`);
        }
    }

    async handleCurlFetch(curlString) {
        try {
            const { url, method, headers, body } = parseCurl(curlString);

            // Add User-Agent if not already present
            if (!headers['User-Agent'] && !headers['user-agent']) {
                headers['User-Agent'] = 'Pwsh.ai/1.0 (https://github.com/JoaoVKS/Pwsh.ai)';
            }
            
            const response = await this.webWrap.ProxyFetch(url, { method, headers, body });
            return await response.text();
        } catch (error) {
            console.error("CurlFetch error:", error);
            throw new Error("CurlFetch failed: " + error.message);
        }
    }

    async handleWebSearch(query) {
        try {
            const apiKey = this.config?.ai?.toolsAuth?.braveSearch?.apiKey;
            if (!apiKey) throw new Error("Brave Search API key not configured");
            const url = `https://api.search.brave.com/res/v1/web/search`;
            const headers = {
                "Accept": "application/json",
                "X-Subscription-Token": apiKey
            };
            const body = JSON.stringify({
                q: query,
                count: 5,
                extra_snippets: true,
                safe_search: 'off',
                text_decorations: false
            });
            const response = await this.webWrap.ProxyFetch(url, { method: 'POST', headers, body });
            const jsonReturn = await response.text();
            const data = JSON.parse(jsonReturn);
            
            const results = [];
            
            // Add news results first
            if (data?.news?.results?.length) {
                data.news.results.slice(0, 3).forEach(r => {
                    results.push(`[NEWS] Title: ${r.title}\nURL: ${r.url}\nDescription: ${r.description}`);
                });
            }
            
            // Add web results
            if (data?.web?.results?.length) {
                data.web.results.slice(0, 4).forEach(r => {
                    results.push(`Title: ${r.title}\nURL: ${r.url}\nDescription: ${r.description}`);
                });
            }
            
            if (results.length) {
                return results.join('\n\n');
            }
        } catch (error) {
            console.error("WebSearch error:", error);
            throw new Error("WebSearch failed: " + error.message);
        }
    }
}



//#######HELPER FUNCTIONS#######
function parseCurl(curlString) {
  // 1. Clean up the string (remove line breaks and backslashes)
  const cleanCurl = curlString.replace(/\\\n/g, ' ').trim();

  const result = {
    method: 'GET', // Default
    headers: {},
    url: ''
  };

  // 2. Extract the URL (usually the first string that looks like a URL)
  const urlMatch = cleanCurl.match(/(https?:\/\/[^\s'"]+)/);
  if (urlMatch) result.url = urlMatch[1];

  // 3. Extract the Method (-X POST)
  const methodMatch = cleanCurl.match(/-X\s+([A-Z]+)/);
  if (methodMatch) result.method = methodMatch[1];

  // 4. Extract Headers (-H "Key: Value")
  const headerMatches = cleanCurl.matchAll(/-H\s+["']([^"']+)["']/g);
  for (const match of headerMatches) {
    const [key, ...valueParts] = match[1].split(':');
    result.headers[key.trim()] = valueParts.join(':').trim();
  }

  // 5. Extract Body (-d or --data)
  const bodyMatch = cleanCurl.match(/(-d|--data|--data-raw)\s+["']({.*})["']/s) 
                 || cleanCurl.match(/(-d|--data|--data-raw)\s+['"](.*?)['"](?=\s+-|$)/s);
                 
  if (bodyMatch) {
    result.body = bodyMatch[2];
    // If we're parsing a POST without an explicit -X, set it to POST
    if (result.method === 'GET') result.method = 'POST';
  }

  return result;
}

async function decompressGzip(uint8Array) {
  // 1. Create a stream from the compressed bytes
  const stream = new Blob([uint8Array]).stream();
  
  // 2. Pipe through the native GZIP decompressor
  const decompressedStream = stream.pipeThrough(
    new DecompressionStream("gzip")
  );

  // 3. Convert the stream back to text
  const response = await new Response(decompressedStream);
  const text = await response.text();
  
  return text;
}