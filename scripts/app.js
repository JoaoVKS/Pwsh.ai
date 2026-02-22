// AI Assistant — Main Application Logic
// Modules: Image Attachment, Voice Recognition, Chat UI
let config = {};
let aiTools = null; // AiTools instance — initialised after DOM ready
let modelContextLength = null; // Model context window size fetched from OpenRouter API

// Build the effective system prompt from config
function buildSystemPrompt() {
    return config?.ai?.systemPrompt || '';
}

function playSound(soundPath) {
  let soundEffect = new Audio(soundPath);
  soundEffect.onended = function() {
        this.src = "";
        this.remove();
        soundEffect = null;
    };
  soundEffect.play();

}

document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        if (typeof webWrap === 'undefined') {
        document.body.innerHTML = '<h2 style="color:red;padding:2rem;">Error: webWrap.js not found</h2>';
        return;
    }
    try {
        const response = await fetch('./scripts/config.json');
        config = await response.json();
        console.log(config);
        checkConfig();
        updateModelIndicator();

        // Initialise tool engine after config is loaded so it has access to API keys
        if (typeof AiTools !== 'undefined') {
            aiTools = new AiTools(config);
        } else {
            console.warn('AiTools class not found — tool calling disabled');
        }
        } catch (error) {
            console.error('Could not load JSON:', error);
        }
    })();

    AssistantApp.init();
    SettingsModal.init();
    initClippyEasterEgg();
    initResizeHandle();
});


// ================================
//  Config Validation
// ================================
function checkConfig() {
    const ai = config?.ai || {};
    const openrouterKey = ai.openrouter?.apiKey || '';
    const isOpenrouterDefault = !openrouterKey || openrouterKey === 'YOUR_OPENROUTER_API_KEY';
    
    // If both API keys are empty or have default values, open the configuration modal
    if (isOpenrouterDefault) {
        // Both unconfigured — force user to configure
        setTimeout(() => SettingsModal.openModal(), 100);
    } else {
        // Auto-fallback: use OpenRouter since Gemini is not configured
        config.ai.provider = 'openrouter';
        updateModelIndicator();
    } 
}

// ================================
//  Model Indicator
// ================================
async function fetchModelContextLength(apiKey, model) {
    try {
        const response = await webWrap.ProxyFetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) return null;
        const json = await response.json();
        const found = (json.data || []).find(m => m.id === model);
        const ctxLen = found?.context_length ?? null;
        if (ctxLen) console.log(`Context window for ${model}: ${ctxLen}`);
        return ctxLen;
    } catch (err) {
        console.warn('fetchModelContextLength failed:', err);
        return null;
    }
}

async function updateModelIndicator() {
    const ai = config?.ai || {};
    const provider = ai.provider || '—';

    const providerEl = document.getElementById('model-provider-label');
    const modelEl    = document.getElementById('model-name-label');
    if (providerEl) providerEl.textContent = provider;
    if (modelEl)    modelEl.textContent    = config?.ai?.openrouter?.model || '—';

    // Fetch context window size for the active model
    const apiKey = ai.openrouter?.apiKey || '';
    const model  = ai.openrouter?.model  || '';
    const isDefault = !apiKey || apiKey === 'YOUR_OPENROUTER_API_KEY';
    if (!isDefault && model) {
        modelContextLength = await fetchModelContextLength(apiKey, model);
    } else {
        modelContextLength = null;
    }
    updateContextUsage(0, 0);
}

function updateContextUsage(promptTokens, completionTokens) {
    const el = document.getElementById('context-usage');
    if (!el) return;

    const total = (promptTokens || 0) + (completionTokens || 0);

    if (!modelContextLength) {
        // Context window unknown — show raw count only if non-zero
        if (total === 0) {
            el.innerHTML = '';
            return;
        }
        el.innerHTML = `<span class="context-label">${total.toLocaleString()} tokens</span>`;
        return;
    }

    const pct = Math.min((total / modelContextLength) * 100, 100);
    const color = pct >= 85 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e';

    el.innerHTML = `
        <div class="context-bar-wrap">
            <span class="context-label">${total.toLocaleString()} / ${modelContextLength.toLocaleString()}</span>
            <div class="context-bar-bg">
                <div class="context-bar-fill" style="width:${pct.toFixed(1)}%;background:${color};"></div>
            </div>
            <span class="context-pct">${pct.toFixed(1)}%</span>
        </div>
    `;
}

