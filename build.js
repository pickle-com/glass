const esbuild = require('esbuild');
const path = require('path');

const baseConfig = {
    bundle: true,
    platform: 'browser',
    format: 'esm',
    loader: { '.js': 'jsx' },
    sourcemap: true,
    external: ['electron'],
    define: {
        'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
    },
};

const entryPoints = [
    { in: 'src/ui/app/HeaderController.js', out: 'public/build/header' },
    { in: 'src/ui/app/PickleGlassApp.js', out: 'public/build/content' },
];

async function build() {
    try {
        console.log('Building renderer process code...');
        await Promise.all(entryPoints.map(point => esbuild.build({
            ...baseConfig,
            entryPoints: [point.in],
            outfile: `${point.out}.js`,
        })));
        console.log('✅ Renderer builds successful!');
    } catch (e) {
        console.error('Renderer build failed:', e);
        process.exit(1);
    }
}

async function watch() {
    try {
        const contexts = await Promise.all(entryPoints.map(point => esbuild.context({
            ...baseConfig,
            entryPoints: [point.in],
            outfile: `${point.out}.js`,
        })));
        
        console.log('Watching for changes...');
        await Promise.all(contexts.map(context => context.watch()));

    } catch (e) {
        console.error('Watch mode failed:', e);
        process.exit(1);
    }
}

if (process.argv.includes('--watch')) {
    watch();
} else {
    build();
} 