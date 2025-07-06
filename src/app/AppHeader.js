import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

export class AppHeader extends LitElement {
    static properties = {
        isSessionActive: { type: Boolean, state: true },
    };

    static styles = css`
        :host {
            display: block;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.2s ease-out;
            will-change: transform, opacity;
        }

        :host(.hiding) {
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        :host(.showing) {
            animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        :host(.sliding-in) {
            animation: fadeIn 0.2s ease-out forwards;
        }

        :host(.hidden) {
            opacity: 0;
            transform: translateY(-150%) scale(0.85);
            pointer-events: none;
        }

        @keyframes slideUp {
            0% {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0px);
            }
            30% {
                opacity: 0.7;
                transform: translateY(-20%) scale(0.98);
                filter: blur(0.5px);
            }
            70% {
                opacity: 0.3;
                transform: translateY(-80%) scale(0.92);
                filter: blur(1.5px);
            }
            100% {
                opacity: 0;
                transform: translateY(-150%) scale(0.85);
                filter: blur(2px);
            }
        }

        @keyframes slideDown {
            0% {
                opacity: 0;
                transform: translateY(-150%) scale(0.85);
                filter: blur(2px);
            }
            30% {
                opacity: 0.5;
                transform: translateY(-50%) scale(0.92);
                filter: blur(1px);
            }
            65% {
                opacity: 0.9;
                transform: translateY(-5%) scale(0.99);
                filter: blur(0.2px);
            }
            85% {
                opacity: 0.98;
                transform: translateY(2%) scale(1.005);
                filter: blur(0px);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0px);
            }
        }

        @keyframes fadeIn {
            0% {
                opacity: 0;
            }
            100% {
                opacity: 1;
            }
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        .header {
            width: 100%;
            height: 47px;
            padding: 2px 10px 2px 13px;
            background: transparent;
            overflow: hidden;
            border-radius: 9000px;
            /* backdrop-filter: blur(1px); */
            justify-content: space-between;
            align-items: center;
            display: inline-flex;
            box-sizing: border-box;
            position: relative;
        }

        .header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 9000px;
            z-index: -1;
        }

        .header::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 9000px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.17) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.17) 100%); 
            -webkit-mask:
                linear-gradient(#fff 0 0) content-box,
                linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .listen-button {
            height: 26px;
            padding: 0 13px;
            background: transparent;
            border-radius: 9000px;
            justify-content: center;
            width: 78px;
            align-items: center;
            gap: 6px;
            display: flex;
            border: none;
            cursor: pointer;
            position: relative;
        }

        .listen-button.active::before {
            background: rgba(215, 0, 0, 0.5);
        }

        .listen-button.active:hover::before {
            background: rgba(255, 20, 20, 0.6);
        }

        .listen-button:hover::before {
            background: rgba(255, 255, 255, 0.18);
        }

        .listen-button::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255, 255, 255, 0.14);
            border-radius: 9000px;
            z-index: -1;
            transition: background 0.15s ease;
        }

        .listen-button::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 9000px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.17) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.17) 100%);
            -webkit-mask:
                linear-gradient(#fff 0 0) content-box,
                linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .header-actions {
            height: 26px;
            box-sizing: border-box;
            justify-content: flex-start;
            align-items: center;
            gap: 9px;
            display: flex;
            padding: 0 8px;
            border-radius: 6px;
            transition: background 0.15s ease;
        }

        .header-actions:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .ask-action {
            margin-left: 4px;
        }

        .action-button,
        .settings-button {
            background: transparent;
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .action-text {
            padding-bottom: 1px;
            justify-content: center;
            align-items: center;
            gap: 10px;
            display: flex;
        }

        .action-text-content {
            color: white;
            font-size: 12px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500; /* Medium */
            word-wrap: break-word;
        }

        .icon-container {
            justify-content: flex-start;
            align-items: center;
            gap: 4px;
            display: flex;
        }

        .icon-container.ask-icons svg,
        .icon-container.showhide-icons svg {
            width: 12px;
            height: 12px;
        }

        .listen-icon svg {
            width: 12px;
            height: 11px;
            position: relative;
            top: 1px;
        }

        .icon-box {
            color: white;
            font-size: 12px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 13%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .settings-button {
            padding: 5px;
            border-radius: 50%;
            transition: background 0.15s ease;
        }
        
        .settings-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .settings-icon {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .settings-icon svg {
            width: 16px;
            height: 16px;
        }
        `;

