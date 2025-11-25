/*
**  Capsula -- Encapsulated Command Execution
**  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under MIT <https://spdx.org/licenses/MIT>
*/

import * as Vite          from "vite"
import { tscPlugin }      from "@wroud/vite-plugin-tsc"
import nodeExternals      from "rollup-plugin-node-externals"
import { viteStaticCopy } from "vite-plugin-static-copy"
import arraybuffer        from "vite-plugin-arraybuffer"

export default Vite.defineConfig(({ command, mode }) => ({
    logLevel: "info",
    appType: "custom",
    base: "",
    root: "",
    plugins: [
        arraybuffer(),
        tscPlugin({
            tscArgs: [ "--project", "etc/tsc.json" ],
            prebuild: true
        }),
        nodeExternals({
            builtins: true,
            deps:     false,
            devDeps:  false,
            optDeps:  false,
            peerDeps: false
        }),
        viteStaticCopy({
            hook: "buildStart",
            targets: [{
                src: [ "src/*.dockerfile", "src/*.bash" ],
                dest: "../dst-stage1/",
                overwrite: true
            }],
            silent: false
        })
    ],
    resolve: {
        mainFields: [ "module", "jsnext:main", "jsnext" ],
        conditions: [ "node" ],
        alias: {
            electron: "/dev/null"
        }
    },
    build: {
        lib: {
            entry:    "dst-stage1/capsula.js",
            formats:  [ "cjs" ],
            name:     "Rundown",
            fileName: () => "capsula.js"
        },
        target:                 "esnext",
        outDir:                 "dst-stage2",
        assetsDir:              "",
        emptyOutDir:            (mode === "production"),
        chunkSizeWarningLimit:  5000,
        assetsInlineLimit:      0,
        sourcemap:              (mode === "development"),
        minify:                 (mode === "production"),
        reportCompressedSize:   false,
        rollupOptions: {
            onwarn (warning, warn) {
                if (warning.message.match(/Use of eval.*?is strongly discouraged/))
                    return
                warn(warning)
            }
        }
    }
}))

