const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { notarizeApp } = require('./notarize');

module.exports = {
    packagerConfig: {
        asar: {
            unpack: '**/*.node,**/*.dylib,' + '**/node_modules/{sharp,@img}/**/*',
        },
        extraResource: ['./src/assets/SystemAudioDump', './pickleglass_web/out'],
        name: 'Glass',
        icon: 'src/assets/logo',
        appBundleId: 'com.pickle.glass',
        arch: 'universal',
        protocols: [
            {
                name: 'PickleGlass Protocol',
                schemes: ['pickleglass'],
            },
        ],
        asarUnpack: [
            '**/*.node',
            '**/*.dylib',
            'node_modules/@img/sharp-darwin-x64/**',
            'node_modules/@img/sharp-libvips-darwin-x64/**',
            'node_modules/@img/sharp-darwin-arm64/**',
            'node_modules/@img/sharp-libvips-darwin-arm64/**',
        ],
        osxSign: {
            identity: process.env.APPLE_SIGNING_IDENTITY,
            'hardened-runtime': true,
            entitlements: 'entitlements.plist',
            'entitlements-inherit': 'entitlements.plist',
        },
        osxNotarize: {
            tool: 'notarytool',
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
        },
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'pickle-glass',
                productName: 'Glass',
                shortcutName: 'Glass',
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
            },
        },
        {
            name: '@electron-forge/maker-dmg',
            platforms: ['darwin'],
        },
        {
            name: '@electron-forge/maker-deb',
            config: {},
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {},
        },
    ],
    hooks: {
        afterSign: async (context, forgeConfig, platform, arch, appPath) => {
            await notarizeApp(context, forgeConfig, platform, arch, appPath);
        },
    },
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {},
        },
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: false,
        }),
    ],
};
