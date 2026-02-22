// AI Assistant — Main Application Logic
// Modules: Image Attachment, Voice Recognition, Chat UI
let config = {};
let aiTools = null; // AiTools instance — initialised after DOM ready

// Build the effective system prompt = user-defined prompt + tools description
function buildSystemPromptWithTools() {
    const base       = config?.ai?.systemPrompt || '';
    const toolsBlock = aiTools ? aiTools.getToolsSystemPrompt() : '';
    if (!toolsBlock) return base;
    return base ? `${base}\n\n---\n${toolsBlock}` : toolsBlock;
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
    const geminiKey = ai.gemini?.apiKey || '';
    const openrouterKey = ai.openrouter?.apiKey || '';
    
    const isGeminiDefault = !geminiKey || geminiKey === 'YOUR_GEMINI_API_KEY';
    const isOpenrouterDefault = !openrouterKey || openrouterKey === 'YOUR_OPENROUTER_API_KEY';
    
    // If both API keys are empty or have default values, open the configuration modal
    if (isGeminiDefault && isOpenrouterDefault) {
        // Both unconfigured — force user to configure
        setTimeout(() => SettingsModal.openModal(), 100);
    } else if (isGeminiDefault) {
        // Auto-fallback: use OpenRouter since Gemini is not configured
        config.ai.provider = 'openrouter';
        updateModelIndicator();
    } else if (isOpenrouterDefault) {
        // Auto-fallback: use Gemini since OpenRouter is not configured
        config.ai.provider = 'gemini';
        updateModelIndicator();
    }
}

