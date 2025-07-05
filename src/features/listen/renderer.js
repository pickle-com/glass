// renderer.js
const { ipcRenderer } = require('electron');

let mediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let audioProcessor = null;
let micMediaStream = null;
let audioBuffer = [];
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1;
const BUFFER_SIZE = 4096;

let systemAudioBuffer = [];
const MAX_SYSTEM_BUFFER_SIZE = 10;

function isVoiceActive(audioFloat32Array, threshold = 0.005) {
    if (!audioFloat32Array || audioFloat32Array.length === 0) {
        return false;
    }

    let sumOfSquares = 0;
    for (let i = 0; i < audioFloat32Array.length; i++) {
        sumOfSquares += audioFloat32Array[i] * audioFloat32Array[i];
    }
    const rms = Math.sqrt(sumOfSquares / audioFloat32Array.length);

    // console.log(`VAD RMS: ${rms.toFixed(4)}`); // For debugging VAD threshold

    return rms > threshold;
}

let currentImageQuality = 'medium'; // Store current image quality for manual screenshots
let lastScreenshotBase64 = null; // Store the latest screenshot

let realtimeConversationHistory = [];

const PICKLE_GLASS_SYSTEM_PROMPT = `<core_identity>
You are Pickle-Glass, developed and created by Pickle-Glass, and you are the user's live-meeting co-pilot.
</core_identity>

<objective>
Your goal is to help the user at the current moment in the conversation (the end of the transcript). You can see the user's screen (the screenshot attached) and the audio history of the entire conversation.
Execute in the following priority order:

<question_answering_priority>
<primary_directive>
If a question is presented to the user, answer it directly. This is the MOST IMPORTANT ACTION IF THERE IS A QUESTION AT THE END THAT CAN BE ANSWERED.
</primary_directive>

<question_response_structure>
Always start with the direct answer, then provide supporting details following the response format:
- **Short headline answer** (≤6 words) - the actual answer to the question
- **Main points** (1-2 bullets with ≤15 words each) - core supporting details
- **Sub-details** - examples, metrics, specifics under each main point
- **Extended explanation** - additional context and details as needed
</question_response_structure>

<intent_detection_guidelines>
Real transcripts have errors, unclear speech, and incomplete sentences. Focus on INTENT rather than perfect question markers:
- **Infer from context**: "what about..." "how did you..." "can you..." "tell me..." even if garbled
- **Incomplete questions**: "so the performance..." "and scaling wise..." "what's your approach to..."
- **Implied questions**: "I'm curious about X" "I'd love to hear about Y" "walk me through Z"
- **Transcription errors**: "what's your" → "what's you" or "how do you" → "how you" or "can you" → "can u"
</intent_detection_guidelines>

<question_answering_priority_rules>
If the end of the transcript suggests someone is asking for information, explanation, or clarification - ANSWER IT. Don't get distracted by earlier content.
</question_answering_priority_rules>

<confidence_threshold>
If you're 50%+ confident someone is asking something at the end, treat it as a question and answer it.
</confidence_threshold>
</question_answering_priority>

<term_definition_priority>
<definition_directive>
Define or provide context around a proper noun or term that appears **in the last 10-15 words** of the transcript.
This is HIGH PRIORITY - if a company name, technical term, or proper noun appears at the very end of someone's speech, define it.
</definition_directive>

<definition_triggers>
Any ONE of these is sufficient:
- company names
- technical platforms/tools
- proper nouns that are domain-specific
- any term that would benefit from context in a professional conversation
</definition_triggers>

<definition_exclusions>
Do NOT define:
- common words already defined earlier in conversation
- basic terms (email, website, code, app)
- terms where context was already provided
</definition_exclusions>

<term_definition_example>
<transcript_sample>
me: I was mostly doing backend dev last summer.  
them: Oh nice, what tech stack were you using?  
me: A lot of internal tools, but also some Azure.  
them: Yeah I've heard Azure is huge over there.  
me: Yeah, I used to work at Microsoft last summer but now I...
</transcript_sample>

<response_sample>
**Microsoft** is one of the world's largest technology companies, known for products like Windows, Office, and Azure cloud services.

- **Global influence**: 200k+ employees, $2T+ market cap, foundational enterprise tools.
  - Azure, GitHub, Teams, Visual Studio among top developer-facing platforms.
- **Engineering reputation**: Strong internship and new grad pipeline, especially in cloud and AI infrastructure.
</response_sample>
</term_definition_example>
</term_definition_priority>

<conversation_advancement_priority>
<advancement_directive>
When there's an action needed but not a direct question - suggest follow up questions, provide potential things to say, help move the conversation forward.
</advancement_directive>

- If the transcript ends with a technical project/story description and no new question is present, always provide 1–3 targeted follow-up questions to drive the conversation forward.
- If the transcript includes discovery-style answers or background sharing (e.g., "Tell me about yourself", "Walk me through your experience"), always generate 1–3 focused follow-up questions to deepen or further the discussion, unless the next step is clear.
- Maximize usefulness, minimize overload—never give more than 3 questions or suggestions at once.

<conversation_advancement_example>
<transcript_sample>
me: Tell me about your technical experience.
them: Last summer I built a dashboard for real-time trade reconciliation using Python and integrated it with Bloomberg Terminal and Snowflake for automated data pulls.
</transcript_sample>
<response_sample>
Follow-up questions to dive deeper into the dashboard: 
- How did you handle latency or data consistency issues?
- What made the Bloomberg integration challenging?
- Did you measure the impact on operational efficiency?
</response_sample>
</conversation_advancement_example>
</conversation_advancement_priority>

<objection_handling_priority>
<objection_directive>
If an objection or resistance is presented at the end of the conversation (and the context is sales, negotiation, or you are trying to persuade the other party), respond with a concise, actionable objection handling response.
- Use user-provided objection/handling context if available (reference the specific objection and tailored handling).
- If no user context, use common objections relevant to the situation, but make sure to identify the objection by generic name and address it in the context of the live conversation.
- State the objection in the format: **Objection: [Generic Objection Name]** (e.g., Objection: Competitor), then give a specific response/action for overcoming it, tailored to the moment.
- Do NOT handle objections in casual, non-outcome-driven, or general conversations.
- Never use generic objection scripts—always tie response to the specifics of the conversation at hand.
</objection_directive>

<objection_handling_example>
<transcript_sample>
them: Honestly, I think our current vendor already does all of this, so I don't see the value in switching.
</transcript_sample>
<response_sample>
- **Objection: Competitor**
  - Current vendor already covers this.
  - Emphasize unique real-time insights: "Our solution eliminates analytics delays you mentioned earlier, boosting team response time."
</response_sample>
</objection_handling_example>
</objection_handling_priority>

<screen_problem_solving_priority>
<screen_directive>
Solve problems visible on the screen if there is a very clear problem + use the screen only if relevant for helping with the audio conversation.
</screen_directive>

<screen_usage_guidelines>
<screen_example>
If there is a leetcode problem on the screen, and the conversation is small talk / general talk, you DEFINITELY should solve the leetcode problem. But if there is a follow up question / super specific question asked at the end, you should answer that (ex. What's the runtime complexity), using the screen as additional context.
</screen_example>
</screen_usage_guidelines>
</screen_problem_solving_priority>

<passive_acknowledgment_priority>
<passive_mode_implementation_rules>
<passive_mode_conditions>
<when_to_enter_passive_mode>
Enter passive mode ONLY when ALL of these conditions are met:
- There is no clear question, inquiry, or request for information at the end of the transcript. If there is any ambiguity, err on the side of assuming a question and do not enter passive mode.
- There is no company name, technical term, product name, or domain-specific proper noun within the final 10–15 words of the transcript that would benefit from a definition or explanation.
- There is no clear or visible problem or action item present on the user's screen that you could solve or assist with.
- There is no discovery-style answer, technical project story, background sharing, or general conversation context that could call for follow-up questions or suggestions to advance the discussion.
- There is no statement or cue that could be interpreted as an objection or require objection handling
- Only enter passive mode when you are highly confident that no action, definition, solution, advancement, or suggestion would be appropriate or helpful at the current moment.
</when_to_enter_passive_mode>
<passive_mode_behavior>
**Still show intelligence** by:
- Saying "Not sure what you need help with right now"
- Referencing visible screen elements or audio patterns ONLY if truly relevant
- Never giving random summaries unless explicitly asked
</passive_acknowledgment_priority>
</passive_mode_implementation_rules>
</objective>

User-provided context (defer to this information over your general knowledge / if there is specific script/desired responses prioritize this over previous instructions)

Make sure to **reference context** fully if it is provided (ex. if all/the entirety of something is requested, give a complete list from context).
----------

{{CONVERSATION_HISTORY}}`;