    constructor() {
        super();
        this.dragState = null;
        this.wasJustDragged = false;
        this.isVisible = true;
        this.isAnimating = false;
        this.hasSlidIn = false;
        this.settingsHideTimer = null;
        this.isSessionActive = false;
        this.animationEndTimer = null;

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            ipcRenderer.on('toggle-header-visibility', () => {
                this.toggleVisibility();
            });

            ipcRenderer.on('cancel-hide-settings', () => {
                this.cancelHideWindow('settings');
            });
        }

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleAnimationEnd = this.handleAnimationEnd.bind(this);
    }

    async handleMouseDown(e) {
        e.preventDefault();

        const { ipcRenderer } = window.require('electron');
        const initialPosition = await ipcRenderer.invoke('get-header-position');

        this.dragState = {
            initialMouseX: e.screenX,
            initialMouseY: e.screenY,
            initialWindowX: initialPosition.x,
            initialWindowY: initialPosition.y,
            moved: false,
        };

        window.addEventListener('mousemove', this.handleMouseMove, { capture: true });
        window.addEventListener('mouseup', this.handleMouseUp, { once: true, capture: true });
    }

    handleMouseMove(e) {
        if (!this.dragState) return;

        const deltaX = Math.abs(e.screenX - this.dragState.initialMouseX);
        const deltaY = Math.abs(e.screenY - this.dragState.initialMouseY);
        
        if (deltaX > 3 || deltaY > 3) {
            this.dragState.moved = true;
        }

        const newWindowX = this.dragState.initialWindowX + (e.screenX - this.dragState.initialMouseX);
        const newWindowY = this.dragState.initialWindowY + (e.screenY - this.dragState.initialMouseY);

        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('move-header-to', newWindowX, newWindowY);
    }

    handleMouseUp(e) {
        if (!this.dragState) return;

        const wasDragged = this.dragState.moved;

        window.removeEventListener('mousemove', this.handleMouseMove, { capture: true });
        this.dragState = null;

        if (wasDragged) {
            this.wasJustDragged = true;
            setTimeout(() => {
                this.wasJustDragged = false;
            }, 0);
        }
    }

    toggleVisibility() {
        if (this.isAnimating) {
            console.log('[AppHeader] Animation already in progress, ignoring toggle');
            return;
        }
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
        
        this.isAnimating = true;
        
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    hide() {
        this.classList.remove('showing', 'hidden');
        this.classList.add('hiding');
        this.isVisible = false;
        
        this.animationEndTimer = setTimeout(() => {
            if (this.classList.contains('hiding')) {
                this.handleAnimationEnd({ target: this });
            }
        }, 350);
    }

    show() {
        this.classList.remove('hiding', 'hidden');
        this.classList.add('showing');
        this.isVisible = true;
        
        this.animationEndTimer = setTimeout(() => {
            if (this.classList.contains('showing')) {
                this.handleAnimationEnd({ target: this });
            }
        }, 400);
    }

    handleAnimationEnd(e) {
        if (e.target !== this) return;
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
        
        this.isAnimating = false;
        
        if (this.classList.contains('hiding')) {
            this.classList.remove('hiding');
            this.classList.add('hidden');
            
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('header-animation-complete', 'hidden');
            }
        } else if (this.classList.contains('showing')) {
            this.classList.remove('showing');
            
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('header-animation-complete', 'visible');
            }
        } else if (this.classList.contains('sliding-in')) {
            this.classList.remove('sliding-in');
            this.hasSlidIn = true;
            console.log('[AppHeader] Slide-in animation completed');
        }
    }

    startSlideInAnimation() {
        if (this.hasSlidIn) return;
        this.classList.add('sliding-in');
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('animationend', this.handleAnimationEnd);

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            this._sessionStateListener = (event, { isActive }) => {
                this.isSessionActive = isActive;
            };
            ipcRenderer.on('session-state-changed', this._sessionStateListener);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('animationend', this.handleAnimationEnd);
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
        
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('toggle-header-visibility');
            ipcRenderer.removeAllListeners('cancel-hide-settings');
            if (this._sessionStateListener) {
                ipcRenderer.removeListener('session-state-changed', this._sessionStateListener);
            }
        }
    }

    invoke(channel, ...args) {
        if (this.wasJustDragged) {
            return;
        }
        if (window.require) {
            window.require('electron').ipcRenderer.invoke(channel, ...args);
        }
    }

    showWindow(name, element) {
        if (this.wasJustDragged) return;
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            console.log(`[AppHeader] showWindow('${name}') called at ${Date.now()}`);
            
            ipcRenderer.send('cancel-hide-window', name);

            if (name === 'settings' && element) {
                const rect = element.getBoundingClientRect();
                ipcRenderer.send('show-window', {
                    name: 'settings',
                    bounds: {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    }
                });
            } else {
                ipcRenderer.send('show-window', name);
            }
        }
    }

    hideWindow(name) {
        if (this.wasJustDragged) return;
        if (window.require) {
            console.log(`[AppHeader] hideWindow('${name}') called at ${Date.now()}`);
            window.require('electron').ipcRenderer.send('hide-window', name);
        }
    }

    cancelHideWindow(name) {

    }

    render() {
        return html`
            <div class="header" @mousedown=${this.handleMouseDown}>
                <button 
                    class="listen-button ${this.isSessionActive ? 'active' : ''}"
                    @click=${() => this.invoke(this.isSessionActive ? 'close-session' : 'toggle-feature', 'listen')}
                >
                    <div class="action-text">
                        <div class="action-text-content">${this.isSessionActive ? 'Stop' : 'Listen'}</div>
                    </div>
                    <div class="listen-icon">
                        ${this.isSessionActive
                            ? html`
                                <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="9" height="9" rx="1" fill="white"/>
                                </svg>

                            `
                            : html`
                                <svg width="12" height="11" viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1.69922 2.7515C1.69922 2.37153 2.00725 2.0635 2.38722 2.0635H2.73122C3.11119 2.0635 3.41922 2.37153 3.41922 2.7515V8.2555C3.41922 8.63547 3.11119 8.9435 2.73122 8.9435H2.38722C2.00725 8.9435 1.69922 8.63547 1.69922 8.2555V2.7515Z" fill="white"/>
                                    <path d="M5.13922 1.3755C5.13922 0.995528 5.44725 0.6875 5.82722 0.6875H6.17122C6.55119 0.6875 6.85922 0.995528 6.85922 1.3755V9.6315C6.85922 10.0115 6.55119 10.3195 6.17122 10.3195H5.82722C5.44725 10.3195 5.13922 10.0115 5.13922 9.6315V1.3755Z" fill="white"/>
                                    <path d="M8.57922 3.0955C8.57922 2.71553 8.88725 2.4075 9.26722 2.4075H9.61122C9.99119 2.4075 10.2992 2.71553 10.2992 3.0955V7.9115C10.2992 8.29147 9.99119 8.5995 9.61122 8.5995H9.26722C8.88725 8.5995 8.57922 8.29147 8.57922 7.9115V3.0955Z" fill="white"/>
                                </svg>
                            `}
                    </div>
                </button>

                <div class="header-actions ask-action" @click=${() => this.invoke('toggle-feature', 'ask')}>
                    <div class="action-text">
                        <div class="action-text-content">Ask</div>
                    </div>
                    <div class="icon-container ask-icons">
                        <div class="icon-box">⌘</div>
                        <div class="icon-box">
                            <svg viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M2.41797 8.16406C2.41797 8.00935 2.47943 7.86098 2.58882 7.75158C2.69822 7.64219 2.84659 7.58073 3.0013 7.58073H10.0013C10.4654 7.58073 10.9106 7.39636 11.2387 7.06817C11.5669 6.73998 11.7513 6.29486 11.7513 5.83073V3.4974C11.7513 3.34269 11.8128 3.19431 11.9222 3.08492C12.0316 2.97552 12.1799 2.91406 12.3346 2.91406C12.4893 2.91406 12.6377 2.97552 12.7471 3.08492C12.8565 3.19431 12.918 3.34269 12.918 3.4974V5.83073C12.918 6.60428 12.6107 7.34614 12.0637 7.89312C11.5167 8.44011 10.7748 8.7474 10.0013 8.7474H3.0013C2.84659 8.7474 2.69822 8.68594 2.58882 8.57654C2.47943 8.46715 2.41797 8.31877 2.41797 8.16406Z" fill="white"/>
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M2.58876 8.57973C2.4794 8.47034 2.41797 8.32199 2.41797 8.16731C2.41797 8.01263 2.4794 7.86429 2.58876 7.75489L4.92209 5.42156C5.03211 5.3153 5.17946 5.25651 5.33241 5.25783C5.48536 5.25916 5.63167 5.32051 5.73982 5.42867C5.84798 5.53682 5.90932 5.68313 5.91065 5.83608C5.91198 5.98903 5.85319 6.13638 5.74693 6.24639L3.82601 8.16731L5.74693 10.0882C5.80264 10.142 5.84708 10.2064 5.87765 10.2776C5.90823 10.3487 5.92432 10.4253 5.92499 10.5027C5.92566 10.5802 5.9109 10.657 5.88157 10.7287C5.85224 10.8004 5.80893 10.8655 5.75416 10.9203C5.69939 10.9751 5.63426 11.0184 5.56257 11.0477C5.49088 11.077 5.41406 11.0918 5.33661 11.0911C5.25916 11.0905 5.18261 11.0744 5.11144 11.0438C5.04027 11.0132 4.9759 10.9688 4.92209 10.9131L2.58876 8.57973Z" fill="white"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="header-actions" @click=${() => this.invoke('toggle-all-windows-visibility')}>
                    <div class="action-text">
                        <div class="action-text-content">Show/Hide</div>
                    </div>
                    <div class="icon-container showhide-icons">
                        <div class="icon-box">⌘</div>
                        <div class="icon-box">
                            <svg viewBox="0 0 6 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1.50391 1.32812L5.16391 10.673" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <button 
                    class="settings-button"
                    @mouseenter=${(e) => this.showWindow('settings', e.currentTarget)}
                    @mouseleave=${() => this.hideWindow('settings')}
                >
                    <div class="settings-icon">
                        <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.0013 3.16406C7.82449 3.16406 7.65492 3.2343 7.5299 3.35932C7.40487 3.48435 7.33464 3.65392 7.33464 3.83073C7.33464 4.00754 7.40487 4.17711 7.5299 4.30213C7.65492 4.42716 7.82449 4.4974 8.0013 4.4974C8.17811 4.4974 8.34768 4.42716 8.47271 4.30213C8.59773 4.17711 8.66797 4.00754 8.66797 3.83073C8.66797 3.65392 8.59773 3.48435 8.47271 3.35932C8.34768 3.2343 8.17811 3.16406 8.0013 3.16406ZM8.0013 7.83073C7.82449 7.83073 7.65492 7.90097 7.5299 8.02599C7.40487 8.15102 7.33464 8.32058 7.33464 8.4974C7.33464 8.67421 7.40487 8.84378 7.5299 8.9688C7.65492 9.09382 7.82449 9.16406 8.0013 9.16406C8.17811 9.16406 8.34768 9.09382 8.47271 8.9688C8.59773 8.84378 8.66797 8.67421 8.66797 8.4974C8.66797 8.32058 8.59773 8.15102 8.47271 8.02599C8.34768 7.90097 8.17811 7.83073 8.0013 7.83073ZM8.0013 12.4974C7.82449 12.4974 7.65492 12.5676 7.5299 12.6927C7.40487 12.8177 7.33464 12.9873 7.33464 13.1641C7.33464 13.3409 7.40487 13.5104 7.5299 13.6355C7.65492 13.7605 7.82449 13.8307 8.0013 13.8307C8.17811 13.8307 8.34768 13.7605 8.47271 13.6355C8.59773 13.5104 8.66797 13.3409 8.66797 13.1641C8.66797 12.9873 8.59773 12.8177 8.47271 12.6927C8.34768 12.5676 8.17811 12.4974 8.0013 12.4974Z" fill="white" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </button>
            </div>
        `;
    }
}

customElements.define('app-header', AppHeader);