// ================================
//  Settings Modal
// ================================
const SettingsModal = (() => {
    let overlay, saveBtn, cancelBtn, closeBtn;

    function init() {
        overlay   = document.getElementById('settings-modal');
        saveBtn   = document.getElementById('btn-modal-save');
        cancelBtn = document.getElementById('btn-modal-cancel');
        closeBtn  = document.getElementById('modal-close-btn');

        document.getElementById('settings-btn').addEventListener('click', openModal);
        document.getElementById('reset-btn').addEventListener('click', () => webWrap.reloadBrowser());
        closeBtn .addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        saveBtn  .addEventListener('click', saveAndRestart);

        // Reveal / hide API key buttons
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest('.reveal-btn');
            if (!btn) return;
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.querySelector('.eye-icon')    .style.display = show ? 'none'  : '';
            btn.querySelector('.eye-off-icon').style.display = show ? ''      : 'none';
        });

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !overlay.hidden) closeModal();
        });
    }

    function openModal() {
        // Populate fields from current config
        const ai = config?.ai || {};
        const providerSel = document.getElementById('cfg-provider');
        providerSel.value = ai.provider || 'openrouter';

        document.getElementById('cfg-openrouter-apikey').value  = ai.openrouter?.apiKey  || '';
        document.getElementById('cfg-openrouter-model').value   = ai.openrouter?.model   || '';
        document.getElementById('cfg-openrouter-enable-tools').checked = ai.openrouter?.enableTools !== false;
        document.getElementById('cfg-bravesearch-apikey').value = ai.toolsAuth?.braveSearch?.apiKey || '';
        document.getElementById('cfg-systemprompt').value       = ai.systemPrompt        || '';

        overlay.hidden = false;
    }

    function closeModal() {
        overlay.hidden = true;
        // Reset API key visibility
        ['cfg-openrouter-apikey', 'cfg-bravesearch-apikey'].forEach(id => {
            const input = document.getElementById(id);
            if (!input || input.type === 'password') return;
            input.type = 'password';
            const btn = overlay.querySelector(`.reveal-btn[data-target="${id}"]`);
            if (btn) {
                btn.querySelector('.eye-icon')    .style.display = '';
                btn.querySelector('.eye-off-icon').style.display = 'none';
            }
        });
    }

    async function saveAndRestart() {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        const newConfig = {
            ai: {
                provider: document.getElementById('cfg-provider').value,
                openrouter: {
                    apiKey:       document.getElementById('cfg-openrouter-apikey').value,
                    model:        document.getElementById('cfg-openrouter-model').value,
                    enableTools:  document.getElementById('cfg-openrouter-enable-tools').checked
                },
                toolsAuth: {
                    braveSearch: {
                        apiKey: document.getElementById('cfg-bravesearch-apikey').value
                    }
                },
                systemPrompt: document.getElementById('cfg-systemprompt').value,
            }
        };

        const jsonStr = JSON.stringify(newConfig, null, 4);

        // Encode as base64 for safe PowerShell transfer
        const b64 = btoa(unescape(encodeURIComponent(jsonStr)));

        try {
            // Spawn a dedicated writer session
            const writerId = webWrap.createPwsh('cfg-writer', false);
            await waitMs(600);

            const psCmd = [
                `$raw = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}'))`,
                `[System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath('./scripts/config.json'), $raw, [System.Text.Encoding]::UTF8)`,
                `Write-Output 'CFG_SAVED'`
            ].join('; ');

            webWrap.sendCommand(writerId, psCmd);
            await waitMs(800);
            webWrap.killPwsh(writerId);
        } catch (err) {
            console.error('Error writing config:', err);
        }

        // Kill the main AI session before reload
        AssistantApp.killSession();
        await waitMs(300);
        try {
            const response = await fetch('./scripts/config.json');
            config = await response.json();
        }
        catch (error)
        {
            console.error('Could not load JSON after saving:', error);
        }
        webWrap.reloadBrowser();
        
    }

    function waitMs(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    return { init, openModal };
})();