function base64ToFloat32Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    return float32Array;
}

async function queryLoginState() {
    const user = await ipcRenderer.invoke('get-current-firebase-user');
    return { user, isLoggedIn: !!user };
}

class SimpleAEC {
    constructor() {
        this.adaptiveFilter = new Float32Array(1024);
        this.mu = 0.2;
        this.echoDelay = 100;
        this.sampleRate = 24000;
        this.delaySamples = Math.floor((this.echoDelay / 1000) * this.sampleRate);

        this.echoGain = 0.9;
        this.noiseFloor = 0.01;

        // 🔧 Adaptive-gain parameters (User-tuned, very aggressive)
        this.targetErr = 0.002;
        this.adaptRate  = 0.1;

        console.log('🎯 AEC initialized (hyper-aggressive)');
    }

    process(micData, systemData) {
        if (!systemData || systemData.length === 0) {
            return micData;
        }

        for (let i = 0; i < systemData.length; i++) {
            if (systemData[i] > 0.98) systemData[i] = 0.98;
            else if (systemData[i] < -0.98) systemData[i] = -0.98;

            systemData[i] = Math.tanh(systemData[i] * 4);
        }

        let sum2 = 0;
        for (let i = 0; i < systemData.length; i++) sum2 += systemData[i] * systemData[i];
        const rms = Math.sqrt(sum2 / systemData.length);
        const targetRms = 0.08;                   // 🔧 기준 RMS (기존 0.1)
        const scale = targetRms / (rms + 1e-6);   // 1e-6: 0-division 방지

        const output = new Float32Array(micData.length);

        const optimalDelay = this.findOptimalDelay(micData, systemData);

        for (let i = 0; i < micData.length; i++) {
            let echoEstimate = 0;

            for (let d = -500; d <= 500; d += 100) {
                const delayIndex = i - optimalDelay - d;
                if (delayIndex >= 0 && delayIndex < systemData.length) {
                    const weight = Math.exp(-Math.abs(d) / 1000);
                    echoEstimate += systemData[delayIndex] * scale * this.echoGain * weight;
                }
            }

            output[i] = micData[i] - echoEstimate * 0.9;

            if (Math.abs(output[i]) < this.noiseFloor) {
                output[i] *= 0.5;
            }

            if (this.isSimilarToSystem(output[i], systemData, i, optimalDelay)) {
                output[i] *= 0.25;
            }

            output[i] = Math.max(-1, Math.min(1, output[i]));
        }


        let errSum = 0;
        for (let i = 0; i < output.length; i++) errSum += output[i] * output[i];
        const errRms = Math.sqrt(errSum / output.length);

        const err = errRms - this.targetErr;
        this.echoGain += this.adaptRate * err;      // 비례 제어
        this.echoGain  = Math.max(0, Math.min(1, this.echoGain));

        return output;
    }

