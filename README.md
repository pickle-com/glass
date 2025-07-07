<p align="center">
  <a href="https://pickle.com/glass">
   <img src="./public/assets/banner.gif" alt="Logo">
  </a>

  <h1 align="center">Glass by Pickle: Digital Mind Extension 🧠</h1>

</p>


<p align="center">
  <a href="https://discord.gg/UCZH5B5Hpd"><img src="./public/assets/button_dc.png" width="80" alt="Pickle Discord"></a>&ensp;<a href="https://pickle.com"><img src="./public/assets/button_we.png" width="105" alt="Pickle Website"></a>&ensp;<a href="https://x.com/intent/user?screen_name=leinadpark"><img src="./public/assets/button_xe.png" width="109" alt="Follow Daniel"></a>
</p>

> This project is a fork of [CheatingDaddy](https://github.com/sohzm/cheating-daddy) with modifications and enhancements. Thanks to [Soham](https://x.com/soham_btw) and all the open-source contributors who made this possible!

> Currently, we're working on a full code refactor and modularization. Once that's completed, we'll jump into addressing the major issues. You can find WIP issues & changelog below this document.

🤖 **Fast, light & open-source**—Glass lives on your desktop, sees what you see, listens in real time, understands your context, and turns every moment into structured knowledge.

💬 **Proactive in meetings**—it surfaces action items, summaries, and answers the instant you need them.

🫥️ **Truly invisible**—never shows up in screen recordings, screenshots, or your dock; no always-on capture or hidden sharing.

To have fun building with us, join our [Discord](https://discord.gg/UCZH5B5Hpd)!

## Instant Launch

⚡️  Skip the setup—launch instantly with our ready-to-run macOS app.  [[Download Here]](https://www.dropbox.com/scl/fi/znid09apxiwtwvxer6oc9/Glass_latest.dmg?rlkey=gwvvyb3bizkl25frhs4k1zwds&st=37q31b4w&dl=1)

## Quick Start (Local Build)

### Prerequisites

First download & install [Python](https://www.python.org/downloads/) and [Node](https://nodejs.org/en/download).
If you are using Windows, you need to also install [Build Tools for Visual Studio](https://visualstudio.microsoft.com/downloads/)

Ensure you're using Node.js version 20.x.x to avoid build errors with native dependencies.

```bash
# Check your Node.js version
node --version

# If you need to install Node.js 20.x.x, we recommend using nvm:
# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# nvm install 20
# nvm use 20
```

### Installation

```bash
npm run setup
```

## Highlights


### Ask: get answers based on all your previous screen actions & audio

<img width="100%" alt="booking-screen" src="./public/assets/00.gif">

### Meetings: real-time meeting notes, live summaries, session records

<img width="100%" alt="booking-screen" src="./public/assets/01.gif">

### Use your own API key, or sign up to use ours (free)

<img width="100%" alt="booking-screen" src="./public/assets/02.gif">

**Currently Supporting:**
- OpenAI API: Get OpenAI API Key [here](https://platform.openai.com/api-keys)
- Gemini API: Get Gemini API Key [here](https://aistudio.google.com/apikey)
- Local LLM (WIP)

### Liquid Glass Design (coming soon)

<img width="100%" alt="booking-screen" src="./public/assets/03.gif">

<p>
  for a more detailed guide, please refer to this <a href="https://www.youtube.com/watch?v=qHg3_4bU1Dw">video.</a>
  <i style="color:gray; font-weight:300;">
    we don't waste money on fancy vids; we just code.
  </i>
</p>


## Keyboard Shortcuts

`Ctrl/Cmd + \` : show and hide main window

`Ctrl/Cmd + Enter` : ask AI using all your previous screen and audio

`Ctrl/Cmd + Arrows` : move main window position

## Repo Activity

![Alt](https://repobeats.axiom.co/api/embed/a23e342faafa84fa8797fa57762885d82fac1180.svg "Repobeats analytics image")

## Contributing

We love contributions! Feel free to open issues for bugs or feature requests. For detailed guide, please see our [contributing guide](/CONTRIBUTING.md).
> Currently, we're working on a full code refactor and modularization. Once that's completed, we'll jump into addressing the major issues.

### Contributors

<a href="https://github.com/pickle-com/glass/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=pickle-com/glass" />
</a>

### Help Wanted Issues

We have a list of [help wanted](https://github.com/pickle-com/glass/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%F0%9F%99%8B%E2%80%8D%E2%99%82%EF%B8%8Fhelp%20wanted%22) that contain small features and bugs which have a relatively limited scope. This is a great place to get started, gain experience, and get familiar with our contribution process.


### 🛠 Current Issues & Improvements

| Status | Issue                          | Description                                       |
|--------|--------------------------------|---------------------------------------------------|
| 🚧 WIP     | Code Refactoring               | Refactoring the entire codebase for better maintainability. |
| 🚧 WIP      | Windows Build                  | Make Glass buildable & runnable in Windows |
| 🚧 WIP      | Local LLM Support                  | Supporting Local LLM to power AI answers |
| 🚧 WIP     | AEC Improvement                | Transcription is not working occasionally |
| 🚧 WIP      | Firebase Data Storage Issue    | Session & ask should be saved in firebase for signup users |
| 🚧 WIP      | Login Issue                    | Currently breaking when switching between local and sign-in mode |
| 🚧 WIP      | Liquid Glass                    | Liquid Glass UI for MacOS 26 |

### Changelog

- Jul 5: Now support Gemini, Intel Mac supported


## About Pickle

**Our mission is to build a living digital clone for everyone.** Glass is part of Step 1—a trusted pipeline that transforms your daily data into a scalable clone. Visit [pickle.com](https://pickle.com) to learn more.

## Star History
[![Star History Chart](https://api.star-history.com/svg?repos=pickle-com/glass&type=Date)](https://www.star-history.com/#pickle-com/glass&Date)
root@DESKTOP-9A33TIA:~/glass# npm run setup

> pickle-glass@0.1.2 setup
> npm install && cd pickleglass_web && npm install && npm run build && cd .. && npm start

npm WARN EBADENGINE Unsupported engine {
npm WARN EBADENGINE   package: '@google/genai@1.8.0',
npm WARN EBADENGINE   required: { node: '>=20.0.0' },
npm WARN EBADENGINE   current: { node: 'v18.19.1', npm: '9.2.0' }
npm WARN EBADENGINE }
npm WARN EBADENGINE Unsupported engine {
npm WARN EBADENGINE   package: 'minimatch@10.0.3',
npm WARN EBADENGINE   required: { node: '20 || >=22' },
npm WARN EBADENGINE   current: { node: 'v18.19.1', npm: '9.2.0' }
npm WARN EBADENGINE }
npm WARN EBADENGINE Unsupported engine {
npm WARN EBADENGINE   package: '@isaacs/brace-expansion@5.0.0',
npm WARN EBADENGINE   required: { node: '20 || >=22' },
npm WARN EBADENGINE   current: { node: 'v18.19.1', npm: '9.2.0' }
npm WARN EBADENGINE }
npm WARN EBADENGINE Unsupported engine {
npm WARN EBADENGINE   package: '@isaacs/balanced-match@4.0.1',
npm WARN EBADENGINE   required: { node: '20 || >=22' },
npm WARN EBADENGINE   current: { node: 'v18.19.1', npm: '9.2.0' }
npm WARN EBADENGINE }
npm WARN skipping integrity check for git dependency ssh://git@github.com/electron/node-gyp.git
npm WARN deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
npm WARN deprecated npmlog@6.0.2: This package is no longer supported.
npm WARN deprecated @npmcli/move-file@2.0.1: This functionality has been moved to @npmcli/fs
npm WARN deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm WARN deprecated gar@1.0.4: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
npm WARN deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
npm WARN deprecated lodash.get@4.4.2: This package is deprecated. Use the optional chaining (?.) operator instead.
npm WARN deprecated are-we-there-yet@3.0.1: This package is no longer supported.
npm WARN deprecated sudo-prompt@9.2.1: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
npm WARN deprecated lodash.isequal@4.5.0: This package is deprecated. Use require('node:util').isDeepStrictEqual instead.
npm WARN deprecated @types/electron@1.6.12: This is a stub types definition. electron provides its own type definitions, so you do not need this installed.
npm WARN deprecated @npmcli/move-file@1.1.2: This functionality has been moved to @npmcli/fs
npm WARN deprecated rimraf@2.6.3: Rimraf versions prior to v4 are no longer supported
npm WARN deprecated glob@8.1.0: Glob versions prior to v9 are no longer supported
npm WARN deprecated glob@8.1.0: Glob versions prior to v9 are no longer supported
npm WARN deprecated gauge@4.0.4: This package is no longer supported.
npm WARN deprecated boolean@3.2.0: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
npm WARN deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

> pickle-glass@0.1.2 postinstall
> electron-builder install-app-deps

  • electron-builder  version=26.0.12
  • loaded configuration  file=/root/glass/electron-builder.yml
  • executing @electron/rebuild  electronVersion=30.5.1 arch=x64 buildFromSource=false appDir=./
  • installing native dependencies  arch=x64
  • preparing       moduleName=better-sqlite3 arch=x64
  • finished        moduleName=better-sqlite3 arch=x64
  • preparing       moduleName=electron-deeplink arch=x64
  • finished        moduleName=electron-deeplink arch=x64
  • preparing       moduleName=sqlite3 arch=x64
  • finished        moduleName=sqlite3 arch=x64
  • completed installing native dependencies

added 876 packages, and audited 877 packages in 12m

129 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
npm WARN deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm WARN deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
npm WARN deprecated glob@7.1.7: Glob versions prior to v9 are no longer supported
npm WARN deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
npm WARN deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
npm WARN deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 471 packages, and audited 472 packages in 4m

152 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

> pickleglass-frontend@0.1.0 build
> next build

Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry

  ▲ Next.js 14.2.30

   Creating an optimized production build ...
 ✓ Compiled successfully
 ✓ Linting and checking validity of types
 ✓ Collecting page data
 ✓ Generating static pages (13/13)
 ✓ Collecting build traces
 ✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    523 B          87.8 kB
├ ○ /_not-found                          875 B          88.2 kB
├ ○ /activity                            1.88 kB         217 kB
├ ○ /activity/details                    2.44 kB         218 kB
├ ○ /download                            2.33 kB         209 kB
├ ○ /help                                2.48 kB         209 kB
├ ○ /login                               2.38 kB         206 kB
├ ○ /personalize                         2.61 kB         209 kB
├ ○ /settings                            4.48 kB         211 kB
├ ○ /settings/billing                    1.33 kB         208 kB
└ ○ /settings/privacy                    2.1 kB          209 kB
+ First Load JS shared by all            87.3 kB
  ├ chunks/117-5615a0891d059420.js       31.7 kB
  ├ chunks/fd9d1056-361e77b934ea46f6.js  53.7 kB
  └ other shared chunks (total)          1.94 kB


○  (Static)  prerendered as static content


> pickle-glass@0.1.2 start
> npm run build:renderer && electron-forge start


> pickle-glass@0.1.2 build:renderer
> node build.js

Building renderer process code...
✅ Renderer builds successful!
✔ Checking your system
✔ Locating application
✔ Loading configuration
✔ Preparing native dependencies: 3 / 3 [4s]
✔ Running generateAssets hook
✔ Running preStart hook

/root/glass/node_modules/electron/dist/electron: error while loading shared libraries: libnss3.so: cannot open shared object file: No such file or directory
root@DESKTOP-9A33TIA:~/glass#