// ================================
//  Model Indicator
// ================================
function updateModelIndicator() {
    const ai = config?.ai || {};
    const provider = ai.provider || '—';
    const model = provider === 'gemini'
        ? (ai.gemini?.model || '—')
        : (ai.openrouter?.model || '—');

    const providerEl = document.getElementById('model-provider-label');
    const modelEl    = document.getElementById('model-name-label');
    if (providerEl) providerEl.textContent = provider;
    if (modelEl)    modelEl.textContent    = model;
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

        document.getElementById('cfg-gemini-apikey').value      = ai.gemini?.apiKey      || '';
        document.getElementById('cfg-gemini-model').value       = ai.gemini?.model       || '';
        document.getElementById('cfg-openrouter-apikey').value  = ai.openrouter?.apiKey  || '';
        document.getElementById('cfg-openrouter-model').value   = ai.openrouter?.model   || '';
        document.getElementById('cfg-bravesearch-apikey').value = ai.toolsAuth?.braveSearch?.apiKey || '';
        document.getElementById('cfg-systemprompt').value       = ai.systemPrompt        || '';
        // Fall back to generated default when not yet saved
        document.getElementById('cfg-toolsprompt').value        =
            ai.toolsPrompt !== undefined
                ? ai.toolsPrompt
                : (aiTools ? aiTools.getToolsSystemPrompt() : '');

        overlay.hidden = false;
    }

    function closeModal() {
        overlay.hidden = true;
        // Reset API key visibility
        ['cfg-gemini-apikey', 'cfg-openrouter-apikey', 'cfg-bravesearch-apikey'].forEach(id => {
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
                gemini: {
                    apiKey: document.getElementById('cfg-gemini-apikey').value,
                    model:  document.getElementById('cfg-gemini-model').value
                },
                openrouter: {
                    apiKey: document.getElementById('cfg-openrouter-apikey').value,
                    model:  document.getElementById('cfg-openrouter-model').value
                },
                toolsAuth: {
                    braveSearch: {
                        apiKey: document.getElementById('cfg-bravesearch-apikey').value
                    }
                },
                systemPrompt: document.getElementById('cfg-systemprompt').value,
                toolsPrompt:  document.getElementById('cfg-toolsprompt').value
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

// Process message text to replace tags with visual indicators
    function processMessageText(text) {
        const container = document.createElement('div');
        container.className = 'message-content';

        let lastIndex = 0;
        const cmdRegex = /<CMD>([\s\S]*?)<\/CMD>/gi;
        const decisionRegex = /<(CONTINUE|WAIT|STOP)>/gi;
        const toolRegex = /<TOOL\s+name="([^"]+)">([\s\S]*?)<\/TOOL>/gi;

        // Process all tags
        let allMatches = [];
        let match;

        // Find all CMD tags
        while ((match = cmdRegex.exec(text)) !== null) {
            allMatches.push({ type: 'cmd', index: match.index, length: match[0].length, content: match[1] });
        }

        // Find all decision tags
        while ((match = decisionRegex.exec(text)) !== null) {
            allMatches.push({ type: 'decision', index: match.index, length: match[0].length, decision: match[1] });
        }

        // Find all TOOL tags
        while ((match = toolRegex.exec(text)) !== null) {
            allMatches.push({ type: 'tool', index: match.index, length: match[0].length, toolName: match[1], toolContent: match[2].trim() });
        }

        // Sort matches by index
        allMatches.sort((a, b) => a.index - b.index);
        
        lastIndex = 0;
        for (const m of allMatches) {
            // Add text before this match
            if (m.index > lastIndex) {
                const textBefore = text.substring(lastIndex, m.index).trim();
                if (textBefore) {
                    const span = document.createElement('span');
                    span.style.display = 'block';
                    span.style.marginBottom = '8px';
                    span.style.whiteSpace = 'pre-wrap';
                    span.style.wordWrap = 'break-word';
                    span.textContent = textBefore;
                    container.appendChild(span);
                }
            }
            
            if (m.type === 'cmd') {
                // Command badge
                const badge = document.createElement('div');
                badge.className = 'cmd-badge';
                const cmdContent = m.content.trim();
                const span1 = document.createElement('span');
                span1.className = 'cmd-icon';
                span1.textContent = '⚙️';
                const code = document.createElement('code');
                code.textContent = cmdContent;
                badge.appendChild(span1);
                badge.appendChild(code);
                container.appendChild(badge);
            } else if (m.type === 'decision') {
                // Decision badge
                const decisionEl = document.createElement('div');
                const decision = m.decision.toUpperCase();
                decisionEl.className = `decision-badge decision-${decision.toLowerCase()}`;
                
                const icons = { 'CONTINUE': '✅', 'WAIT': '⏸️', 'STOP': '⛔' };
                const labels = { 'CONTINUE': 'Done', 'WAIT': 'Wait', 'STOP': 'Stop' };
                
                const iconSpan = document.createElement('span');
                iconSpan.className = 'decision-icon';
                iconSpan.textContent = icons[decision];
                
                const labelSpan = document.createElement('span');
                labelSpan.className = 'decision-label';
                labelSpan.textContent = labels[decision];
                
                decisionEl.appendChild(iconSpan);
                decisionEl.appendChild(labelSpan);
                container.appendChild(decisionEl);

            } else if (m.type === 'tool') {
                // Tool-call badge
                const toolEl = document.createElement('div');
                toolEl.className = 'tool-call-badge';
                toolEl.dataset.toolName = m.toolName;
                toolEl.dataset.toolContent = m.toolContent;

                const headerRow = document.createElement('div');
                headerRow.className = 'tool-call-header';

                const iconSpan = document.createElement('span');
                iconSpan.className = 'tool-call-icon';
                iconSpan.textContent = '🔧';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'tool-call-name';
                nameSpan.textContent = m.toolName;

                const statusSpan = document.createElement('span');
                statusSpan.className = 'tool-call-status tool-status-pending';
                statusSpan.textContent = 'pending';

                headerRow.appendChild(iconSpan);
                headerRow.appendChild(nameSpan);
                headerRow.appendChild(statusSpan);
                toolEl.appendChild(headerRow);

                // Args preview
                const argsEl = document.createElement('code');
                argsEl.className = 'tool-call-args';
                argsEl.textContent = m.toolContent.length > 120
                    ? m.toolContent.slice(0, 120) + '…'
                    : m.toolContent;
                toolEl.appendChild(argsEl);

                container.appendChild(toolEl);
            }
            
            lastIndex = m.index + m.length;
        }
        
        // Add remaining text
        if (lastIndex < text.length) {
            const textAfter = text.substring(lastIndex).trim();
            if (textAfter) {
                const span = document.createElement('span');
                span.style.display = 'block';
                span.style.whiteSpace = 'pre-wrap';
                span.style.wordWrap = 'break-word';
                span.textContent = textAfter;
                container.appendChild(span);
            }
        }

        return container;
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

        // Build parts for conversation history (Gemini format internally)
        const parts = [];
        images.forEach(entry => {
            const base64 = entry.dataUrl.split(',')[1];
            const mimeType = entry.dataUrl.match(/data:(.*?);/)[1];
            parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
        });
        if (text) parts.push({ text });

        // Push to conversation history (stored in Gemini format, converted on-the-fly for OpenRouter)
        conversationHistory.push({ role: 'user', parts });

        // Trim history to avoid memory/token limits (keep system context + last N turns)
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

        // Call AI with iterative feedback loop
        loopAborted = false;
        dom.stopBtn.style.display = 'flex';
        dom.sendBtn.disabled = true;

        let statusAI = 'working';
        let lastAIBubble = null;
        while (statusAI === 'working' && !loopAborted) {
            const aiResponse = await sendToAI();
            lastAIBubble = dom.chatArea.querySelector('.message-bubble.assistant:last-of-type');
            if (aiResponse) {
                console.log('AI response received');

                // --- Extract <CMD> tags ---
                const cmdRegex = /<CMD>([\s\S]*?)<\/CMD>/gi;
                const commands = [];
                let match;
                while ((match = cmdRegex.exec(aiResponse)) !== null) {
                    commands.push(match[1].trim());
                }

                // --- Extract <TOOL> tags ---
                // Collect badges by DOM order — content-matching is unreliable for multi-line args
                const toolBadgeEls = lastAIBubble
                    ? [...lastAIBubble.querySelectorAll('.tool-call-badge')]
                    : [];
                const toolRegex = /<TOOL\s+name="([^"]+)">([\s\S]*?)<\/TOOL>/gi;
                const toolMatches = [];
                while ((match = toolRegex.exec(aiResponse)) !== null) {
                    const toolName    = match[1];
                    const toolContent = match[2].trim();
                    const badge       = toolBadgeEls[toolMatches.length] || null;
                    toolMatches.push({ toolName, toolContent, badge });
                }

                const hasCmds  = commands.length > 0;
                const hasTools = toolMatches.length > 0;

                if (hasCmds || hasTools) {
                    if (lastAIBubble) lastAIBubble.classList.remove('ai-final-response');
                    let resultsText = '';

                    if (hasCmds) {
                        console.log('Commands found:', commands);
                        const cmdResults = await executeCommands(commands);
                        resultsText += `COMMAND RESULTS:\n${cmdResults}\n`;
                    }

                    if (hasTools) {
                        console.log('Tool calls found:', toolMatches.map(t => t.toolName));
                        const toolResults = await executeToolCalls(toolMatches);
                        resultsText += `TOOL RESULTS:\n${toolResults}\n`;
                    }

                    const feedbackMessage = resultsText.trim() +
                        '\n\n[System] All tools/commands finished. Use the results above to answer the user\'s original request. Do NOT emit more <TOOL> or <CMD> tags unless you genuinely need additional data.';

                    conversationHistory.push({
                        role: 'user',
                        parts: [{ text: feedbackMessage }]
                    });

                    console.log('Sending results back to AI for evaluation…');
                } else {
                    // No more actions — AI response is final
                    console.log('No more actions found, stopping loop');
                    if (lastAIBubble) lastAIBubble.classList.add('ai-final-response');
                    statusAI = 'done';
                }
            } else {
                statusAI = 'done';
                if (lastAIBubble) lastAIBubble.classList.add('ai-final-response');
            }
        }
        statusAI = 'done';
        dom.stopBtn.style.display = 'none';
        dom.sendBtn.disabled = false;
    }

    // ================================
    //  AI API (Multi-provider: Gemini / OpenRouter)
    // ================================

    // Convert internal Gemini-format history to OpenRouter (OpenAI) format
    function convertHistoryToOpenAI(history) {
        return history.map(entry => {
            const role = entry.role === 'model' ? 'assistant' : entry.role;
            const content = [];

            for (const part of entry.parts) {
                if (part.text) {
                    content.push({ type: 'text', text: part.text });
                } else if (part.inline_data) {
                    content.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`
                        }
                    });
                }
            }

            // If only one text part, simplify to string
            if (content.length === 1 && content[0].type === 'text') {
                return { role, content: content[0].text };
            }
            return { role, content };
        });
    }

    async function sendToAI() {
        const provider = config.ai.provider || 'gemini';

        if (provider === 'openrouter') {
            return sendToOpenRouter();
        } else {
            return sendToGemini();
        }
    }

    // --- Gemini Provider ---
    async function sendToGemini(retryCount = 0) {
        const MAX_RETRIES = 3;
        const cfg = config.ai.gemini;
        const apiKey = cfg.apiKey;
        const model = cfg.model || 'gemini-2.0-flash-lite';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

        // Show typing indicator
        const typingBubble = addMessageBubble('assistant', '');
        const textEl = typingBubble.querySelector('p') || createTextElement(typingBubble);
        textEl.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';

        const body = {
            contents: conversationHistory,
        };

        const effectiveSystemPrompt = buildSystemPromptWithTools();
        if (effectiveSystemPrompt) {
            body.system_instruction = {
                parts: [{ text: effectiveSystemPrompt }]
            };
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.status === 429 && retryCount < MAX_RETRIES) {
                const errBody = await response.text();
                const delayMatch = errBody.match(/retry in ([\d.]+)s/i);
                const waitSec = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) : 20;

                for (let s = waitSec; s > 0; s--) {
                    textEl.textContent = `Rate limit atingido. Tentando novamente em ${s}s...`;
                    await new Promise(r => setTimeout(r, 1000));
                }
                textEl.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';
                typingBubble.remove();
                return sendToGemini(retryCount + 1);
            }

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`API ${response.status}: ${err}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(jsonStr);
                        const parts = parsed.candidates?.[0]?.content?.parts;
                        if (parts) {
                            for (const part of parts) {
                                if (part.text) {
                                    fullText += part.text;
                                    textEl.textContent = fullText;
                                    dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
                                }
                            }
                        }
                    } catch (e) { /* skip malformed */ }
                }
            }

            if (fullText) {
                conversationHistory.push({ role: 'model', parts: [{ text: fullText }] });
                // Replace typing bubble with processed content
                typingBubble.innerHTML = '';
                const processedContent = processMessageText(fullText);
                typingBubble.appendChild(processedContent);
            }
            if (!fullText) {
                typingBubble.innerHTML = '';
                const p = document.createElement('p');
                p.textContent = '(Sem resposta do modelo)';
                typingBubble.appendChild(p);
            }
            return fullText || '';

        } catch (error) {
            console.error('Gemini API error:', error);
            typingBubble.innerHTML = '';
            const p = document.createElement('p');
            p.textContent = `Erro: ${error.message}`;
            p.style.color = '#ef4444';
            typingBubble.appendChild(p);
            typingBubble.classList.add('error');
            return '';
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

        // Build messages in OpenAI format
        const messages = [];
        const effectiveSystemPrompt = buildSystemPromptWithTools();
        if (effectiveSystemPrompt) {
            messages.push({ role: 'system', content: effectiveSystemPrompt });
        }

        console.log('Sending conversation history to OpenRouter:', messages);
        messages.push(...convertHistoryToOpenAI(conversationHistory));

        const body = {
            model: model,
            messages: messages,
            stream: true,
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

            // OpenRouter via ProxyFetch returns full body (no streaming through proxy)
            const responseText = await response.text();
            let fullText = '';

            // Try to parse as SSE stream (lines of "data: {...}")
            const lines = responseText.split('\n');
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(jsonStr);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullText += delta;
                        textEl.textContent = fullText;
                        dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
                    }
                } catch (e) { /* skip */ }
            }

            // If SSE parsing got nothing, try as regular JSON response
            if (!fullText) {
                try {
                    const parsed = JSON.parse(responseText);
                    fullText = parsed.choices?.[0]?.message?.content || '';
                    if (fullText) {
                        textEl.textContent = fullText;
                        dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
                    }
                } catch (e) { /* skip */ }
            }

            if (fullText) {
                conversationHistory.push({ role: 'model', parts: [{ text: fullText }] });
                // Replace typing bubble with processed content
                typingBubble.innerHTML = '';
                const processedContent = processMessageText(fullText);
                typingBubble.appendChild(processedContent);
            }
            if (!fullText) {
                typingBubble.innerHTML = '';
                const p = document.createElement('p');
                p.textContent = '(Sem resposta do modelo)';
                typingBubble.appendChild(p);
            }
            return fullText || '';

        } catch (error) {
            console.error('OpenRouter API error:', error);
            typingBubble.innerHTML = '';
            const p = document.createElement('p');
            p.textContent = `Erro: ${error.message}`;
            p.style.color = '#ef4444';
            typingBubble.appendChild(p);
            typingBubble.classList.add('error');
            return '';
        }
    }

    function createTextElement(bubble) {
        const p = document.createElement('p');
        bubble.appendChild(p);
        return p;
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
            this.resolve = null;    // set by executeCommands to resolve the output promise
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

            this.outputArea = document.createElement('pre');
            this.outputArea.className = 'cmd-entry-output';

            this.element.appendChild(this.label);
            this.element.appendChild(this.statusRow);
            this.element.appendChild(this.outputArea);
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
            setTimeout(() => {
                this.outputArea.scrollTop = this.outputArea.scrollHeight;
                dom.cmdPanelBody.scrollTop = dom.cmdPanelBody.scrollHeight;
            }, 0);
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
    //  Execute CMD commands from AI
    // ================================

    async function executeCommands(commands) {
        if (!webWrap) {
            console.error('WebWrap not available');
            return '';
        }

        const cmdOutputs = [];

        try {
            // Create a PowerShell session if we don't have one
            if (!pwshRequestId) {
                pwshRequestId = webWrap.createPwsh('ai-agent', true);
            }

            for (let i = 0; i < commands.length; i++) {
                const cmd = commands[i];
                const id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                const entry = cmdManager.addCommand(id, cmd);
                cmdManager.setActiveEntry(id);

                // Wait for user to click "Executar"
                await new Promise((resolve) => {
                    entry.confirmBtn.addEventListener('click', () => {
                        entry.showConfirmBtn(false);
                        entry.showSpinner(true);
                        entry.showStopBtn(true);
                        entry.setStatus('running', '#3b82f6');
                        resolve();
                    }, { once: true });
                });

                // Generate a unique marker to detect when the command finishes
                const marker = `__DONE_${crypto.randomUUID().slice(0, 8)}__`;

                const output = await new Promise((resolve) => {
                    entry.doneMarker = marker;
                    entry.resolve = resolve;

                    // Send: command ; echo MARKER  (the marker in the output = done)
                    entry.appendOutput(`\n>> ${cmd}`);
                    webWrap.sendCommand(pwshRequestId, `${cmd}; echo '${marker}'`);
                });

                cmdManager.setActiveEntry(null);
                cmdOutputs.push({ command: cmd, output: output || '(no output)' });

                if (i < commands.length - 1) {
                    await new Promise(r => setTimeout(r, 300));
                }
            }
        } catch (err) {
            console.error('Command execution error:', err.message);
        }

        return cmdOutputs.map(item => `Comando: ${item.command}\nResultado:\n${item.output}`).join('\n---\n');
    }

    function registerCommand(id, command) {
        cmdManager.addCommand(id, command);
    }

    // ================================
    //  Execute Tool Calls from AI
    // ================================

    async function executeToolCalls(toolMatches) {
        if (!aiTools) {
            console.warn('aiTools not available — cannot execute tool calls');
            return 'Error: tool engine not initialised.';
        }

        const toolOutputs = [];

        for (const { toolName, toolContent, badge } of toolMatches) {
            // Update badge status in the chat bubble
            const statusEl = badge?.querySelector('.tool-call-status');
            const resultEl = badge?.querySelector('.tool-call-result');

            const setStatus = (label, cssClass) => {
                if (!statusEl) return;
                statusEl.textContent = label;
                statusEl.className = `tool-call-status ${cssClass}`;
            };

            // Show a side-panel entry so the user can track execution
            const panelId = `tool_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const panelLabel = `🔧 ${toolName}: ${toolContent.length > 50 ? toolContent.slice(0, 50) + '…' : toolContent}`;
            const panelEntry = cmdManager.addCommand(panelId, panelLabel);
            panelEntry.showConfirmBtn(false);
            panelEntry.showSpinner(true);
            panelEntry.setStatus('running', '#8b5cf6');

            setStatus('running…', 'tool-status-running');

            let resultText = '';
            try {
                resultText = await aiTools.ToolCall(toolName, toolContent);
                resultText = String(resultText ?? '');

                panelEntry.appendOutput(resultText.slice(0, 4000));
                panelEntry.setStatus('done', '#22c55e');
                panelEntry.showSpinner(false);

                setStatus('done ✓', 'tool-status-done');
                if (resultEl) {
                    const preview = resultText.length > 400 ? resultText.slice(0, 400) + '\n… (truncated)' : resultText;
                    resultEl.textContent = preview;
                    resultEl.style.display = 'block';
                }
            } catch (err) {
                resultText = `Error: ${err.message}`;
                panelEntry.appendOutput(resultText);
                panelEntry.setStatus('error', '#ef4444');
                panelEntry.showSpinner(false);

                setStatus('error', 'tool-status-error');
                if (resultEl) {
                    resultEl.textContent = resultText;
                    resultEl.style.display = 'block';
                }
            }

            toolOutputs.push({ toolName, args: toolContent, output: resultText || '(no output)' });
        }

        return toolOutputs
            .map(t => `Tool: ${t.toolName}\nArgs: ${t.args}\nResult:\n${t.output}`)
            .join('\n---\n');
    }

    function unregisterCommand(id) {
        cmdManager.removeCommand(id);
    }

    // --- Public API ---
    return {
        init,
        registerCommand,
        unregisterCommand,
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