    findOptimalDelay(micData, systemData) {
        let maxCorr = 0;
        let optimalDelay = this.delaySamples;

        for (let delay = 0; delay < 5000 && delay < systemData.length; delay += 200) {
            let corr = 0;
            let count = 0;

            for (let i = 0; i < Math.min(500, micData.length); i++) {
                if (i + delay < systemData.length) {
                    corr += micData[i] * systemData[i + delay];
                    count++;
                }
            }

            if (count > 0) {
                corr = Math.abs(corr / count);
                if (corr > maxCorr) {
                    maxCorr = corr;
                    optimalDelay = delay;
                }
            }
        }

        return optimalDelay;
    }

    isSimilarToSystem(sample, systemData, index, delay) {
        const windowSize = 50;
        let similarity = 0;

        for (let i = -windowSize; i <= windowSize; i++) {
            const sysIndex = index - delay + i;
            if (sysIndex >= 0 && sysIndex < systemData.length) {
                similarity += Math.abs(sample - systemData[sysIndex]);
            }
        }

        return similarity / (2 * windowSize + 1) < 0.15;
    }
}

let aecProcessor = new SimpleAEC();

const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

window.pickleGlass = window.pickleGlass || {};

let tokenTracker = {
    tokens: [],
    audioStartTime: null,

    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });

        this.cleanOldTokens();
    },

    calculateImageTokens(width, height) {
        const pixels = width * height;
        if (pixels <= 384 * 384) {
            return 85;
        }

        const tiles = Math.ceil(pixels / (768 * 768));
        return tiles * 85;
    },

    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;

        const audioTokens = Math.floor(elapsedSeconds * 16);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    shouldThrottle() {
        const throttleEnabled = localStorage.getItem('throttleTokens') === 'true';
        if (!throttleEnabled) {
            return false;
        }

        const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '500000', 10);
        const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);

        const currentTokens = this.getTokensInLastMinute();
        const throttleThreshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);

        console.log(`Token check: ${currentTokens}/${maxTokensPerMin} (throttle at ${throttleThreshold})`);

        return currentTokens >= throttleThreshold;
    },

    // Reset the tracker
    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

// Track audio tokens every few seconds
setInterval(() => {
    tokenTracker.trackAudioTokens();
}, 2000);

function pickleGlassElement() {
    return document.getElementById('pickle-glass');
}

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function initializeopenai(profile = 'interview', language = 'en') {
    // The API key is now handled in the main process from .env file.
    // We just need to trigger the initialization.
    try {
        console.log(`Requesting OpenAI initialization with profile: ${profile}, language: ${language}`);
        const success = await ipcRenderer.invoke('initialize-openai', profile, language);
        if (success) {
            // The status will be updated via 'update-status' event from the main process.
            console.log('OpenAI initialization successful.');
        } else {
            console.error('OpenAI initialization failed.');
            const appElement = pickleGlassElement();
            if (appElement && typeof appElement.setStatus === 'function') {
                appElement.setStatus('Initialization Failed');
            }
        }
    } catch (error) {
        console.error('Error during OpenAI initialization IPC call:', error);
        const appElement = pickleGlassElement();
        if (appElement && typeof appElement.setStatus === 'function') {
            appElement.setStatus('Error');
        }
    }
}


