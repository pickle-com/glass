import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class TaskView extends LitElement {
    static properties = {
        currentTask: { type: String },
        taskNumber: { type: Number },
        projectDescription: { type: String },
        completedTasks: { type: Array },
        phase: { type: String },
        isVisible: { type: Boolean }
    };

    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            color: white;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.2s ease-out;
            will-change: transform, opacity;
        }

        :host(.hiding) {
            animation: slideOut 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        :host(.showing) {
            animation: slideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        :host(.hidden) {
            opacity: 0;
            transform: translateX(100%) scale(0.85);
            pointer-events: none;
        }

        @keyframes slideOut {
            0% {
                opacity: 1;
                transform: translateX(0) scale(1);
                filter: blur(0px);
            }
            100% {
                opacity: 0;
                transform: translateX(100%) scale(0.85);
                filter: blur(2px);
            }
        }

        @keyframes slideIn {
            0% {
                opacity: 0;
                transform: translateX(100%) scale(0.85);
                filter: blur(2px);
            }
            100% {
                opacity: 1;
                transform: translateX(0) scale(1);
                filter: blur(0px);
            }
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        .task-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background: rgba(0, 0, 0, 0.65);
            border-radius: 12px;
            outline: 0.5px rgba(255, 255, 255, 0.3) solid;
            outline-offset: -1px;
            backdrop-filter: blur(10px);
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            min-width: 280px;
            max-width: 400px;
        }

        .task-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.15);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            filter: blur(10px);
            z-index: -1;
        }

        .task-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: transparent;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }

        .task-icon {
            width: 20px;
            height: 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .task-icon svg {
            width: 12px;
            height: 12px;
            stroke: rgba(255, 255, 255, 0.9);
        }

        .task-title {
            font-size: 13px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.9);
            white-space: nowrap;
        }

        .task-content {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            overflow-x: hidden;
            background: transparent;
            min-height: 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .task-content::-webkit-scrollbar {
            width: 6px;
        }

        .task-content::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
            margin: 4px;
        }

        .task-content::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .task-content::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.35);
        }

        .current-task {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
        }

        .task-number {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            font-weight: 500;
            margin-bottom: 4px;
        }

        .task-description {
            font-size: 13px;
            line-height: 1.4;
            color: rgba(255, 255, 255, 0.9);
            word-wrap: break-word;
        }

        .project-info {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 8px;
        }

        .project-name {
            font-weight: 500;
            color: rgba(255, 255, 255, 0.85);
        }

        .completed-tasks {
            margin-top: 8px;
        }

        .completed-title {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            font-weight: 500;
            margin-bottom: 8px;
        }

        .completed-task {
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.2);
            border-radius: 6px;
            padding: 8px;
            margin-bottom: 6px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .completed-task::before {
            content: '✓';
            color: rgba(34, 197, 94, 0.8);
            font-weight: bold;
            font-size: 12px;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 40px 20px;
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
            min-height: 200px;
        }

        .empty-state-icon {
            width: 32px;
            height: 32px;
            stroke: rgba(255, 255, 255, 0.5);
            stroke-width: 1.5;
        }

        .greeting-state {
            padding: 20px 16px;
            text-align: center;
            color: rgba(255, 255, 255, 0.8);
        }

        .greeting-text {
            font-size: 14px;
            margin-bottom: 8px;
        }

        .greeting-subtitle {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.6);
        }

        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .task-container {
            background: transparent !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        :host-context(body.has-glass) .task-container::before {
            display: none !important;
        }

        :host-context(body.has-glass) .current-task,
        :host-context(body.has-glass) .completed-task {
            background: transparent !important;
            border: none !important;
        }

        :host-context(body.has-glass) .task-content::-webkit-scrollbar-track,
        :host-context(body.has-glass) .task-content::-webkit-scrollbar-thumb {
            background: transparent !important;
        }
    `;

    constructor() {
        super();
        this.currentTask = '';
        this.taskNumber = 0;
        this.projectDescription = '';
        this.completedTasks = [];
        this.phase = 'greeting';
        this.isVisible = false;
    }

    connectedCallback() {
        super.connectedCallback();
        console.log('📋 TaskView connected');
        
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            // Listen for task updates from the ask service
            ipcRenderer.on('task-updated', (event, taskData) => {
                this.updateTask(taskData);
            });
            
            // Listen for window show/hide events
            ipcRenderer.on('window-show-animation', () => {
                this.classList.add('showing');
                this.classList.remove('hiding', 'hidden');
            });
            
            ipcRenderer.on('window-hide-animation', () => {
                this.classList.add('hiding');
                this.classList.remove('showing');
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('task-updated');
            ipcRenderer.removeAllListeners('window-show-animation');
            ipcRenderer.removeAllListeners('window-hide-animation');
        }
    }

    updateTask(taskData) {
        this.currentTask = taskData.currentTask || '';
        this.taskNumber = taskData.currentTaskNumber || 0;
        this.projectDescription = taskData.projectDescription || '';
        this.completedTasks = taskData.completedTasks || [];
        this.phase = taskData.phase || 'greeting';
        this.requestUpdate();
    }

    getHeaderText() {
        switch (this.phase) {
            case 'greeting':
                return 'Getting Started';
            case 'planning':
                return 'Planning Project';
            case 'task_assigned':
                return `Task ${this.taskNumber}`;
            case 'feedback':
                return 'Review & Feedback';
            case 'approved':
                return 'Task Complete!';
            default:
                return 'Current Task';
        }
    }

    renderContent() {
        if (this.phase === 'greeting') {
            return html`
                <div class="greeting-state">
                    <div class="greeting-text">Ready to start designing!</div>
                    <div class="greeting-subtitle">Tell the tutor what you'd like to create</div>
                </div>
            `;
        }

        if (this.phase === 'planning') {
            return html`
                <div class="task-content">
                    <div class="project-info">
                        <strong class="project-name">Project:</strong> ${this.projectDescription}
                    </div>
                    <div class="greeting-state">
                        <div class="greeting-text">Planning your design...</div>
                        <div class="greeting-subtitle">The tutor will assign your first task</div>
                    </div>
                </div>
            `;
        }

        if (!this.currentTask && this.completedTasks.length === 0) {
            return html`
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>No active task</span>
                    <span style="font-size: 12px; opacity: 0.7;">Start a conversation to begin</span>
                </div>
            `;
        }

        return html`
            <div class="task-content">
                ${this.projectDescription ? html`
                    <div class="project-info">
                        <strong class="project-name">Project:</strong> ${this.projectDescription}
                    </div>
                ` : ''}
                
                ${this.currentTask ? html`
                    <div class="current-task">
                        <div class="task-number">Task ${this.taskNumber}</div>
                        <div class="task-description">${this.currentTask}</div>
                    </div>
                ` : ''}
                
                ${this.completedTasks.length > 0 ? html`
                    <div class="completed-tasks">
                        <div class="completed-title">Completed (${this.completedTasks.length})</div>
                        ${this.completedTasks.map(task => html`
                            <div class="completed-task">${task}</div>
                        `)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    render() {
        return html`
            <div class="task-container">
                <!-- Task Header -->
                <div class="task-header">
                    <div class="header-left">
                        <div class="task-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                        <span class="task-title">${this.getHeaderText()}</span>
                    </div>
                </div>

                <!-- Task Content -->
                ${this.renderContent()}
            </div>
        `;
    }
}

customElements.define('task-view', TaskView);