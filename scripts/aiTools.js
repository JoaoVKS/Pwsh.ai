
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
            },
            {
                type: "function",
                function: {
                    name: "fileWrite",
                    description: "Writes content to a text file on the Windows host. Creates the file if it doesn't exist or overwrites it if it does.",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: {
                                type: "string",
                                description: "Full path to the file to write to, if only"
                            },
                            content: {
                                type: "string",
                                description: "Content to write to the file"
                            }
                        },
                        required: ["filePath", "content"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "fileRead",
                    description: "Reads the content of a text file from the Windows host and returns it as a string.",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: {
                                type: "string",
                                description: "Full path to the file to read"
                            },
                        },
                        required: ["filePath"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "fileTextSearch",
                    description: "Searches for text in a file and returns all matches with their line and column positions.",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: {
                                type: "string",
                                description: "Full path to the file to search in"
                            },
                            searchText: {
                                type: "string",
                                description: "Text to search for (case-insensitive)"
                            }
                        },
                        required: ["filePath", "searchText"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "sendEmail",
                    description: "Sends an email using the configured email service.",
                    parameters: {
                        type: "object",
                        properties: {
                            to: {
                                type: "string",
                                description: "Recipient email address"
                            },
                            subject: {
                                type: "string",
                                description: "Subject of the email"
                            },
                            body: {
                                type: "object",
                                description: "Body content of the email",
                                properties: {
                                    text: {
                                        type: "string",
                                        description: "Plain text version of the email body"
                                    },
                                    html: {
                                        type: "string",
                                        description: "HTML version of the email body"
                                    }
                                }
                            },
                            attachments: {
                                type: "object",
                                description: "Attachments for the email",
                                properties: {
                                    filename: {
                                        type: "string",
                                        description: "Name of the attachment file"
                                    },
                                    content: {
                                        type: "string",
                                        description: "Base64 encoded content of the attachment"
                                    },
                                    disposition: {
                                        type: "string",
                                        description: "always 'attachment'"
                                    }
                                }
                            }
                        },
                        required: ["to", "subject", "body"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "sysInfo",
                    description: "Get information about host system, like, RAM usage, CPU load, temperature, disk usage etc. Useful for monitoring.",
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
        // De-dupe: if args might be double-encoded, try parsing again
        if (typeof args === 'string') {
            try {
                const parsed = JSON.parse(args);
                if (typeof parsed === 'object' && parsed !== null) {
                    args = parsed;
                }
            } catch {
                // Not JSON, keep as string
            }
        }

        switch (functionName) {
            case "CurlFetch": {
                const curlStr = (typeof args === 'string') ? args : (args?.curl ?? JSON.stringify(args));
                return this.handleCurlFetch(curlStr);
            }
            case "WebSearch": {
                const query = (typeof args === 'string') ? args : (args?.search_query ?? JSON.stringify(args));
                return this.handleWebSearch(query);
            }
            case "fileWrite": {
                const filePath = (typeof args === 'string') ? args : (args?.filePath ?? '');
                const content = (typeof args === 'string') ? '' : (args?.content ?? '');
                return this.handleFileWrite(filePath, content);
            }
            case "fileRead": {
                const filePath = (typeof args === 'string') ? args : (args?.filePath ?? '');
                return this.handleFileRead(filePath);
            }
            case "fileTextSearch": {
                const filePath = (typeof args === 'string') ? args : (args?.filePath ?? '');
                const searchText = (typeof args === 'string') ? '' : (args?.searchText ?? '');
                return this.handleFileTextSearch(filePath, searchText);
            }
            case "sendEmail": {
                const to = (typeof args === 'string') ? args : (args?.to ?? '');
                const subject = (typeof args === 'string') ? '' : (args?.subject ?? '');
                const body = (typeof args === 'string') ? '' : (args?.body ?? '');
                const attachments = (typeof args === 'string') ? [] : (args?.attachments ?? []);
                return this.handleSendEmail(to, subject, body, attachments);
            }
            case "sysInfo": {
                return this.handleSysInfo();
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
            // ProxyFetch returns a custom response with plain object headers
            const contentType = (response.headers?.['content-type'] || response.headers?.['Content-Type'] || '').toLowerCase();
            //This contentTypes are safe to return as text, otherwise we will send the raw content to the main process to convert to markdown (for binary files, images, pdfs, etc.)
            if(contentType?.includes('application/json') 
                || contentType?.includes('text/xml')
                || contentType?.includes('text/plain')
                || contentType?.includes('application/xml')
                || contentType?.includes('text/csv')
                || contentType?.includes('text/tab-separated-values')
                || contentType?.includes('application/javascript')
                || contentType?.includes('text/javascript')
                || contentType?.includes('application/ld+json')
                || contentType?.includes('application/vnd.api+json')
                || contentType?.includes('text/css')
                || contentType?.includes('application/yaml')
                || contentType?.includes('text/yaml')
                || contentType?.includes('text/markdown')
                || contentType?.includes('text/x-markdown')
                || contentType?.includes('application/x-www-form-urlencoded')
                || contentType?.includes('application/xhtml+xml')
                || contentType?.includes('application/problem+json')
            )
            {
                return await response.text();
            }
            else
            {
                const text = await response.text();
                return new Promise((resolve) => {
                    const requestId = crypto.randomUUID();
                    const handler = (event) => {
                        const data = event.data;
                        if (data.requestId !== requestId) return;
                        window.chrome.webview.removeEventListener('message', handler);
                        if (data.type === 'rawToMd') {
                            if (data.status === 0) {
                                resolve(data.output || "");
                            } else {
                                resolve(text || "");
                            }
                        }
                    };
                    window.chrome.webview.addEventListener('message', handler);
                    this.webWrap.sendMessage("rawToMd", { text, requestId });
                });
            }
        } catch (error) {
            console.error("CurlFetch error:", error);
            throw new Error("CurlFetch failed: " + error.message);
        }
    }

    async handleWebSearch(query) {
        try {
            const results = [];
            const braveApiKey = this.config?.ai?.toolsAuth?.braveSearch?.apiKey;
            const braveOrder = this.config?.ai?.toolsAuth?.braveSearch?.order || 1;

            const tavilyApiKey  = this.config?.ai?.toolsAuth?.tavily?.apiKey;
            const tavilyOrder = this.config?.ai?.toolsAuth?.tavily?.order || 1;
            
            if (braveOrder > tavilyOrder) {
                // If Tavily has higher priority (lower order number), try Tavily first
                if (!tavilyApiKey) {
                    console.warn("Tavily Search API key not configured, skipping to Brave.");
                    if (!braveApiKey) {
                        console.warn("Brave Search API key not configured, skipping WebSearch tool.");
                        return "";
                    }
                    results.push(...await this.braveSearch(braveApiKey, query));
                } else {
                    results.push(...await this.tavilySearch(tavilyApiKey, query));
                }
            } else {
                // Brave has higher or equal priority, try Brave first
                if (!braveApiKey) {
                    console.warn("Brave Search API key not configured, skipping to Tavily.");
                    if (!tavilyApiKey) {
                        console.warn("Tavily Search API key not configured, skipping WebSearch tool.");
                        return "";
                    }
                    results.push(...await this.tavilySearch(tavilyApiKey, query));
                } else {
                    results.push(...await this.braveSearch(braveApiKey, query));
                }
            }
            return results.join('\n');
        } catch (error) {
            console.error("WebSearch error:", error);
            throw new Error("WebSearch failed: " + error.message);
        }
    }

        async braveSearch(apiKey, query) {
            let results = [];
            const url = `https://api.search.brave.com/res/v1/web/search`;
            const headers = {
                "Accept": "application/json",
                "X-Subscription-Token": apiKey
            };
            const body = JSON.stringify({
                q: query,
                count: 16,
                extra_snippets: true,
                safe_search: 'off',
                text_decorations: false
            });
            const response = await this.webWrap.ProxyFetch(url, { method: 'POST', headers, body });
            const jsonReturn = await response.text();
            const data = JSON.parse(jsonReturn);
            // Add news results first
            if (data?.news?.results?.length) {
                data.news.results.forEach(r => {
                    results.push(`[NEWS] Title: ${r.title}\nURL: ${r.url}\nDescription: ${r.description}`);
                });
            }
            // Add web results
            if (data?.web?.results?.length) {
                data.web.results.forEach(r => {
                    results.push(`Title: ${r.title}\nURL: ${r.url}\nDescription: ${r.description}`);
                });
            }
            return results;
        }
        async tavilySearch(apiKey, query){
            let results = [];
            const url = `https://api.tavily.com/search`;
            const headers = {
                "Accept": "application/json",
                "Authorization": `Bearer ${apiKey}`
            };
            const body = JSON.stringify({
                 query: query,
                 search_depth: "advanced",
                 max_results: 10,
                include_images: true
            });
            const response = await this.webWrap.ProxyFetch(url, { method: 'POST', headers, body });
            const jsonReturn = await response.text();
            const data = JSON.parse(jsonReturn);
            // Add results
            if (data?.results?.length) {
                data.results.forEach(r => {
                    results.push(`Title: ${r.title}\nURL: ${r.url}\nDescription: ${r.content}`);
                });
            }
            if (data?.images?.length) {
                data.images.forEach(img => {
                    results.push(`Image: ${img}`);
                });
            }
            return results;
        }

    /**
     * Decodes HTML entities in a string using the browser's native parser.
     * Handles &lt; &gt; &amp; &quot; &#39; and all numeric/named entities.
     * Content without entities passes through unchanged.
     */
    decodeHtmlEntities(str) {
        const ta = document.createElement('textarea');
        ta.innerHTML = str;
        return ta.value;
    }

    /**
     * Strips markdown code fences from content if present.
     * Handles ```lang\n...\n``` and plain ``` blocks.
     */
    stripCodeFences(content) {
        if (typeof content !== 'string') return content;
        // Match optional language tag after opening fence
        const fenced = content.match(/^```[^\n]*\n([\s\S]*?)```\s*$/);
        if (fenced) return fenced[1];
        return content;
    }

    async handleFileWrite(filePath, content) {
        const stripped = this.stripCodeFences(content);
        const decoded = this.decodeHtmlEntities(stripped);
        return new Promise((resolve, reject) => {
            const requestId = crypto.randomUUID();
            const handler = (event) => {
                const data = event.data;
                if (data.requestId !== requestId) return;
                window.chrome.webview.removeEventListener('message', handler);
                if (data.type === 'fileWrite') {
                    if (data.status === 0) {
                        resolve(data.output || "File written successfully");
                    } else {
                        reject(new Error(data.output || "Failed to write file"));
                    }
                }
            };
            window.chrome.webview.addEventListener('message', handler);
            this.webWrap.sendMessage("fileWrite", { filePath, content: decoded, requestId });
        });
    }

    async handleFileRead(filePath) {
        return new Promise((resolve, reject) => {
            const requestId = crypto.randomUUID();
            const handler = (event) => {
                const data = event.data;
                if (data.requestId !== requestId) return;
                window.chrome.webview.removeEventListener('message', handler);
                if (data.type === 'fileRead') {
                    if (data.status === 0) {
                        const text = data.output || "";
                        if (filePath.endsWith('.pdf') || filePath.endsWith('.docx')
                            || filePath.endsWith('.xlsx') || filePath.endsWith('.pptx')
                            || filePath.endsWith('.xls') || filePath.endsWith('.doc') || filePath.endsWith('.ppt')
                            || filePath.endsWith('.jpg') || filePath.endsWith('.png') || filePath.endsWith('.gif')) {
                            const mdHandler = (mdEvent) => {
                                const mdData = mdEvent.data;
                                if (mdData.requestId !== requestId) return;
                                window.chrome.webview.removeEventListener('message', mdHandler);
                                if (mdData.type === 'rawToMd') {
                                    if (mdData.status === 0) {
                                        resolve(mdData.output || "");
                                    } else {
                                        resolve(text || "");
                                    }
                                }
                            };
                            window.chrome.webview.addEventListener('message', mdHandler);
                            this.webWrap.sendMessage("rawToMd", { text, requestId });
                        } else {
                            resolve(text);
                        }
                    } else {
                        reject(new Error(data.output || "Failed to read file"));
                    }
                }
            };
            window.chrome.webview.addEventListener('message', handler);
            this.webWrap.sendMessage("fileRead", { filePath, requestId });
        });
    }

    async handleFileTextSearch(filePath, searchText) {
        return new Promise((resolve, reject) => {
            const requestId = crypto.randomUUID();
            const handler = (event) => {
                const data = event.data;
                if (data.requestId !== requestId) return;
                window.chrome.webview.removeEventListener('message', handler);
                if (data.type === 'fileTextSearch') {
                    if (data.status === 0) {
                        resolve(data.output || "No matches found");
                    } else {
                        reject(new Error(data.output || "Failed to search in file"));
                    }
                }
            };
            window.chrome.webview.addEventListener('message', handler);
            this.webWrap.sendMessage("fileTextSearch", { filePath, searchText, requestId });
        });
    }

    async handleSendEmail(to, subject, body, attachments) {
        try {
            const apiKey = this.config?.ai?.toolsAuth?.mailerSend?.apiKey;
            // Add User-Agent if not already present
            if (!apiKey) throw new Error("MailerSend API key not configured");
            //create httpObject to send via proxyfetch
            const url = `https://api.mailersend.com/v1/email`;
            const headers = {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            };
            const bodyObj = {
                from: {
                    email: "pwshai@test-z0vklo6vnyxl7qrx.mlsender.net",
                    name: "PWSH.AI"
                },
                to: [
                    {
                        email: to
                    }
                ],
                subject: subject,
                text: body?.text || '',
                html: body?.html || `<p>${body?.text || ''}</p>`
            };

            if (attachments) {
                if (attachments.length > 1) {
                    bodyObj.attachments = [];
                    attachments.forEach(element => {
                        let attObj = {
                            filename: element.filename,
                            content: element.content,
                            disposition: element.disposition || 'attachment'
                        }
                        bodyObj.attachments.push(attObj);
                    });
                } else {
                    bodyObj.attachments = [{
                        filename: attachments.filename,
                        content: attachments.content,
                        disposition: attachments.disposition || 'attachment'
                    }];
                }
            }

            const bodyJson = JSON.stringify(bodyObj);
            const response = await this.webWrap.ProxyFetch(url, { method: 'POST', headers, body: bodyJson });
            return await response.text();
        } catch (error) {
            console.error("SendEmail error:", error);
            throw new Error("SendEmail failed: " + error.message);
        }
    }

    async handleSysInfo() {
        return new Promise((resolve, reject) => {
            const requestId = crypto.randomUUID();
            const handler = (event) => {
                const data = event.data;
                if (data.requestId !== requestId) return;
                window.chrome.webview.removeEventListener('message', handler);
                if (data.type === 'sysInfo') {
                    if (data.status === 0) {
                        resolve(data.output || "No system information available");
                    } else {
                        reject(new Error(data.output || "Failed to retrieve system information"));
                    }
                }
            };
            window.chrome.webview.addEventListener('message', handler);
            this.webWrap.sendMessage("sysInfo", { requestId });
        });
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