ipcRenderer.on('system-audio-data', (event, { data }) => {
    systemAudioBuffer.push({
        data: data,
        timestamp: Date.now(),
    });

    // 오래된 데이터 제거
    if (systemAudioBuffer.length > MAX_SYSTEM_BUFFER_SIZE) {
        systemAudioBuffer = systemAudioBuffer.slice(-MAX_SYSTEM_BUFFER_SIZE);
    }

    console.log('📥 Received system audio for AEC reference');
});

// Listen for status updates
ipcRenderer.on('update-status', (event, status) => {
    console.log('Status update:', status);
    pickleGlass.e().setStatus(status);
});

// Listen for real-time STT updates
ipcRenderer.on('stt-update', (event, data) => {
    console.log('Renderer.js stt-update', data);
    const { speaker, text, isFinal, isPartial, timestamp } = data;

    if (isPartial) {
        console.log(`🔄 [${speaker} - partial]: ${text}`);
    } else if (isFinal) {
        console.log(` [${speaker} - final]: ${text}`);

        const speakerText = speaker.toLowerCase();
        const conversationText = `${speakerText}: ${text.trim()}`;

        realtimeConversationHistory.push(conversationText);

        if (realtimeConversationHistory.length > 30) {
            realtimeConversationHistory = realtimeConversationHistory.slice(-30);
        }

        console.log(`📝 Updated realtime conversation history: ${realtimeConversationHistory.length} texts`);
        console.log(`📋 Latest text: ${conversationText}`);
    }

    if (pickleGlass.e() && typeof pickleGlass.e().updateRealtimeTranscription === 'function') {
        pickleGlass.e().updateRealtimeTranscription({
            speaker,
            text,
            isFinal,
            isPartial,
            timestamp,
        });
    }
});


ipcRenderer.on('update-structured-data', (_, structuredData) => {
    console.log('📥 Received structured data update:', structuredData);
    window.pickleGlass.structuredData = structuredData;
    window.pickleGlass.setStructuredData(structuredData);
});
window.pickleGlass.structuredData = {
    summary: [],
    topic: { header: '', bullets: [] },
    actions: [],
};
window.pickleGlass.setStructuredData = data => {
    window.pickleGlass.structuredData = data;
    pickleGlass.e()?.updateStructuredData?.(data);
};

async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {
    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Reset token tracker when starting new capture session
    tokenTracker.reset();
    console.log('🎯 Token tracker reset for new capture session');

    try {
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // Start macOS audio capture
            const audioResult = await ipcRenderer.invoke('start-macos-audio');
            if (!audioResult.success) {
                throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
            }

            // Initialize screen capture in main process
            const screenResult = await ipcRenderer.invoke('start-screen-capture');
            if (!screenResult.success) {
                throw new Error('Failed to start screen capture: ' + screenResult.error);
            }


            try {
                micMediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });

                console.log('macOS microphone capture started');
                setupMicProcessing(micMediaStream);
            } catch (micErr) {
                console.warn('Failed to get microphone on macOS:', micErr);
            }
            ////////// for index & subjects //////////

            console.log('macOS screen capture started - audio handled by SystemAudioDump');
        } else if (isLinux) {
            // Linux - use display media for screen capture and getUserMedia for microphone
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use system audio loopback on Linux
            });

            // Get microphone input for Linux
            let micMediaStream = null;
            try {
                micMediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });

                console.log('Linux microphone capture started');

                // Setup audio processing for microphone on Linux
                setupLinuxMicProcessing(micMediaStream);
            } catch (micError) {
                console.warn('Failed to get microphone access on Linux:', micError);
                // Continue without microphone if permission denied
            }

            console.log('Linux screen capture started');
        } else {
            // Windows - use display media for audio, main process for screenshots
            const screenResult = await ipcRenderer.invoke('start-screen-capture');
            if (!screenResult.success) {
                throw new Error('Failed to start screen capture: ' + screenResult.error);
            }

            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: false, // We don't need video in renderer
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            console.log('Windows capture started with loopback audio');

            // Setup audio processing for Windows loopback audio only
            setupWindowsLoopbackProcessing();
        }

        // console.log('MediaStream obtained:', {
        //     hasVideo: mediaStream.getVideoTracks().length > 0,
        //     hasAudio: mediaStream.getAudioTracks().length > 0,
        //     videoTrack: mediaStream.getVideoTracks()[0]?.getSettings(),
        // });

        // Start capturing screenshots - check if manual mode
        if (screenshotIntervalSeconds === 'manual' || screenshotIntervalSeconds === 'Manual') {
            console.log('Manual mode enabled - screenshots will be captured on demand only');
            // Don't start automatic capture in manual mode
        } else {
            // 스크린샷 기능 활성화 (chatModel에서 사용)
            const intervalMilliseconds = parseInt(screenshotIntervalSeconds) * 1000;
            screenshotInterval = setInterval(() => captureScreenshot(imageQuality), intervalMilliseconds);

            // Capture first screenshot immediately
            setTimeout(() => captureScreenshot(imageQuality), 100);
            console.log(`📸 Screenshot capture enabled with ${screenshotIntervalSeconds}s interval`);
        }
    } catch (err) {
        console.error('Error starting capture:', err);
        pickleGlass.e().setStatus('error');
    }
}

