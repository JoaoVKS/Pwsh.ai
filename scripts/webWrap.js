class WebWrapClient {
    constructor() {
        this.handlers = new Map();
        window.chrome?.webview?.addEventListener("message", (event) => {
            //RECEIVE MESSAGES
            const message = event.data;
            if (!message?.type) {
                return;
            }
            console.log("Received message:", message);
            const callbacks = this.handlers.get(message.type) || [];
            callbacks.forEach((callback) => callback(message));
        });
    }

    sendMessage(type, data = {}) {
        //SEND MESSAGES
        const payload = {
            type,
            requestId: data.requestId || crypto.randomUUID(),
            ...data
        };
        window.chrome?.webview?.postMessage(payload);
        return payload.requestId;
    }

    onMessage(type, callback) {
        const list = this.handlers.get(type) || [];
        list.push(callback);
        this.handlers.set(type, list);
    }

    // PowerShell methods
    createPwsh(name, asyncOutput = true) {
        return this.sendMessage("pwshNew", { name, keepOpen: true, asyncOutput });
    }

    sendCommand(requestId, command) {
        return this.sendMessage("pwshInput", { requestId, command });
    }

    killPwsh(requestId) {
        return this.sendMessage("pwshKill", { requestId });
    }

    stopCommand(requestId) {
        return this.sendMessage("pwshStop", { requestId });
    }

    reloadBrowser() {
        return this.sendMessage("brwsReload", {});
    }

    // HTTP methods
    async ProxyFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const requestId = crypto.randomUUID();
            const handler = (event) => {
                const data = event.data;
                if (data.requestId !== requestId) return;
                window.chrome.webview.removeEventListener('message', handler);
                if (data.type === 'httpResponse') {
                    resolve({
                        ok: data.status >= 200 && data.status < 300,
                        status: data.status,
                        statusText: data.statusText,
                        headers: data.headers,
                        text: async () => data.body,
                        json: async () => JSON.parse(data.body)
                    });
                } else if (data.type === 'httpError') {
                    data.statusText = this._decodeUnicodeEscapes(data.statusText);
                    reject(new Error(this._decodeUnicodeEscapes(data.statusText) || 'HTTP request failed'));
                    console.error('HTTP request error:', this._decodeUnicodeEscapes(data.statusText), data);
                }
            };
            window.chrome.webview.addEventListener('message', handler);
            const message = {
                type: 'httpRequest',
                requestId: requestId,
                url: url,
                method: options.method || 'GET',
                headers: options.headers || {},
                body: options.body,
                contentType: options.contentType || 'application/json'
            };
            window.chrome.webview.postMessage(message);
        });
    }

    _decodeUnicodeEscapes(s) {
        return s.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
}

window.WebWrapClient = WebWrapClient;
// Create a global instance of the WebWrapClient to be used throughout the app
const webWrap = new WebWrapClient();