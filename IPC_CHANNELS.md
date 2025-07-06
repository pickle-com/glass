# IPC Channel Reference

This document lists all the IPC channels used for communication between the main process and renderer processes in the Glass application. It serves as a central reference for developers.

---

## 1. Two-Way Channels (`ipcMain.handle` / `ipcRenderer.invoke`)

These channels are used for request-response communication where the renderer process expects a value to be returned from the main process.

### Window & System Management
- `get-header-position`: Gets the current [x, y] coordinates of the header window.
- `move-header-to`: Moves the header window to a specific [x, y] coordinate.
- `resize-header-window`: Resizes the header window to a specific width and height.
- `move-window-step`: Moves the header window by a predefined step in a given direction.
- `is-window-visible`: Checks if a specific feature window (e.g., 'ask') is currently visible.
- `force-close-window`: Forces a specific feature window to hide.
- `toggle-all-windows-visibility`: Toggles the visibility of all application windows.
- `toggle-feature`: Shows or hides a specific feature window (e.g., 'ask', 'listen').
- `quit-application`: Quits the entire application.

### Authentication & User
- `get-current-user`: Retrieves the full state of the current user (Firebase or local).
- `start-firebase-auth`: Opens the Firebase login flow in the system browser.
- `firebase-logout`: Initiates the user logout process.
- `save-api-key`: Saves a user-provided API key.
- `remove-api-key`: Removes the currently stored API key.
- `get-stored-api-key`: Retrieves the currently active API key.
- `get-ai-provider`: Gets the currently configured AI provider (e.g., 'openai').

### Permissions & Settings
- `get-content-protection-status`: Checks if window content protection is enabled.
- `check-system-permissions`: Checks for microphone and screen recording permissions.
- `request-microphone-permission`: Prompts the user for microphone access.
- `open-system-preferences`: Opens the macOS System Preferences for a specific privacy setting.
- `mark-permissions-completed`: Marks the initial permission setup as completed.
- `check-permissions-completed`: Checks if the initial permission setup was completed.
- `update-google-search-setting`: Updates the setting for Google Search integration.

### Data & Content
- `get-user-presets`: Fetches all custom prompt presets for the current user.
- `get-preset-templates`: Fetches the default prompt preset templates.
- `save-ask-message`: Saves a user question and AI response pair to the database.
- `get-web-url`: Gets the dynamically assigned URLs for the backend and web frontend.

### Features (Listen, Ask, etc.)
- `initialize-openai`: Initializes the STT and other AI services for a new session.
- `is-session-active`: Checks if a listen/summary session is currently active.
- `send-audio-content`: Sends a chunk of audio data from renderer to main for processing.
- `start-macos-audio`, `stop-macos-audio`: Controls the background process for system audio capture on macOS.
- `close-session`: Stops the current listen session.
- `message-sending`: Notifies the main process that an 'ask' message is being sent.
- `send-question-to-ask`: Sends a question from one feature window (e.g., listen) to the 'ask' window.
- `capture-screenshot`: Requests the main process to take a screenshot.
- `get-current-screenshot`: Retrieves the most recent screenshot.
- `adjust-window-height`: Requests the main process to resize a window to a specific height.

---

## 2. One-Way Channels (`ipcMain.on` / `ipcRenderer.send` / `webContents.send`)

These channels are used for events or commands that do not require a direct response.

### Main to Renderer (Events & Updates)
- `user-state-changed`: Notifies all windows that the user's authentication state has changed.
- `auth-failed`: Informs the UI that a Firebase authentication attempt failed.
- `session-state-changed`: Broadcasts whether a listen session is active or inactive.
- `api-key-validated`, `api-key-updated`, `api-key-removed`: Events related to the lifecycle of the API key.
- `stt-update`: Sends real-time speech-to-text transcription updates to the UI.
- `update-structured-data`: Sends processed data (summaries, topics) to the UI.
- `ask-response-chunk`, `ask-response-stream-end`: Sends streaming AI responses for the 'ask' feature.
- `window-show-animation`: Triggers a show/fade-in animation.
- `window-hide-animation`, `settings-window-hide-animation`: Triggers a hide/fade-out animation.
- `window-blur`: Notifies a window that it has lost focus.
- `window-did-show`: Confirms to a window that it is now visible.
- `click-through-toggled`: Informs the UI about the status of click-through mode.
- `start-listening-session`: Commands to control the main application view.
- `receive-question-from-assistant`: Delivers a question to the `AskView`.
- `ask-global-send`, `toggle-text-input`, `clear-ask-response`, `hide-text-input`: Commands for controlling the state of the `AskView`.

### Renderer to Main (Commands & Events)
- `header-state-changed`: Informs the `windowManager` that the header's state (e.g., `apikey` vs `app`) has changed.
- `update-keybinds`: Sends updated keybinding preferences to the main process.
- `view-changed`: Notifies the main process that the visible view in `PickleGlassApp` has changed.
- `header-animation-complete`: Lets the main process know that a show/hide animation has finished.
- `cancel-hide-window`, `show-window`, `hide-window`: Commands to manage feature window visibility from the renderer.
- `session-did-close`: Notifies the main process that the user has manually closed the listen session.