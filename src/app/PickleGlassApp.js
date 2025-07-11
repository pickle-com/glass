import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';
import { SettingsView } from '../features/settings/SettingsView.js';
import { AssistantView } from '../features/listen/AssistantView.js';
import { AskView } from '../features/ask/AskView.js';
import { ShortcutSettingsView } from '../features/settings/ShortCutSettingsView.js';

import '../features/listen/renderer/renderer.js';

export class PickleGlassApp extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            color: var(--text-color);
            background: transparent;
            border-radius: 7px;
        }

        assistant-view {
            display: block;
            width: 100%;
            height: 100%;
        }

        ask-view, settings-view, history-view, help-view, setup-view {
            display: block;
            width: 100%;
            height: 100%;
        }

    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        currentResponseIndex: { type: Number },
        isMainViewVisible: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        isClickThrough: { type: Boolean, state: true },
        layoutMode: { type: String },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        structuredData: { type: Object }, 
    };

    constructor() {
        super();
        const urlParams = new URLSearchParams(window.location.search);
        this.currentView = urlParams.get('view') || 'listen';
        this.currentResponseIndex = -1;
        this.selectedProfile = localStorage.getItem('selectedProfile') || 'interview';
        
        // Language format migration for legacy users
        let lang = localStorage.getItem('selectedLanguage') || 'en';
        if (lang.includes('-')) {
            const newLang = lang.split('-')[0];
            console.warn(`[Migration] Correcting language format from "${lang}" to "${newLang}".`);
            localStorage.setItem('selectedLanguage', newLang);
            lang = newLang;
        }
        this.selectedLanguage = lang;

        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || '5';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || 'medium';
        this._isClickThrough = false;

    }

    connectedCallback() {
        super.connectedCallback();
        
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
            // ipcRenderer.on('start-listening-session', () => {
            //     console.log('Received start-listening-session command, calling handleListenClick.');
            //     this.handleListenClick();
            // });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('click-through-toggled');
            // ipcRenderer.removeAllListeners('start-listening-session');
        }
    }

    updated(changedProperties) {
        // if (changedProperties.has('isMainViewVisible') || changedProperties.has('currentView')) {
        //     this.requestWindowResize();
        // }

        if (changedProperties.has('currentView')) {
            const viewContainer = this.shadowRoot?.querySelector('.view-container');
            if (viewContainer) {
                viewContainer.classList.add('entering');
                requestAnimationFrame(() => {
                    viewContainer.classList.remove('entering');
                });
            }
        }

        // Only update localStorage when these specific properties change
        if (changedProperties.has('selectedProfile')) {
            localStorage.setItem('selectedProfile', this.selectedProfile);
        }
        if (changedProperties.has('selectedLanguage')) {
            localStorage.setItem('selectedLanguage', this.selectedLanguage);
        }
        if (changedProperties.has('selectedScreenshotInterval')) {
            localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        }
        if (changedProperties.has('selectedImageQuality')) {
            localStorage.setItem('selectedImageQuality', this.selectedImageQuality);
        }
        if (changedProperties.has('layoutMode')) {
            this.updateLayoutMode();
        }
    }


    // async handleListenClick() {
    //     if (window.require) {
    //         const { ipcRenderer } = window.require('electron');
    //         const isActive = await ipcRenderer.invoke('is-session-active');
    //         // if (isActive) {
    //         //     console.log('Session is already active. No action needed.');
    //         //     return;
    //         // }
    //     }

    //     if (window.pickleGlass) {
    //         // await window.pickleGlass.initializeopenai(this.selectedProfile, this.selectedLanguage);
    //         window.pickleGlass.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
    //     }

    //     // 🔄 Clear previous summary/analysis when a new listening session begins
    //     this.structuredData = {
    //         summary: [],
    //         topic: { header: '', bullets: [] },
    //         actions: [],
    //         followUps: [],
    //     };

    //     this.currentResponseIndex = -1;
    //     this.startTime = Date.now();
    //     this.currentView = 'listen';
    //     this.isMainViewVisible = true;
    // }

    async handleClose() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('quit-application');
        }
    }




    render() {
        switch (this.currentView) {
            case 'listen':
                return html`<assistant-view
                    .currentResponseIndex=${this.currentResponseIndex}
                    .selectedProfile=${this.selectedProfile}
                    .structuredData=${this.structuredData}
                    @response-index-changed=${e => (this.currentResponseIndex = e.detail.index)}
                ></assistant-view>`;
            case 'ask':
                return html`<ask-view></ask-view>`;
            case 'settings':
                return html`<settings-view
                    .selectedProfile=${this.selectedProfile}
                    .selectedLanguage=${this.selectedLanguage}
                    .onProfileChange=${profile => (this.selectedProfile = profile)}
                    .onLanguageChange=${lang => (this.selectedLanguage = lang)}
                ></settings-view>`;
            case 'shortcut-settings':
                return html`<shortcut-settings-view></shortcut-settings-view>`;
            case 'history':
                return html`<history-view></history-view>`;
            case 'help':
                return html`<help-view></help-view>`;
            case 'setup':
                return html`<setup-view></setup-view>`;
            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }
}

customElements.define('pickle-glass-app', PickleGlassApp);