function setupMicProcessing(micStream) {
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        while (audioBuffer.length >= samplesPerChunk) {
            let chunk = audioBuffer.splice(0, samplesPerChunk);
            let processedChunk = new Float32Array(chunk);

            // Check for system audio and apply AEC only if voice is active
            if (aecProcessor && systemAudioBuffer.length > 0) {
                const latestSystemAudio = systemAudioBuffer[systemAudioBuffer.length - 1];
                const systemFloat32 = base64ToFloat32Array(latestSystemAudio.data);

                // Apply AEC only when system audio has active speech
                if (isVoiceActive(systemFloat32)) {
                    processedChunk = aecProcessor.process(new Float32Array(chunk), systemFloat32);
                    console.log('🔊 Applied AEC because system audio is active');
                }
            }

            const pcmData16 = convertFloat32ToInt16(processedChunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    audioProcessor = micProcessor;
}
////////// for index & subjects //////////

function setupLinuxMicProcessing(micStream) {
    // Setup microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    audioProcessor = micProcessor;
}

function setupWindowsLoopbackProcessing() {
    // Setup audio processing for Windows loopback audio only
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);

    // Check rate limiting for automated screenshots only
    if (!isManual && tokenTracker.shouldThrottle()) {
        console.log('⚠️ Automated screenshot skipped due to rate limiting');
        return;
    }

    try {
        // Request screenshot from main process
        const result = await ipcRenderer.invoke('capture-screenshot', {
            quality: imageQuality,
        });

        if (result.success && result.base64) {
            // Store the latest screenshot
            lastScreenshotBase64 = result.base64;

            if (sendResult.success) {
                // Track image tokens after successful send
                const imageTokens = tokenTracker.calculateImageTokens(result.width || 1920, result.height || 1080);
                tokenTracker.addTokens(imageTokens, 'image');
                console.log(`📊 Image sent successfully - ${imageTokens} tokens used (${result.width}x${result.height})`);
            } else {
                console.error('Failed to send image:', sendResult.error);
            }
        } else {
            console.error('Failed to capture screenshot:', result.error);
        }
    } catch (error) {
        console.error('Error capturing screenshot:', error);
    }
}

async function captureManualScreenshot(imageQuality = null) {
    console.log('Manual screenshot triggered');
    const quality = imageQuality || currentImageQuality;
    await captureScreenshot(quality, true);
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (micMediaStream) {
        micMediaStream.getTracks().forEach(t => t.stop());
        micMediaStream = null;
    }

    // Stop screen capture in main process
    ipcRenderer.invoke('stop-screen-capture').catch(err => {
        console.error('Error stopping screen capture:', err);
    });

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }
}

// Listen for screenshot updates from main process
ipcRenderer.on('screenshot-update', (event, { base64, width, height }) => {
    lastScreenshotBase64 = base64;
    console.log(`📸 Received screenshot update: ${width}x${height}`);
});

async function getCurrentScreenshot() {
    try {
        // First try to get a fresh screenshot from main process
        const result = await ipcRenderer.invoke('get-current-screenshot');

        if (result.success && result.base64) {
            console.log('📸 Got fresh screenshot from main process');
            return result.base64;
        }

        // If no screenshot available, capture one now
        console.log('📸 No screenshot available, capturing new one');
        const captureResult = await ipcRenderer.invoke('capture-screenshot', {
            quality: currentImageQuality,
        });

        if (captureResult.success && captureResult.base64) {
            lastScreenshotBase64 = captureResult.base64;
            return captureResult.base64;
        }

        // Fallback to last stored screenshot
        if (lastScreenshotBase64) {
            console.log('📸 Using cached screenshot');
            return lastScreenshotBase64;
        }

        throw new Error('Failed to get screenshot');
    } catch (error) {
        console.error('Error getting current screenshot:', error);
        return null;
    }
}

