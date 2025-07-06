import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class OnboardingView extends LitElement {
    static styles = css`
        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            position: relative;
            overflow: hidden;
        }

        .slide {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: flex-start;
            padding: 20px;
            text-align: left;
            border-radius: 16px;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 50px;
            transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
            opacity: 0;
            transform: translateX(100%);
        }

        .slide.active {
            opacity: 1;
            transform: translateX(0);
        }

        .slide.prev {
            transform: translateX(-100%);
        }

        .slide-1 {
            background: linear-gradient(135deg, #2d1b69 0%, #11998e 100%);
            color: white;
        }

        .slide-2 {
            background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
            color: white;
        }

        .slide-3 {
            background: linear-gradient(135deg, #2c5aa0 0%, #1a237e 100%);
            color: white;
        }

        .slide-4 {
            background: linear-gradient(135deg, #fc466b 0%, #3f5efb 100%);
            color: white;
        }

        .slide-5 {
            background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 100%);
            color: white;
        }

        .slide-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 12px;
            margin-top: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .slide-content {
            font-size: 14px;
            line-height: 1.5;
            max-width: 100%;
            margin-bottom: 20px;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .context-textarea {
            width: 100%;
            max-width: 100%;
            height: 80px;
            padding: 12px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
        }

        .context-textarea::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }

        .context-textarea:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.6);
            background: rgba(255, 255, 255, 0.15);
        }

        .navigation {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
        }

        .nav-button {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .nav-button:hover {
            background: rgba(255, 255, 255, 0.3);
            border-color: rgba(255, 255, 255, 0.5);
        }

        .nav-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .nav-button:disabled:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.3);
        }

        .progress-dots {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transition: all 0.3s ease;
        }

        .dot.active {
            background: white;
            transform: scale(1.2);
        }

        .emoji {
            position: absolute;
            top: 15px;
            right: 15px;
            font-size: 40px;
            transform: rotate(15deg);
            z-index: 1;
        }

        .feature-list {
            text-align: left;
            max-width: 100%;
        }

        .feature-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            font-size: 14px;
        }

        .feature-icon {
            font-size: 16px;
            margin-right: 8px;
        }
    `;

    static properties = {
        currentSlide: { type: Number },
        contextText: { type: String },
        onComplete: { type: Function },
        onClose: { type: Function },
    };

    constructor() {
        super();
        this.currentSlide = 0;
        this.contextText = '';
        this.onComplete = () => {};
        this.onClose = () => {};
    }

    nextSlide() {
        if (this.currentSlide < 4) {
            this.currentSlide++;
        } else {
            this.completeOnboarding();
        }
    }

    prevSlide() {
        if (this.currentSlide > 0) {
            this.currentSlide--;
        }
    }

    handleContextInput(e) {
        this.contextText = e.target.value;
    }

    completeOnboarding() {
        // Save the context text to localStorage as custom prompt
        if (this.contextText.trim()) {
            localStorage.setItem('customPrompt', this.contextText.trim());
        }

        // Mark onboarding as completed
        localStorage.setItem('onboardingCompleted', 'true');

        // Call the completion callback
        this.onComplete();
    }

    renderSlide1() {
        return html`
            <div class="slide slide-1 ${this.currentSlide === 0 ? 'active' : ''}">
                <div class="emoji">👋</div>
                <div class="slide-title">Welcome to Pickle Glass!</div>
                <div class="slide-content">
                    Pickle Glass hears what you hear and sees what you see, then generates AI-powered suggestions without any user input needed.
                </div>
            </div>
        `;
    }

    renderSlide2() {
        return html`
            <div class="slide slide-2 ${this.currentSlide === 1 ? 'active' : ''}">
                <div class="emoji">🔒</div>
                <div class="slide-title">Completely Private</div>
                <div class="slide-content">
                    Your secret weapon is completely invisible! It won't show up on screen sharing apps, keeping your assistance completely private
                    during interviews and meetings.
                </div>
            </div>
        `;
    }

    renderSlide3() {
        return html`
            <div class="slide slide-3 ${this.currentSlide === 2 ? 'active' : ''}">
                <div class="emoji">📝</div>
                <div class="slide-title">Tell Us Your Context</div>
                <div class="slide-content">
                    Help the AI understand your situation better by sharing your context - like your resume, the job description, or interview
                    details.
                </div>
                <textarea
                    class="context-textarea"
                    placeholder="Paste your resume, job description, interview context, or any relevant information here..."
                    .value=${this.contextText}
                    @input=${this.handleContextInput}
                ></textarea>
            </div>
        `;
    }

    renderSlide4() {
        return html`
            <div class="slide slide-4 ${this.currentSlide === 3 ? 'active' : ''}">
                <div class="emoji">⚙️</div>
                <div class="slide-title">Explore More Features</div>
                <div class="feature-list">
                    <div class="feature-item">
                        <span class="feature-icon">🎨</span>
                        Customize settings and AI profiles
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">📚</span>
                        View your conversation history
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">🔧</span>
                        Adjust screenshot intervals and quality
                    </div>
                </div>
            </div>
        `;
    }

    renderSlide5() {
        return html`
            <div class="slide slide-5 ${this.currentSlide === 4 ? 'active' : ''}">
                <div class="emoji">🎉</div>
                <div class="slide-title">You're All Set!</div>
                <div class="slide-content">
                    Pickle Glass is completely free to use. Just add your openai API key and start getting AI-powered assistance in your interviews
                    and meetings!
                </div>
            </div>
        `;
    }

    render() {
        return html`
            ${this.renderSlide1()} ${this.renderSlide2()} ${this.renderSlide3()} ${this.renderSlide4()} ${this.renderSlide5()}

            <div class="navigation">
                <button class="nav-button" @click=${this.prevSlide} ?disabled=${this.currentSlide === 0}>
                    <svg
                        width="16px"
                        height="16px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="#ffffff"
                    >
                        <path d="M15 6L9 12L15 18" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>

                <div class="progress-dots">
                    ${[0, 1, 2, 3, 4].map(index => html` <div class="dot ${index === this.currentSlide ? 'active' : ''}"></div> `)}
                </div>

                <button class="nav-button" @click=${this.nextSlide}>
                    ${this.currentSlide === 4
                        ? 'Get Started'
                        : html`
                              <svg
                                  width="16px"
                                  height="16px"
                                  stroke-width="1.7"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  color="#ffffff"
                              >
                                  <path d="M9 6L15 12L9 18" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                              </svg>
                          `}
                </button>
            </div>
        `;
    }
}

customElements.define('onboarding-view', OnboardingView);
