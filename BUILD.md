# Glass - Build Documentation

This document provides comprehensive instructions for building the Glass application from source.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Building the Application](#building-the-application)
- [Build Configuration](#build-configuration)
- [Troubleshooting](#troubleshooting)
- [Distribution](#distribution)

## Prerequisites

- Node.js (v16.x or later)
- npm (v8.x or later) or Yarn
- Git
- Python 3.8+ (for some native dependencies)
- Windows 10/11 (for Windows builds)
- [NSIS](https://nsis.sourceforge.io/Download) (for Windows installer creation)
- Visual Studio Build Tools (for Windows native modules)

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/pickle-com/glass.git
   cd glass
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or if using Yarn
   # yarn
   ```

3. **Install native build tools** (Windows)
   ```bash
   npm install --global --production windows-build-tools
   ```

## Building the Application

### Development Build

1. **Start the development server**
   ```bash
   npm run dev
   ```
   This will start the Electron app in development mode with hot-reload.

### Production Build

1. **Build the renderer process**
   ```bash
   npm run build:renderer
   ```

2. **Package the application**
   - For Windows:
     ```bash
     npm run build:win
     ```
   - For macOS:
     ```bash
     npm run build:mac
     ```
   - For Linux:
     ```bash
     npm run build:linux
     ```

3. **Find the built application**
   - Windows: `./dist/Glass Setup x.x.x.exe`
   - macOS: `./dist/mac/Glass.app`
   - Linux: `./dist/glass-x.x.x.AppImage`

## Build Configuration

The build process is configured using `electron-builder.yml`. Key configurations include:

- **Application Information**
  - `appId`: `com.pickle.glass`
  - `productName`: `Glass`
  - `artifactName`: `Glass-Setup-${version}.${ext}`

- **Windows Specific**
  - NSIS installer configuration
  - File associations for `.pglass` files
  - Desktop and Start Menu shortcuts
  - Custom installer/uninstaller icons

- **Build Output**
  - Output directory: `./dist`
  - ASAR packaging enabled
  - Extra resources included

## Troubleshooting

### Common Issues

1. **Native Module Build Failures**
   - Ensure Python 3.8+ is installed and in PATH
   - Install Visual Studio Build Tools with C++ workload
   - Run `npm config set msvs_version 2019` (or your VS version)

2. **NSIS Installation Required**
   - Download and install NSIS from https://nsis.sourceforge.io/Download
   - Add NSIS to your system PATH

3. **Permission Errors**
   - Run terminal as Administrator when building
   - Or use `npm config set user 0` and `npm config set unsafe-perm true`

4. **Build Cache Issues**
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Remove node_modules and reinstall
   rm -rf node_modules
   npm install
   ```

## Distribution

### Creating Installers

The build process automatically creates installers:
- Windows: NSIS installer (.exe)
- macOS: DMG package (.dmg)
- Linux: AppImage (.AppImage)

### Code Signing (Optional)

To sign your builds, set these environment variables:
```bash
# Windows
export CSC_LINK=path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
export CSC_NAME="Your Name"

# macOS
export CSC_IDENTITY_AUTO_DISCOVERY=false
export CSC_LINK=path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue on GitHub or join our [Discord community](https://discord.gg/UCZH5B5Hpd).
