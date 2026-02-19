# Pwsh.ai - test build — AI Chatbot with Voice & PowerShell

A lightweight AI chat UI with optional voice input and the ability to run PowerShell commands. 
🚀 Made with [WebWrapperNet](https://github.com/JoaoVKS/WebWrapperNet).

## Features
- Voice input using the Web Speech API (start/stop and auto-send on silence).
- AI chat UI with attachments (images), conversation history and model selection.
- Fully customizable system prompt (some changes WILL break core functionality).
- PowerShell integration via the `webWrap` bridge: create sessions, send commands, receive async output.

## Requirements
- Windows 10/11 for PowerShell integration.
- .NET 10 — https://dotnet.microsoft.com/en-us/download/dotnet/10.0
- WebView2 Runtime — https://developer.microsoft.com/en-us/microsoft-edge/webview2/

## Quick Start
1. Clone the repo or download the .zip then run the WebWrap.exe

### ⚠️ SECURITY WARNING:
This application has the capability to execute code in PowerShell through AI assistance. Running arbitrary PowerShell commands is powerful and dangerous. While all actions require explicit user approval before execution, users should be aware
of the potential security implications and exercise caution when using this tool.

### ⚠️ RECOMMENDED USAGE:
- Only use in trusted environments
- Review all proposed commands before approval



