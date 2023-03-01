import esbuild from 'esbuild';

function esbuildConfig(){
    esbuild.buildSync({
        entryPoints: ['src/index.ts'],
        bundle: true,
        outdir: 'dist',
        loader: {
            '.ts': 'ts'
        },
        target: ["chrome80"],
        minify: true
    })
}

esbuildConfig()