const AssistantApp = (() => {
    // --- State ---
    let attachedImages = [];
    let recognition = null;
    let isRecording = false;
    let silenceTimer = null;
    const SILENCE_TIMEOUT = 3000;

    let conversationHistory = [];
    let loopAborted = false;

    let audioCtx = null;
    let analyser = null;
    let micSource = null;
    let animFrameId = null;

    const dom = {};

    function cacheDom() {
        dom.chatArea = document.getElementById('chat-area');
        dom.messageInput = document.getElementById('message-input');
        dom.sendBtn = document.getElementById('send-btn');
        dom.stopBtn = document.getElementById('stop-btn');
        dom.attachBtn = document.getElementById('attach-btn');
        dom.fileInput = document.getElementById('file-input');
        dom.micBtn = document.getElementById('mic-btn');
        dom.previewStrip = document.getElementById('image-preview-strip');
        dom.voiceViz = document.getElementById('voice-visualizer');
        dom.voiceCanvas = document.getElementById('voice-canvas');
        dom.cmdPanelBody = document.getElementById('cmd-panel-body');
    }

    // ================================
    //  Initialization
    // ================================
    function init() {
        cacheDom();
        bindEvents();
        initSpeechRecognition();
        initCmdPanel();
        autoResizeTextarea();
        showEmptyState();
        dom.messageInput.focus();
        setupUnloadHandler();
        console.log('AI Assistant initialized');
    }
    
    // Cleanup PowerShell session before page unload
    function setupUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            if (pwshRequestId) {
                try {
                    webWrap.killPwsh(pwshRequestId);
                } catch (e) {
                    console.warn('Error killing session:', e);
                }
            }
        });
    }

    function bindEvents() {
        dom.sendBtn.addEventListener('click', handleSend);
        dom.stopBtn.addEventListener('click', () => { loopAborted = true; });
        dom.attachBtn.addEventListener('click', () => dom.fileInput.click());
        dom.fileInput.addEventListener('change', handleFilesSelected);
        dom.micBtn.addEventListener('click', toggleVoice);

        // Enter to send, Shift+Enter for new line
        dom.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Allow drag & drop images onto input container
        const container = document.querySelector('.input-container');
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.style.borderColor = '#3b82f6';
        });
        container.addEventListener('dragleave', () => {
            container.style.borderColor = '';
        });
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.style.borderColor = '';
            const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
            if (files.length) processFiles(files);
        });

        // Paste images from clipboard
        dom.messageInput.addEventListener('paste', (e) => {
            const items = [...(e.clipboardData?.items || [])];
            const imageItems = items.filter(i => i.type.startsWith('image/'));
            if (imageItems.length) {
                e.preventDefault();
                const files = imageItems.map(i => i.getAsFile()).filter(Boolean);
                processFiles(files);
            }
        });
    }

    // ================================
    //  Textarea Auto-resize
    // ================================
    function autoResizeTextarea() {
        dom.messageInput.addEventListener('input', () => {
            dom.messageInput.style.height = 'auto';
            dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 140) + 'px';
        });
    }

    // ================================
    //  Image Attachment (FileReader)
    // ================================
    function handleFilesSelected(e) {
        const files = [...e.target.files];
        processFiles(files);
        e.target.value = ''; // Reset so same file can be re-selected
    }

    function processFiles(files) {
        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const entry = { file, dataUrl: ev.target.result };
                attachedImages.push(entry);
                renderPreviewThumb(entry);
            };
            reader.readAsDataURL(file);
        });
    }

    function renderPreviewThumb(entry) {
        const thumb = document.createElement('div');
        thumb.className = 'preview-thumb';

        const img = document.createElement('img');
        img.src = entry.dataUrl;
        img.alt = entry.file.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-thumb';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', () => {
            attachedImages = attachedImages.filter(e => e !== entry);
            thumb.remove();
        });

        thumb.appendChild(img);
        thumb.appendChild(removeBtn);
        dom.previewStrip.appendChild(thumb);
    }

    // ================================
    //  Speech Recognition (Web Speech API)
    // ================================
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            dom.micBtn.title = 'Reconhecimento de voz não suportado neste navegador';
            dom.micBtn.style.opacity = '0.35';
            dom.micBtn.style.cursor = 'not-allowed';
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = true;
        recognition.continuous = true;

        let finalTranscript = '';
        let hasVoiceContent = false;

        recognition.onstart = () => {
            isRecording = true;
            hasVoiceContent = false;
            finalTranscript = '';
            dom.micBtn.classList.add('recording');
            startVisualizer();
        };

        recognition.onresult = (event) => {
            let interim = '';
            finalTranscript = '';

            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }

            const baseText = dom.messageInput.dataset.preVoiceText || '';
            dom.messageInput.value = baseText + finalTranscript + interim;
            dom.messageInput.dispatchEvent(new Event('input'));

            // Reset silence timer — only if we have actual content
            if (finalTranscript.trim() || interim.trim()) {
                hasVoiceContent = true;
                clearTimeout(silenceTimer);
                silenceTimer = setTimeout(() => {
                    if (isRecording) {
                        recognition.stop(); // will trigger onend → auto-send
                    }
                }, SILENCE_TIMEOUT);
            }
        };

        recognition.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            stopRecording();
        };

        recognition.onend = () => {
            clearTimeout(silenceTimer);
            if (finalTranscript.trim()) {
                const baseText = dom.messageInput.dataset.preVoiceText || '';
                dom.messageInput.value = baseText + finalTranscript.trim();
                dom.messageInput.dispatchEvent(new Event('input'));
            }
            stopRecording();

            // Auto-send only if voice actually captured new content
            if (hasVoiceContent && dom.messageInput.value.trim()) {
                handleSend();
            }
            hasVoiceContent = false;
        };
    }

    function toggleVoice() {
        if (!recognition) return;

        if (isRecording) {
            playSound('./assets/sent_voice.mp3');
            recognition.stop();
        } else {
            playSound('./assets/start_voice.mp3');
            dom.messageInput.dataset.preVoiceText = dom.messageInput.value;
            recognition.start();
        }
    }

    function stopRecording() {
        isRecording = false;
        clearTimeout(silenceTimer);
        dom.micBtn.classList.remove('recording');
        stopVisualizer();
        delete dom.messageInput.dataset.preVoiceText;
    }

    // ================================
    //  Audio Visualizer (Web Audio API)
    // ================================
    async function startVisualizer() {
        dom.voiceViz.classList.add('active');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.75;

            micSource = audioCtx.createMediaStreamSource(stream);
            micSource.connect(analyser);

            drawWave();
        } catch (err) {
            console.warn('Visualizer: could not access microphone', err);
        }
    }

    function stopVisualizer() {
        dom.voiceViz.classList.remove('active');
        cancelAnimationFrame(animFrameId);

        if (micSource) {
            micSource.mediaStream.getTracks().forEach(t => t.stop());
            micSource.disconnect();
            micSource = null;
        }
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
        }
        analyser = null;
    }

    function drawWave() {
        if (!analyser) return;

        const canvas = dom.voiceCanvas;
        const ctx = canvas.getContext('2d');

        // Match CSS size to pixel resolution
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const W = rect.width;
        const H = rect.height;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const BAR_COUNT = 48;
        const BAR_GAP = 3;
        const totalBarWidth = (W - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;
        const barWidth = Math.max(totalBarWidth, 2);
        const minH = 3;

        function frame() {
            animFrameId = requestAnimationFrame(frame);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, W, H);

            for (let i = 0; i < BAR_COUNT; i++) {
                // Map bar index to frequency bin
                const binIndex = Math.floor((i / BAR_COUNT) * bufferLength);
                const value = dataArray[binIndex] / 255;
                const barH = Math.max(value * H * 0.85, minH);

                const x = i * (barWidth + BAR_GAP);
                const y = (H - barH) / 2;

                // Gradient from blue to cyan
                const t = i / BAR_COUNT;
                const r = Math.round(37 + t * 20);
                const g = Math.round(99 + t * 80);
                const b = Math.round(235 - t * 30);
                const alpha = 0.6 + value * 0.4;

                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, barH, barWidth / 2);
                ctx.fill();
            }
        }

        frame();
    }

    // ================================
    //  Send Message
    // ================================

    function renderMarkdownInBubble(bubble, text) {
        if (!text || typeof marked === 'undefined') return;
        const content = bubble.querySelector('.message-content') || bubble;
        const md = document.createElement('div');
        md.className = 'markdown-body';
        marked.use({ gfm: true, breaks: true });
        md.innerHTML = marked.parse(text);
        content.innerHTML = '';
        content.appendChild(md);
    }

    // Render assistant message text as a DOM element (plain text, pre-wrap)
    function processMessageText(text) {
        const container = document.createElement('div');
        container.className = 'message-content';

        if (text) {
            const span = document.createElement('span');
            span.style.display = 'block';
            span.style.whiteSpace = 'pre-wrap';
            span.style.wordWrap = 'break-word';
            span.textContent = text;
            container.appendChild(span);
        }

        return container;
    }

    function createTextElement(bubble) {
        const p = document.createElement('p');
        bubble.appendChild(p);
        return p;
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }



    async function handleSend() {
        const text = dom.messageInput.value.trim();
        const images = [...attachedImages];

        if (!text && images.length === 0) return;

        // Clear empty state on first message
        const emptyState = dom.chatArea.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        // Build user bubble
        addMessageBubble('user', text, images);

        // Build content parts in OpenAI format
        const contentParts = [];
        images.forEach(entry => {
            const base64 = entry.dataUrl.split(',')[1];
            const mimeType = entry.dataUrl.match(/data:(.*?);/)[1];
            contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } });
        });
        if (text) contentParts.push({ type: 'text', text });

        // Push to history in OpenAI format (single text → string; multimodal → array)
        conversationHistory.push({
            role: 'user',
            content: contentParts.length === 1 && contentParts[0].type === 'text' ? text : contentParts
        });

        // Trim history to avoid memory/token limits
        const MAX_TURNS = 50;
        if (conversationHistory.length > MAX_TURNS) {
            conversationHistory = conversationHistory.slice(-MAX_TURNS);
        }

        // Reset input
        dom.messageInput.value = '';
        dom.messageInput.style.height = 'auto';
        attachedImages = [];
        dom.previewStrip.innerHTML = '';
        dom.messageInput.focus();

        // Agentic loop driven by native tool_calls protocol
        loopAborted = false;
        dom.stopBtn.style.display = 'flex';
        dom.sendBtn.disabled = true;

        try {
            while (!loopAborted) {
                const aiResult = await sendToAI();
                if (!aiResult) break;

                const { text: responseText, toolCalls, finishReason, bubble: responseBubble } = aiResult;

                if (finishReason === 'tool_calls' && toolCalls && toolCalls.length > 0) {
                    // Push assistant turn with tool_calls into history
                    conversationHistory.push({
                        role: 'assistant',
                        content: responseText || null,
                        tool_calls: toolCalls.map(tc => ({
                            id: tc.id,
                            type: 'function',
                            function: {
                                name: tc.function.name,
                                arguments: JSON.stringify(tc.function.arguments)
                            }
                        }))
                    });

                    // Execute all tools; collect results
                    console.log('Tool calls:', toolCalls.map(tc => tc.function.name));
                    const toolResults = await executeNativeToolCalls(toolCalls, responseBubble);

                    // Push one tool-role message per result
                    for (const tr of toolResults) {
                        conversationHistory.push({ role: 'tool', tool_call_id: tr.id, content: tr.output });
                    }
                    // Loop continues — model will consume results and respond
                } else {
                    // Final text response — stop loop
                    if (responseText) {
                        conversationHistory.push({ role: 'assistant', content: responseText });
                    }
                    if (responseBubble) {
                        responseBubble.classList.add('ai-final-response');
                        renderMarkdownInBubble(responseBubble, responseText);
                    }
                    break;
                }
            }
        } finally {
            dom.stopBtn.style.display = 'none';
            dom.sendBtn.disabled = false;
        }
    }

    // ================================
    //  AI API (OpenRouter)
    // ================================

    async function sendToAI() {
        const provider = config.ai.provider || 'openrouter';
        if (provider === 'openrouter') {
            return sendToOpenRouter();
        } 
    }

    // --- OpenRouter Provider ---
    async function sendToOpenRouter(retryCount = 0) {
        const MAX_RETRIES = 3;
        const cfg = config.ai.openrouter;
        const apiKey = cfg.apiKey;
        const model = cfg.model || 'google/gemini-2.0-flash-exp:free';
        const url = 'https://openrouter.ai/api/v1/chat/completions';

        // Show typing indicator
        const typingBubble = addMessageBubble('assistant', '');
        const textEl = typingBubble.querySelector('p') || createTextElement(typingBubble);
        textEl.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';

        // History is already in OpenAI format — use directly
        const messages = [];
        const effectiveSystemPrompt = buildSystemPrompt();
        if (effectiveSystemPrompt) {
            messages.push({ role: 'system', content: effectiveSystemPrompt });
        }
        messages.push(...conversationHistory);

        const enableTools = cfg.enableTools !== false && aiTools;
        const body = {
            model: model,
            messages: messages,
            stream: true,
            ...(enableTools && {
                tools: aiTools.ListTools(),
                tool_choice: 'auto'
            })
        };

        try {
            const response = await webWrap.ProxyFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://assistant.local',
                    'X-Title': 'AI Assistant'
                },
                body: JSON.stringify(body)
            });

            if (response.status === 429 && retryCount < MAX_RETRIES) {
                const errBody = await response.text();
                const delayMatch = errBody.match(/retry in ([\d.]+)s/i);
                const waitSec = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) : 5;

                for (let s = waitSec; s > 0; s--) {
                    textEl.textContent = `Rate limit atingido. Tentando novamente em ${s}s...`;
                    await new Promise(r => setTimeout(r, 1000));
                }
                textEl.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';
                typingBubble.remove();
                return sendToOpenRouter(retryCount + 1);
            }

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`API ${response.status}: ${err}`);
            }

            // ProxyFetch returns full body at once (SSE lines all arrive together)
            const responseText = await response.text();
            let fullText = '';
            let finishReason = 'stop';

            // Accumulate tool_calls fragments per index across all delta chunks
            const toolCallsMap = {};

            // Parse SSE stream
            const lines = responseText.split('\n');
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(jsonStr);

                    // Usage data — may appear on the final chunk (sometimes without choices)
                    if (parsed.usage) {
                        updateContextUsage(parsed.usage.prompt_tokens ?? 0, parsed.usage.completion_tokens ?? 0);
                    }

                    const choice = parsed.choices?.[0];
                    if (!choice) continue;

                    if (choice.finish_reason) finishReason = choice.finish_reason;

                    const delta = choice.delta;
                    if (!delta) continue;

                    // Text content
                    if (delta.content) {
                        fullText += delta.content;
                        textEl.textContent = fullText;
                        dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
                    }

                    // Tool calls (fragmented across chunks — accumulate by index)
                    if (delta.tool_calls) {
                        for (const tc of delta.tool_calls) {
                            const idx = tc.index ?? 0;
                            if (!toolCallsMap[idx]) {
                                toolCallsMap[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                            }
                            if (tc.id) toolCallsMap[idx].id = tc.id;
                            if (tc.type) toolCallsMap[idx].type = tc.type;
                            if (tc.function?.name) toolCallsMap[idx].function.name += tc.function.name;
                            if (tc.function?.arguments) toolCallsMap[idx].function.arguments += tc.function.arguments;
                        }
                    }
                } catch (e) { /* skip malformed lines */ }
            }

            // Fallback: try as non-streaming JSON if SSE parsing yielded nothing
            if (!fullText && Object.keys(toolCallsMap).length === 0) {
                try {
                    const parsed = JSON.parse(responseText);
                    fullText = parsed.choices?.[0]?.message?.content || '';
                    finishReason = parsed.choices?.[0]?.finish_reason || 'stop';

                    // Non-streaming tool_calls
                    const msgToolCalls = parsed.choices?.[0]?.message?.tool_calls;
                    if (msgToolCalls) {
                        msgToolCalls.forEach((tc, idx) => {
                            toolCallsMap[idx] = { id: tc.id, type: tc.type, function: { name: tc.function.name, arguments: tc.function.arguments } };
                        });
                    }

                    if (fullText) {
                        textEl.textContent = fullText;
                        dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
                    }

                    // Capture usage from non-streaming response
                    if (parsed.usage) {
                        updateContextUsage(parsed.usage.prompt_tokens ?? 0, parsed.usage.completion_tokens ?? 0);
                    }
                } catch (e) { /* skip */ }
            }

            // Build structured tool_calls array with parsed arguments
            const toolCalls = Object.values(toolCallsMap).map(tc => ({
                id: tc.id,
                type: tc.type,
                function: {
                    name: tc.function.name,
                    arguments: (() => {
                        try { return JSON.parse(tc.function.arguments); }
                        catch { return { _raw: tc.function.arguments }; }
                    })()
                }
            }));

            // Render bubble: tool call badges OR final text
            if (toolCalls.length > 0) {
                typingBubble.innerHTML = '';
                typingBubble.appendChild(createToolCallBadges(toolCalls));
            } else if (fullText) {
                typingBubble.innerHTML = '';
                typingBubble.appendChild(processMessageText(fullText));
            } else {
                typingBubble.innerHTML = '';
                const p = document.createElement('p');
                p.textContent = '(Sem resposta do modelo)';
                typingBubble.appendChild(p);
            }

            return { text: fullText, toolCalls, finishReason, bubble: typingBubble };

        } catch (error) {
            console.error('OpenRouter API error:', error);
            typingBubble.innerHTML = '';
            const p = document.createElement('p');
            const isTimeout = error.message?.toLowerCase().includes('timeout') ||
                              error.message?.toLowerCase().includes('cancelled');
            p.textContent = isTimeout
                ? `Erro: Timeout na API (${model}). Este modelo pode não suportar tool calling — tente desativar "enableTools" nas configurações ou mude para um modelo compatível (ex: openai/gpt-4o-mini).`
                : `Erro: ${error.message}`;
            p.style.color = '#ef4444';
            typingBubble.appendChild(p);
            typingBubble.classList.add('error');
            return null;
        }
    }

    // ================================
    //  Tool Call Badges (chat bubble)
    // ================================
    function createToolCallBadges(toolCalls) {
        const container = document.createElement('div');
        container.className = 'message-content';

        for (const tc of toolCalls) {
            const badge = document.createElement('div');
            badge.className = 'tool-call-badge';
            badge.dataset.toolCallId = tc.id;

            const headerRow = document.createElement('div');
            headerRow.className = 'tool-call-header';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'tool-call-icon';
            iconSpan.textContent = tc.function.name === 'PwshExec' ? '⚙️' : '🔧';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'tool-call-name';
            nameSpan.textContent = tc.function.name;

            const statusSpan = document.createElement('span');
            statusSpan.className = 'tool-call-status tool-status-pending';
            statusSpan.textContent = 'pending';

            headerRow.appendChild(iconSpan);
            headerRow.appendChild(nameSpan);
            headerRow.appendChild(statusSpan);
            badge.appendChild(headerRow);

            const argsStr = JSON.stringify(tc.function.arguments);
            const argsEl = document.createElement('code');
            argsEl.className = 'tool-call-args';
            argsEl.dataset.fullArgs = argsStr;
            argsEl.textContent = argsStr.length > 120 ? argsStr.slice(0, 120) + '…' : argsStr;
            argsEl.innerHTML = argsEl.textContent + "<button type='button' onclick='copyArgs(this)' class='copy-args-btn' title='Copy tool arguments'>📋</button> ";
            badge.appendChild(argsEl);

            const resultEl = document.createElement('div');
            resultEl.className = 'tool-call-result';
            resultEl.style.display = 'none';
            badge.appendChild(resultEl);

            container.appendChild(badge);
        }

        return container;
    }

    function addMessageBubble(role, text, images = []) {
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${role}`;

        // Render images if any
        if (images.length > 0) {
            const imagesDiv = document.createElement('div');
            imagesDiv.className = 'msg-images';
            images.forEach(entry => {
                const img = document.createElement('img');
                img.src = entry.dataUrl;
                img.alt = 'attached image';
                imagesDiv.appendChild(img);
            });
            bubble.appendChild(imagesDiv);
        }

        // Render text
        if (text) {
            if (role === 'assistant') {
                // Process badges for assistant messages only
                const processedContent = processMessageText(text);
                bubble.appendChild(processedContent);
            } else {
                // User messages: plain text
                const p = document.createElement('p');
                p.textContent = text;
                bubble.appendChild(p);
            }
        }

        dom.chatArea.appendChild(bubble);
        dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
        return bubble;
    }

    // ================================
    //  Empty State
    // ================================
    function showEmptyState() {
        const div = document.createElement('div');
        div.className = 'empty-state';
        div.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Send a message to get started!</span>
        `;
        dom.chatArea.appendChild(div);
    }

    // ================================
    //  CMD Side Panel
    // ================================
    let pwshRequestId = null; // requestId returned by webWrap.createPwsh

    function initCmdPanel() {
        if (!webWrap) return;

        // Async (streaming) output — detect the done marker here
        webWrap.onMessage('pwshAsyncOutput', (message) => {
            if (message.requestId !== pwshRequestId) return;
            const entry = cmdManager.getActiveEntry();
            if (!entry) return;

            const text = message.output || '';

            // Check if this chunk contains our done marker
            if (entry.doneMarker && text.includes(entry.doneMarker)) {
                // Strip the marker line from visible output
                const clean = text.replace(entry.doneMarker, '').trim();
                if (clean) entry.appendOutput(clean);

                // Command finished
                entry.setStatus('done', '#22c55e');
                entry.showSpinner(false);
                entry.showStopBtn(false);
                entry.resolve?.(entry.getOutput());
                return;
            }

            entry.appendOutput(text);
            entry.setStatus('running', '#3b82f6');
        });

        // pwshResult — handle errors or session-level events
        webWrap.onMessage('pwshResult', (message) => {
            if (message.requestId !== pwshRequestId) return;
            const entry = cmdManager.getActiveEntry();
            if (!entry) return;

            if (message.status !== 0) {
                entry.appendOutput(`\n${message.output || ''}`);
                entry.setStatus('error', '#ef4444');
                entry.showSpinner(false);
                entry.showStopBtn(false);
                entry.resolve?.(entry.getOutput());
            }
        });

        webWrap.onMessage('error', (message) => {
            console.error('WebWrap error:', message.message);
            const entry = cmdManager.getActiveEntry();
            if (entry) {
                entry.appendOutput(`\n[Error] ${message.message}`);
                entry.setStatus('error', '#ef4444');
                entry.showSpinner(false);
                entry.showStopBtn(false);
                entry.resolve?.(entry.getOutput());
            }
        });
    }

    // ================================
    //  Command Entry Class
    // ================================
    class CmdEntry {
        constructor(id, command) {
            this.id = id;
            this.command = command;
            this.resolve = null;    // set by executePwshCommand to resolve the output promise
            this.doneMarker = null; // unique marker echoed after the command to detect completion

            this.element = document.createElement('div');
            this.element.className = 'cmd-entry';
            this.element.dataset.cmdId = id;

            this.label = document.createElement('div');
            this.label.className = 'cmd-entry-label';
            this.label.textContent = command.length > 60 ? command.slice(0, 60) + '…' : command;

            this.statusRow = document.createElement('div');
            this.statusRow.className = 'cmd-entry-status';

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.alignItems = 'center';
            left.style.gap = '6px';

            this.spinner = document.createElement('div');
            this.spinner.className = 'cmd-spinner';
            this.spinner.style.display = 'none';

            this.statusText = document.createElement('span');
            this.statusText.textContent = 'Aguardando confirmação';

            left.appendChild(this.spinner);
            left.appendChild(this.statusText);

            // Confirm button
            this.confirmBtn = document.createElement('button');
            this.confirmBtn.className = 'cmd-confirm-btn';
            this.confirmBtn.textContent = 'Executar';
            this.confirmBtn.style.cssText = `
                padding: 6px 12px;
                background: #f59e0b;
                color: #000;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: background 0.2s;
            `;
            this.confirmBtn.onmouseover = () => (this.confirmBtn.style.background = '#d97706');
            this.confirmBtn.onmouseout = () => (this.confirmBtn.style.background = '#f59e0b');

            // Stop button (Ctrl+C)
            this.stopBtn = document.createElement('button');
            this.stopBtn.className = 'cmd-stop-btn';
            this.stopBtn.textContent = 'Stop';
            this.stopBtn.style.cssText = `
                padding: 6px 12px;
                background: #ef4444;
                color: #fff;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                display: none;
                transition: background 0.2s;
            `;
            this.stopBtn.onmouseover = () => (this.stopBtn.style.background = '#dc2626');
            this.stopBtn.onmouseout = () => (this.stopBtn.style.background = '#ef4444');
            this.stopBtn.addEventListener('click', () => this.stop());

            this.statusRow.appendChild(left);
            this.statusRow.appendChild(this.confirmBtn);
            this.statusRow.appendChild(this.stopBtn);

            // Output toggle row (chevron + line count)
            this.toggleRow = document.createElement('div');
            this.toggleRow.className = 'cmd-output-toggle';
            this.toggleRow.addEventListener('click', () => this.toggleOutput());

            const chevron = document.createElement('em');
            chevron.className = 'cmd-output-chevron';
            chevron.textContent = '▶';

            this.toggleLabel = document.createElement('span');
            this.toggleLabel.textContent = 'Output';

            this.toggleRow.appendChild(chevron);
            this.toggleRow.appendChild(this.toggleLabel);

            this.outputArea = document.createElement('pre');
            this.outputArea.className = 'cmd-entry-output';

            this.element.appendChild(this.label);
            this.element.appendChild(this.statusRow);
            this.element.appendChild(this.toggleRow);
            this.element.appendChild(this.outputArea);
        }

        toggleOutput(forceExpand) {
            const shouldExpand = forceExpand !== undefined ? forceExpand : !this.toggleRow.classList.contains('expanded');
            this.toggleRow.classList.toggle('expanded', shouldExpand);
            this.outputArea.classList.toggle('expanded', shouldExpand);
            if (shouldExpand) {
                setTimeout(() => {
                    this.outputArea.scrollTop = this.outputArea.scrollHeight;
                }, 260);
            }
        }

        stop() {
            if (!pwshRequestId) return;
            webWrap.stopCommand(pwshRequestId);
            this.appendOutput('\n[Command interrupted]');
            this.setStatus('stopped', '#f59e0b');
            this.showSpinner(false);
            this.showStopBtn(false);
            this.resolve?.(this.getOutput());
        }

        appendOutput(text) {
            if (!text) return;
            this.outputArea.textContent += text;
            // Show toggle row once there's output
            this.toggleRow.classList.add('visible');
            // Update line count label
            const lines = this.outputArea.textContent.split('\n').filter(l => l.trim()).length;
            this.toggleLabel.textContent = `Output (${lines} line${lines !== 1 ? 's' : ''})`;
            if (this.outputArea.classList.contains('expanded')) {
                setTimeout(() => {
                    this.outputArea.scrollTop = this.outputArea.scrollHeight;
                    dom.cmdPanelBody.scrollTop = dom.cmdPanelBody.scrollHeight;
                }, 0);
            }
        }

        getOutput() {
            return this.outputArea.textContent.trim();
        }

        setStatus(status, color = null) {
            this.statusText.textContent = status;
            if (color) this.statusText.style.color = color;
        }

        showSpinner(show = true) {
            this.spinner.style.display = show ? 'block' : 'none';
        }

        showConfirmBtn(show = true) {
            this.confirmBtn.style.display = show ? '' : 'none';
        }

        showStopBtn(show = true) {
            this.stopBtn.style.display = show ? '' : 'none';
        }

        clear() {
            this.element.remove();
        }
    }

    // ================================
    //  Command Manager Class
    // ================================
    class CmdManager {
        constructor() {
            this.commands = new Map();
            this.activeEntryId = null;
        }

        addCommand(id, command) {
            const empty = dom.cmdPanelBody.querySelector('.cmd-empty');
            if (empty) empty.remove();

            const entry = new CmdEntry(id, command);
            this.commands.set(id, entry);
            dom.cmdPanelBody.appendChild(entry.element);
            dom.cmdPanelBody.scrollTop = dom.cmdPanelBody.scrollHeight;
            return entry;
        }

        getCommand(id) {
            return this.commands.get(id);
        }

        setActiveEntry(id) {
            this.activeEntryId = id;
        }

        getActiveEntry() {
            return this.activeEntryId ? this.commands.get(this.activeEntryId) : null;
        }

        removeCommand(id) {
            const entry = this.commands.get(id);
            if (entry) {
                entry.clear();
                this.commands.delete(id);
            }
            if (this.activeEntryId === id) this.activeEntryId = null;

            if (this.commands.size === 0 && !dom.cmdPanelBody.querySelector('.cmd-empty')) {
                const empty = document.createElement('div');
                empty.className = 'cmd-empty';
                empty.textContent = 'No running commands';
                dom.cmdPanelBody.appendChild(empty);
            }
        }
    }

    const cmdManager = new CmdManager();

    // ================================
    //  Execute a single PowerShell command (with confirm gate + real-time output)
    // ================================

    async function executePwshCommand(command) {
        if (!webWrap) throw new Error('WebWrap not available');

        // Create a PowerShell session if we don't have one
        if (!pwshRequestId) {
            pwshRequestId = webWrap.createPwsh('ai-agent', true);
        }

        const id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const entry = cmdManager.addCommand(id, command);
        cmdManager.setActiveEntry(id);

        // Wait for user to click "Executar" (confirmation gate)
        await new Promise((resolve) => {
            entry.confirmBtn.addEventListener('click', () => {
                entry.showConfirmBtn(false);
                entry.showSpinner(true);
                entry.showStopBtn(true);
                entry.setStatus('running', '#3b82f6');
                entry.toggleOutput(true); // auto-expand to show live output
                resolve();
            }, { once: true });
        });

        // Append a unique done-marker to detect command completion from async output
        const marker = `__DONE_${crypto.randomUUID().slice(0, 8)}__`;

        const output = await new Promise((resolve) => {
            entry.doneMarker = marker;
            entry.resolve = resolve;
            entry.appendOutput(`\n>> ${command}`);
            webWrap.sendCommand(pwshRequestId, `${command}; echo '${marker}'`);
        });

        cmdManager.setActiveEntry(null);
        return output || '(no output)';
    }

    // ================================
    //  Execute native tool_calls from OpenRouter response
    // ================================

    async function executeNativeToolCalls(toolCalls, typingBubble) {
        if (!aiTools) {
            console.warn('aiTools not available — cannot execute tool calls');
            return toolCalls.map(tc => ({ id: tc.id, output: 'Error: tool engine not initialised.' }));
        }

        const results = [];

        for (const tc of toolCalls) {
            const { name, arguments: args } = tc.function;

            // Find badge in the chat bubble for live status updates
            const badge = typingBubble?.querySelector(`.tool-call-badge[data-tool-call-id="${tc.id}"]`);
            const statusEl = badge?.querySelector('.tool-call-status');
            const resultEl = badge?.querySelector('.tool-call-result');

            const setStatus = (label, cssClass) => {
                if (!statusEl) return;
                statusEl.textContent = label;
                statusEl.className = `tool-call-status ${cssClass}`;
            };

            let output = '';
            try {
                setStatus('running…', 'tool-status-running');

                if (name === 'PwshExec') {
                    // PwshExec: requires confirm gate + real-time streaming output
                    const command = (typeof args === 'string') ? args : (args?.command ?? JSON.stringify(args));
                    output = await executePwshCommand(command);
                } else {
                    // All other tools: auto-run with side-panel indicator
                    const argPreview = JSON.stringify(args);
                    const panelId = `tool_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                    const panelLabel = `🔧 ${name}: ${argPreview.length > 50 ? argPreview.slice(0, 50) + '…' : argPreview}`;
                    const panelEntry = cmdManager.addCommand(panelId, panelLabel);
                    panelEntry.showConfirmBtn(false);
                    panelEntry.showSpinner(true);
                    panelEntry.setStatus('running', '#8b5cf6');

                    output = await aiTools.ToolCall(name, args);
                    output = String(output ?? '');

                    panelEntry.appendOutput(output.slice(0, 4000));
                    panelEntry.setStatus('done', '#22c55e');
                    panelEntry.showSpinner(false);
                }

                setStatus('done ✓', 'tool-status-done');
                if (resultEl) {
                    const preview = output.length > 400 ? output.slice(0, 400) + '\n… (truncated)' : output;
                    resultEl.textContent = preview;
                    resultEl.style.display = 'block';
                }
            } catch (err) {
                output = `Error: ${err.message}`;
                console.error(`Tool ${name} error:`, err);
                setStatus('error', 'tool-status-error');
                if (resultEl) {
                    resultEl.textContent = output;
                    resultEl.style.display = 'block';
                }
            }

            results.push({ id: tc.id, output: output || '(no output)' });
        }

        return results;
    }

    // --- Public API ---
    return {
        init,
        killSession() {
            if (pwshRequestId) {
                try { webWrap.killPwsh(pwshRequestId); } catch (e) {}
                pwshRequestId = null;
            }
        }
    };
})();

// ================================
//  Resizable Panel Divider
// ================================
function initResizeHandle() {
    const handle = document.getElementById('resize-handle');
    if (!handle) return;

    const layout = document.querySelector('.app-layout');
    const leftPanel = document.querySelector('.assistant-wrapper');
    const rightPanel = document.querySelector('.cmd-panel');

    if (!layout || !leftPanel || !rightPanel) return;

    let isDragging = false;
    let startX = 0;
    let startLeftWidth = 0;

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startLeftWidth = leftPanel.getBoundingClientRect().width;

        handle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const layoutRect = layout.getBoundingClientRect();
        const dx = e.clientX - startX;
        const newLeftWidth = startLeftWidth + dx;

        const minLeft = 300;
        const minRight = 200;
        const maxLeftWidth = layoutRect.width - minRight - handle.offsetWidth;

        const clampedWidth = Math.max(minLeft, Math.min(newLeftWidth, maxLeftWidth));
        const leftPercent = (clampedWidth / layoutRect.width) * 100;

        leftPanel.style.flex = 'none';
        leftPanel.style.width = leftPercent + '%';

        rightPanel.style.flex = '1';
        rightPanel.style.minWidth = minRight + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });

    // Double-click to reset to 50/50
    handle.addEventListener('dblclick', () => {
        leftPanel.style.flex = '1';
        leftPanel.style.width = '';
        rightPanel.style.flex = '1';
        rightPanel.style.minWidth = '';
    });
}

function copyArgs(button) {
    const argsEl = button.parentElement;
    if (!argsEl) return;
    const fullArgs = argsEl.dataset.fullArgs || argsEl.textContent || '';
    navigator.clipboard.writeText(fullArgs).then(() => {
        button.textContent = '✅';
        setTimeout(() => (button.textContent = '📋'), 2000);
    }).catch(() => {
        button.textContent = '❌';
        setTimeout(() => (button.textContent = '📋'), 2000);
    });
}

// ================================
//  Clippy Easter Egg
// ================================
function initClippyEasterEgg() {
    const clippy = document.querySelector('.PwshLogo');
    if (!clippy) return;

    let clicks = [];
    clippy.addEventListener('click', () => {
        const now = Date.now();
        clicks.push(now);
        // Keep only clicks within last 3 seconds
        clicks = clicks.filter(t => now - t <= 3000);

        if (clicks.length >= 2) {
            clicks = [];
            clippy.classList.remove('jump-spin');
            // Force reflow so re-adding the class restarts the animation
            void clippy.offsetWidth;
            clippy.classList.add('jump-spin');
            clippy.addEventListener('animationend', () => {
                clippy.classList.remove('jump-spin');
            }, { once: true });
        }
    });
}

