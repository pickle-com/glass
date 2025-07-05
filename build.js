const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs-extra');

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

// build.js only bundles JS files
const entryPoints = [
    { in: path.join('src', 'app', 'HeaderController.js'), out: path.join('public', 'build', 'header') },
    { in: path.join('src', 'app', 'PickleGlassApp.js'), out: path.join('public', 'build', 'content') },
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
        
        // Copy dependencies that might be missing
        ensureLibrariesExist();
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
        
        // Copy dependencies that might be missing
        ensureLibrariesExist();
    } catch (e) {
        console.error('Watch mode failed:', e);
        process.exit(1);
    }
}

// Function to ensure all required libraries exist
function ensureLibrariesExist() {
    // Create directory structure if it doesn't exist
    const assetsDir = path.join('public', 'assets');
    fs.ensureDirSync(assetsDir);
    
    // Check for highlight.js
    const highlightJsPath = path.join(assetsDir, 'highlight-11.9.0.min.js');
    if (!fs.existsSync(highlightJsPath)) {
        console.log('Copying highlight.js library from node_modules...');
        try {
            // Try to copy from node_modules
            const highlightSrc = path.join('node_modules', 'highlight.js', 'dist', 'highlight.min.js');
            if (fs.existsSync(highlightSrc)) {
                fs.copyFileSync(highlightSrc, highlightJsPath);
                console.log('✅ highlight.js copied successfully');
            } else {
                console.error('⚠️ highlight.js source not found. Please run: npm install highlight.js');
            }
        } catch (err) {
            console.error('⚠️ Failed to copy highlight.js:', err.message);
        }
    }

    // Rename the copied file to the expected version if it exists
    if (fs.existsSync(path.join(assetsDir, 'highlight.min.js'))) {
        fs.copyFileSync(
            path.join(assetsDir, 'highlight.min.js'),
            path.join(assetsDir, 'highlight-11.9.0.min.js')
        );
    }

    // Copy marked library if missing
    const markedPath = path.join(assetsDir, 'marked-4.3.0.min.js');
    if (!fs.existsSync(markedPath)) {
        console.log('Copying marked.js library from node_modules...');
        try {
            // Try to copy from node_modules
            const markedSrc = path.join('node_modules', 'marked', 'marked.min.js');
            if (fs.existsSync(markedSrc)) {
                fs.copyFileSync(markedSrc, markedPath);
                console.log('✅ marked.js copied successfully');
            } else {
                console.error('⚠️ marked.js source not found. Please run: npm install marked');
            }
        } catch (err) {
            console.error('⚠️ Failed to copy marked.js:', err.message);
        }
    }
}

// Copy assets - use path.join for cross-platform compatibility
fs.copySync(path.join('src', 'assets'), path.join('public', 'assets'));

if (process.argv.includes('--watch')) {
    watch();
} else {
    build();
}