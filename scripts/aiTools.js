
class AiTools {
    constructor(config) {
        this.webWrap = new WebWrapClient();
        this.config = config;
    }

    ListTools() {
        return [
            {
                functionName: "CurlFetch",
                description: "Performs an HTTP request described by a curl command string and returns the response body.",
                format: "<TOOL name=\"CurlFetch\">curl command string here</TOOL>"
            },
            {
                functionName: "WebSearch",
                description: "Performs a web search and returns the top results.",
                format: "<TOOL name=\"WebSearch\">search query here</TOOL>",
            },
        ];
    }

    /**
     * Returns a system-prompt block describing all available tools and how to invoke them.
     * The template is read from config.ai.toolsPrompt; use {tools} as a placeholder
     * for the dynamically-generated tool list.
     */
    getToolsSystemPrompt() {
        const tools = this.ListTools();
        if (!tools.length) return '';

        const descriptions = tools.map(t => {
            return `• ${t.functionName}\n  Description: ${t.description}\n  Format: ${t.format}`;
        }).join('\n\n');

        const template = this.config?.ai?.toolsPrompt ?? '';
        return template.replace('{tools}', descriptions);
    }

    /**
     * Execute a tool by name with the provided content string.
     * Returns a Promise that resolves to the result string.
     */
    async ToolCall(functionName, content) {
        switch (functionName) {
            case "CurlFetch":
                return this.handleCurlFetch(content);
            case "WebSearch":
                return this.handleWebSearch(content);
            default:
                throw new Error(`Unknown tool: ${functionName}`);
        }
    }

    async handleCurlFetch(curlString) {
        try {
            const { url, method, headers, body } = parseCurl(curlString);
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
                country: "US",
                search_lang: "en",
                count: 3
            });
            const response = await this.webWrap.ProxyFetch(url, { method: 'POST', headers, body });
            const jsonReturn = await response.text();
            const data = JSON.parse(jsonReturn);
            if(data?.web?.results?.length) {
                return data.web.results.map(r => `Title: ${r.title}\nURL: ${r.url}\nDescription: ${r.description}`).join('\n\n');
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