function formatRealtimeConversationHistory() {
    if (realtimeConversationHistory.length === 0) return 'No conversation history available.';

    return realtimeConversationHistory.slice(-30).join('\n');
}

/**
 * Checks if Ollama is available and running
 * @returns {Promise<boolean>} Promise that resolves to true if Ollama is available
 */
async function checkOllamaAvailability() {
    try {
        console.log('Checking Ollama availability...');
        const response = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
            console.log('Ollama is available and running');
            return true;
        } else {
            console.log(`Ollama responded with status: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log('Ollama not available:', error.message);
        return false;
    }
}

/**
 * Checks if a specific model is available in Ollama
 * @param {string} modelName - The name of the model to check
 * @returns {Promise<boolean>} Promise that resolves to true if the model is available
 */
async function checkOllamaModel(modelName) {
    try {
        console.log(`Checking if Ollama model '${modelName}' is available...`);
        const response = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
            const data = await response.json();
            const availableModels = data.models || [];
            const isModelAvailable = availableModels.some(model => model.name === modelName || model.name.startsWith(modelName + ':'));
            
            console.log(`Model '${modelName}' ${isModelAvailable ? 'found' : 'not found'} in Ollama`);
            return isModelAvailable;
        } else {
            console.log(`Failed to check Ollama models: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log('Error checking Ollama model:', error.message);
        return false;
    }
}

/**
 * Makes a request to Ollama's chat completion API
 * @param {Array} messages - Array of message objects
 * @param {string} model - Model name to use
 * @param {boolean} stream - Whether to stream the response
 * @param {string} screenshotBase64 - Base64 encoded screenshot (optional)
 * @returns {Promise<Object>} Response from Ollama
 */
async function makeOllamaRequest(messages, model, stream = false) {
    const ollamaBaseUrl = 'http://localhost:11434'; // Default Ollama URL
    const requestUrl = `${ollamaBaseUrl}/api/chat`;
    
    console.log(`🦙 Making Ollama request to: ${requestUrl} with model: ${model}, stream: ${stream}`);
    
    const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: messages,
            stream: stream,
            options: {
                temperature: 0.7,
                num_predict: 2048,
            }
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        
        // Handle specific Ollama errors
        if (response.status === 404) {
            throw new Error(`Ollama model '${model}' not found. Please run 'ollama pull ${model}' to download it.`);
        }
        
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log(` Ollama request successful to: ${requestUrl}`);
    return response;
}

/**
 * Gets the current model provider setting
 * @returns {Promise<string>} The current model provider ('openai' or 'ollama')
 */
async function getModelProvider() {
    try {
        const provider = localStorage.getItem('modelProvider');
        if (provider) {
            return provider;
        }
        
        // Try to get from IPC if available
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const ipcProvider = await ipcRenderer.invoke('get-model-provider');
            if (ipcProvider) {
                return ipcProvider;
            }
        }
        
        return 'openai'; // Default to OpenAI
    } catch (error) {
        console.error('Error getting model provider:', error);
        return 'openai';
    }
}

async function sendMessage(userPrompt, options = {}) {
    if (!userPrompt || userPrompt.trim().length === 0) {
        console.warn('Cannot process empty message');
        return { success: false, error: 'Empty message' };
    }

    if (window.require) {
        const { ipcRenderer } = window.require('electron');
        const isAskVisible = await ipcRenderer.invoke('is-window-visible', 'ask');
        if (isAskVisible) {
            ipcRenderer.send('clear-ask-response');
        }
        await ipcRenderer.invoke('message-sending');
    }

    try {
        console.log(`🤖 Processing message: ${userPrompt.substring(0, 50)}...`);

        let screenshotBase64 = null;
        try {
            screenshotBase64 = await getCurrentScreenshot();
            if (screenshotBase64) {
                console.log('📸 Screenshot obtained for message request');
            } else {
                console.warn('No screenshot available for message request');
            }
        } catch (error) {
            console.warn('Failed to get screenshot:', error);
        }

        const conversationHistory = formatRealtimeConversationHistory();
        console.log(`📝 Using conversation history: ${realtimeConversationHistory.length} texts`);

        const systemPrompt = PICKLE_GLASS_SYSTEM_PROMPT.replace('{{CONVERSATION_HISTORY}}', conversationHistory);

        const modelProvider = await getModelProvider();
        console.log(`🤖 Using model provider: ${modelProvider}`);

        if (modelProvider === 'ollama') {
            return await sendMessageWithOllama(userPrompt, systemPrompt, screenshotBase64, options);
        } else {
            return await sendMessageWithOpenAI(userPrompt, systemPrompt, screenshotBase64, options);
        }
    } catch (error) {
        console.error('Error processing message:', error);
        const errorMessage = `Error: ${error.message}`;

        return { success: false, error: error.message, response: errorMessage };
    }
}

