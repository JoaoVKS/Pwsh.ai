# <img width="34" height="34" alt="Icon" src="https://github.com/user-attachments/assets/77c482bb-5b48-4f48-b492-5ad213764dee" /> Pwsh.ai - AI Chatbot + Tools & PowerShell integration

A lightweight but powerful AI chat UI with voice input, image attachments, and an extensible tool system. Including PowerShell execution, file operations, web search, and email sending.
🚀 Made with [WebWrapperNet](https://github.com/JoaoVKS/WebWrapperNet).

This project is in very early development. Expect breaking changes, missing features, and the occasional explosion (bugs). Use at your own risk!

## Quick Start
1. Clone the repo or download the .zip then run the `Pwsh.AI.exe`

OR

1. Run this on PowerShell:<pre>Invoke-WebRequest -Uri "https://github.com/JoaoVKS/Pwsh.ai/releases/download/v2.0.0/PWSH.AI_v2.zip" -OutFile "temp.zip"; Expand-Archive -Path "temp.zip" -DestinationPath "."; Remove-Item "temp.zip"</pre>
2. Run the `Pwsh.AI.exe`

## Features
- Voice input using the Web Speech API (start/stop and auto-send on silence).
- AI chat UI with attachments (images), conversation history and model selection.
- Fully customizable system prompt (some changes WILL break core functionality).
- PowerShell integration via the `webWrap` bridge: create sessions, send commands, receive async output.

## Requirements
- Windows 10/11 for PowerShell integration.
- .NET 10 — https://dotnet.microsoft.com/en-us/download/dotnet/10.0
- WebView2 Runtime — https://developer.microsoft.com/en-us/microsoft-edge/webview2/
- OpenRouter API key
## Tools
The AI has access to the following built-in tools:

| Tool | Description |
|------|-------------|
| `PwshExec` | Executes a PowerShell command on the Windows host . Requires explicit user approval before running. |
| `fileRead` | Reads the content of a text file from the Windows host. |
| `fileWrite` | Writes content to a text file on the Windows host. Creates the file if it doesn't exist, or overwrites it if it does. |
| `fileTextSearch` | Searches for text inside a file and returns all matches with their line and column positions. |
| `curlFetch` | Performs an HTTP/Web request described by a curl command string and returns the response body. |
| `webSearch` | Performs a web search using Brave Search or Tavily. Requires a Brave or Tavily API key in the config. |
| `sendEmail` | Sends an email using the Mailersend api. Supports plain text, HTML body, and attachments. |

### Tools requirements
- Tavily or Brave Search API key
- MailerSend API key

### ⚠️ SECURITY WARNING:
This application has the capability to execute code in PowerShell through AI assistance. Running arbitrary PowerShell commands is powerful and dangerous. While all actions require explicit user approval before execution, users should be aware
of the potential security implications and exercise caution when using this tool.

### ⚠️ RECOMMENDED USAGE:
- Only use in trusted environments
- Review all proposed commands before approval




