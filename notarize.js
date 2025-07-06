const { notarize } = require('@electron/notarize');

exports.notarizeApp = async function (context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  console.log(' notarizing a macOS build!');

  const { appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD || !process.env.APPLE_TEAM_ID) {
    throw new Error('APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID environment variables are required for notarization.');
  }

  await notarize({
    appBundleId: 'com.pickle.glass',
    appPath: appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });

  console.log(`Successfully notarized ${appName}`);
}; 