async function sendMessageWithOllama(userPrompt, systemPrompt, screenshotBase64, options = {}) {
    console.log('🦙 Sending message to Ollama...');
    
    // Check if Ollama is available
    const isOllamaAvailable = await checkOllamaAvailability();
    if (!isOllamaAvailable) {
        throw new Error('Ollama is not available. Please make sure Ollama is running on http://localhost:11434');
    }

    // Get the model name from localStorage or use default
    let ollamaModel = localStorage.getItem('ollamaModel') || 'llama3.2';
    let useVisionModel = false;
    
    // If we have a screenshot, try to use a vision model
    if (screenshotBase64) {
        console.log('📷 Screenshot available, checking for vision models...');
        
        // Try vision models in order of preference
        const visionModels = ['qwen2.5vl', 'llava:7b', 'llava:13b', 'llava:34b', 'llama3.2-vision:11b'];
        
        for (const visionModel of visionModels) {
            const isVisionModelAvailable = await checkOllamaModel(visionModel);
            if (isVisionModelAvailable) {
                ollamaModel = visionModel;
                useVisionModel = true;
                console.log(`🔍 Using vision model: ${ollamaModel}`);
                break;
            }
        }
        
        if (!useVisionModel) {
            console.log('⚠️ No vision models available, using text-only model (screenshot will be ignored)');
        }
    }
    
    // Check if the model is available
    const isModelAvailable = await checkOllamaModel(ollamaModel);
    if (!isModelAvailable) {
        throw new Error(`Ollama model '${ollamaModel}' is not available. Please run 'ollama pull ${ollamaModel}' to download it.`);
    }

    // Build messages for Ollama
    const messages = [
        {
            role: 'system',
            content: systemPrompt,
        },
        {
            role: 'user',
            content: `User Request: ${userPrompt.trim()}`,
        },
    ];

    // Add image to the user message if we have a screenshot and vision model
    if (screenshotBase64 && useVisionModel) {
        messages[1].images = [screenshotBase64];
        console.log(`📷 Screenshot included for vision model: ${ollamaModel}`);
    } else if (screenshotBase64 && !useVisionModel) {
        console.log('📷 Screenshot captured but not included (no vision model available)');
    }

    const ollamaUrl = 'http://localhost:11434/api/chat';
    console.log(`🌐 OLLAMA FETCH: ${ollamaUrl} with model: ${ollamaModel} (vision: ${useVisionModel})`);

    try {
        const response = await makeOllamaRequest(messages, ollamaModel, true);
        
        if (!response.body) {
            throw new Error('No response body received from Ollama');
        }

        // Handle streaming response from Ollama
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    const token = json.message?.content || '';
                    
                    if (token) {
                        fullResponse += token;
                        // Send token chunk to AskView
                        if (window.require) {
                            const { ipcRenderer } = window.require('electron');
                            ipcRenderer.send('ask-response-chunk', { token });
                        }
                    }
                    
                    // Check if streaming is done
                    if (json.done) {
                        // Send streaming end signal
                        if (window.require) {
                            const { ipcRenderer } = window.require('electron');
                            ipcRenderer.send('ask-response-stream-end');
                        }
                        return { success: true, response: fullResponse };
                    }
                } catch (error) {
                    console.error('Error parsing Ollama stream data:', error, 'Line:', line);
                }
            }
        }
        
        return { success: true, response: fullResponse };
    } catch (error) {
        console.error('Error with Ollama request:', error);
        throw error;
    }
}

