# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glass by Pickle is an open-source desktop AI assistant application built with Electron and Next.js. It acts as a "Digital Mind Extension" that lives on your desktop, processes audio/visual context, and provides proactive AI assistance.

## Essential Commands

### Development
```bash
npm run setup          # Complete setup: install deps, build web, start app
npm start              # Build renderer and start Electron app
npm run watch:renderer # Hot reload development mode
npm run lint           # ESLint code quality check (run before commits)
npm run build          # Production build (verify changes work)
```

### Web Dashboard (pickleglass_web/)
```bash
cd pickleglass_web
npm run dev            # Next.js development server
npm run build          # Production build
npm run lint           # Next.js linting
```

### Testing
- No automated test framework currently configured
- Verify changes with `npm run build` and `npm run lint`
- Manual testing via `npm start`

## Architecture

### Service-Repository Pattern
**Strict separation of concerns - follow this pattern for all new code:**

1. **Views** (`*.html`, `*View.js`): UI layer only, no business logic
2. **Services** (`*Service.js`): Business logic, bridge between views and data
3. **Repositories** (`*.repository.js`): Data access only, touches databases

### Key Directories
```
src/features/           # Feature modules (ask, listen, settings, shortcuts)
src/features/common/    # Shared services, repositories, AI providers
src/bridge/            # IPC communication handlers
pickleglass_web/       # Next.js web dashboard
docs/                  # Architecture guides (read DESIGN_PATTERNS.md)
```

### Database System
- **Dual database**: SQLite (local) + Firebase Firestore (cloud sync)
- **Factory pattern**: Automatic switching based on connectivity/auth
- **Schema**: Centralized in `src/common/config/schema.js`
- **Encryption**: All sensitive data encrypted before cloud storage

## Technology Stack

- **Main**: Electron (Node.js 20.x.x)
- **Web**: Next.js 14 + TypeScript + TailwindCSS
- **Database**: SQLite + Firebase Firestore
- **AI**: Anthropic, OpenAI, Gemini, Ollama integration
- **Audio**: Deepgram SDK, custom AEC processing

## Development Guidelines

### Code Structure
- Follow existing Service-Repository pattern (see `docs/DESIGN_PATTERNS.md`)
- Use factory pattern for AI providers (`src/features/common/ai/factory.js`)
- Keep IPC handlers feature-based in `bridge/featureBridge.js`

### Adding Features
1. Create feature module in `src/features/`
2. Implement service and repository layers
3. Add IPC bridge handlers if needed
4. Follow existing patterns for AI provider integration

### Data Access
- Never access databases directly from views
- Use appropriate repository layer
- Implement both SQLite and Firebase adapters for new data types
- Always encrypt sensitive data before cloud storage

## Important Files

- `src/index.js` - Main Electron entry point
- `docs/DESIGN_PATTERNS.md` - Architecture guide (mandatory reading)
- `src/common/config/schema.js` - Database schema
- `bridge/featureBridge.js` - IPC communication
- `src/features/common/ai/factory.js` - AI provider abstraction

## Platform Support

- **Windows**: Requires Visual Studio Build Tools for native deps
- **macOS**: Universal builds (Intel + Apple Silicon)
- **Linux**: Basic support
- **Deep linking**: `pickleglass://` protocol handler