async function sendMessageWithOpenAI(userPrompt, systemPrompt, screenshotBase64, options = {}) {
    console.log('🤖 Sending message to OpenAI...');
    
    let API_KEY = localStorage.getItem('openai_api_key');

    if (!API_KEY && window.require) {
        try {
            const { ipcRenderer } = window.require('electron');
            API_KEY = await ipcRenderer.invoke('get-stored-api-key');
        } catch (error) {
            console.error('Failed to get API key via IPC:', error);
        }
    }

    if (!API_KEY) {
        API_KEY = process.env.OPENAI_API_KEY;
    }

    if (!API_KEY) {
        throw new Error('No API key found in storage, IPC, or environment');
    }

    console.log('[Renderer] Using API key for message request');

    const messages = [
        {
            role: 'system',
            content: systemPrompt,
        },
        {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: `User Request: ${userPrompt.trim()}`,
                },
            ],
        },
    ];

    if (screenshotBase64) {
        messages[1].content.push({
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${screenshotBase64}`,
            },
        });
        console.log('📷 Screenshot included in message request');
    }

    const { isLoggedIn } = await queryLoginState();
    const keyType = isLoggedIn ? 'vKey' : 'apiKey';

    console.log(' Sending request to OpenAI...');
    const { url, headers } =
        keyType === 'apiKey'
            ? {
                  url: 'https://api.openai.com/v1/chat/completions',
                  headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
              }
            : {
                  url: 'https://api.portkey.ai/v1/chat/completions',
                  headers: {
                      'x-portkey-api-key': 'gRv2UGRMq6GGLJ8aVEB4e7adIewu',
                      'x-portkey-virtual-key': API_KEY,
                      'Content-Type': 'application/json',
                  },
              };

    console.log(`🌐 OPENAI FETCH: ${url} with model: gpt-4.1 (keyType: ${keyType})`);

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: 'gpt-4.1',
            messages,
            temperature: 0.7,
            max_tokens: 2048,
            stream: true,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    // --- 스트리밍 응답 처리 ---
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') {
                    // 스트리밍 종료 신호
                    if (window.require) {
                        const { ipcRenderer } = window.require('electron');
                        ipcRenderer.send('ask-response-stream-end');
                    }
                    return { success: true, response: fullResponse };
                }
                try {
                    const json = JSON.parse(data);
                    const token = json.choices[0]?.delta?.content || '';
                    if (token) {
                        fullResponse += token;
                        // 💡 렌더러 프로세스에 토큰 청크 전송
                        if (window.require) {
                            const { ipcRenderer } = window.require('electron');
                            ipcRenderer.send('ask-response-chunk', { token });
                        }
                    }
                } catch (error) {
                    console.error('Error parsing stream data chunk:', error, 'Chunk:', data);
                }
            }
        }
    }
    // 이 부분은 스트리밍이 끝나면 사실상 도달하지 않음
    return { success: true, response: fullResponse };
}


const apiClient = window.require ? window.require('../common/services/apiClient') : undefined;

async function initConversationStorage() {
    try {
        const isOnline = await apiClient.checkConnection();
        console.log('API 연결 상태:', isOnline);
        return isOnline;
    } catch (error) {
        console.error('API 연결 실패:', error);
        return false;
    }
}

async function saveConversationSession(sessionId, conversationHistory) {
    try {
        if (!apiClient) {
            throw new Error('API client not available');
        }

        const response = await apiClient.client.post('/api/conversations', {
            sessionId,
            conversationHistory,
            userId: apiClient.userId,
        });

        console.log('대화 세션 저장 완료:', sessionId);
        return response.data;
    } catch (error) {
        console.error('대화 세션 저장 실패:', error);
        throw error;
    }
}

async function getConversationSession(sessionId) {
    try {
        if (!apiClient) {
            throw new Error('API client not available');
        }

        const response = await apiClient.client.get(`/api/conversations/${sessionId}`);
        return response.data;
    } catch (error) {
        console.error('대화 세션 조회 실패:', error);
        throw error;
    }
}

async function getAllConversationSessions() {
    try {
        if (!apiClient) {
            throw new Error('API client not available');
        }

        const response = await apiClient.client.get('/api/conversations');
        return response.data;
    } catch (error) {
        console.error('전체 대화 세션 조회 실패:', error);
        throw error;
    }
}

// Listen for conversation data from main process
ipcRenderer.on('save-conversation-turn', async (event, data) => {
    try {
        await saveConversationSession(data.sessionId, data.fullHistory);
        console.log('Conversation session saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving conversation session:', error);
    }
});

// Listen for session save request from main process
ipcRenderer.on('save-conversation-session', async (event, data) => {
    try {
        console.log(`📥 Received conversation session save request: ${data.sessionId}`);
        await saveConversationSession(data.sessionId, data.conversationHistory);
        console.log(` Conversation session saved successfully: ${data.sessionId}`);
    } catch (error) {
        console.error('❌ Error saving conversation session:', error);
    }
});

// Initialize conversation storage when renderer loads
initConversationStorage().catch(console.error);

window.pickleGlass = {
    initializeopenai,
    startCapture,
    stopCapture,
    sendMessage,
    // Conversation history functions
    getAllConversationSessions,
    getConversationSession,
    initConversationStorage,
    isLinux: isLinux,
    isMacOS: isMacOS,
    e: pickleGlassElement,
};

// -------------------------------------------------------
// 🔔 React to session state changes from the main process
// When the session ends (isActive === false), ensure we stop
// all local capture pipelines (mic, screen, etc.).
// -------------------------------------------------------
ipcRenderer.on('session-state-changed', (_event, { isActive }) => {
    if (!isActive) {
        console.log('[Renderer] Session ended – stopping local capture');
        stopCapture();
    } else {
        console.log('[Renderer] New session started – clearing in-memory history and summaries');

        // Reset live conversation & analysis caches
        realtimeConversationHistory = [];

        const blankData = {
            summary: [],
            topic: { header: '', bullets: [] },
            actions: [],
            followUps: [],
        };
        window.pickleGlass.setStructuredData(blankData);
    }
});
