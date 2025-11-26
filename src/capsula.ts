#!/usr/bin/env node
/*
**  Capsula -- Encapsulated Command Execution
**  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under MIT <https://spdx.org/licenses/MIT>
*/

/*  builtin dependencies  */
import fs                      from "node:fs"
import path                    from "node:path"
import os                      from "node:os"
import process                 from "node:process"

/*  external dependencies  */
import CLIio                   from "cli-io"
import yargs                   from "yargs"
import { hideBin }             from "yargs/helpers"
import { execa, type Options } from "execa"
import chalk                   from "chalk"
import which                   from "which"
import tmp                     from "tmp"

/*  internal dependencies  */
import pkg                     from "../package.json"                           with { type: "json"   }
import rawDocker1              from "./capsula-container-debian.dockerfile?raw" with { type: "string" }
import rawDocker2              from "./capsula-container-alpine.dockerfile?raw" with { type: "string" }
import rawBash                 from "./capsula-container.bash?raw"              with { type: "string" }

/*  helper class for resource spooling  */
interface SpoolResource {
    resource: any,
    onUnroll: (resource: any) => void | Promise<void>
}
class Spool {
    private resources: SpoolResource[] = []
    roll<T> (resource: T, onUnroll: (resource: T) => void | Promise<void>) {
        this.resources.push({ resource, onUnroll } satisfies SpoolResource)
    }
    sub () {
        const spool = new Spool()
        this.roll(spool, (spool) => { spool.unroll() })
        return spool
    }
    async unroll () {
        const resource = this.resources.pop()
        if (resource === undefined)
            throw new Error("still no resource spooled")
        const response = resource.onUnroll(resource.resource)
        if (response instanceof Promise)
            await response
    }
    async unrollAll () {
        while (this.resources.length > 0)
            await this.unroll()
    }
}

/*  central CLI context  */
let cli: CLIio | null = null

/*  centeral resource spool  */
const spool = new Spool()

/*  establish asynchronous environment  */
;(async () => {
    /*  ensure proper cleanup  */
    tmp.setGracefulCleanup()

    /*  parse command-line arguments  */
    const coerce = (arg: string) => Array.isArray(arg) ? arg[arg.length - 1] : arg
    const args = await yargs()
        .usage("Usage: capsula " +
            "[-h|--help] " +
            "[-v|--version] " +
            "[-l|--log-level <level>] " +
            "[-p|--platform <platform>] " +
            "[-d|--docker <docker>] " +
            "[-c|--context <context>] " +
            "[<command> ...]"
        )
        .version(false)
        .option("version", {
            alias:    "v",
            type:     "boolean",
            array:    false,
            coerce,
            default:  false,
            describe: "show program version"
        })
        .option("log-level", {
            alias:    "l",
            type:     "string",
            nargs:    1,
            array:    false,
            coerce,
            default:  "warning",
            choices:  [ "error", "warning", "info", "debug" ] as const,
            describe: "set logging level"
        })
        .option("platform", {
            alias:    "p",
            type:     "string",
            array:    false,
            coerce,
            default:  "debian",
            choices:  [ "debian", "alpine" ] as const,
            describe: "set Linux platform (\"debian\" or \"alpine\")"
        })
        .option("docker", {
            alias:    "d",
            type:     "string",
            array:    false,
            coerce,
            default:  "",
            describe: "set docker(1) compatible tool"
        })
        .option("context", {
            alias:    "c",
            type:     "string",
            array:    false,
            nargs:    1,
            default:  "default",
            describe: "unique context name"
        })
        .help("h", "show usage help")
        .alias("h", "help")
        .showHelpOnFail(true)
        .strict()
        .demandCommand(0)
        .parse(hideBin(process.argv))

    /*  short-circuit printing of program version  */
    if (args.version) {
        process.stderr.write(`Capsula ${pkg.version} <${pkg.homepage}>\n`)
        process.stderr.write(`Copyright (c) 2025 ${pkg.author.name} <${pkg.author.url}>\n`)
        process.stderr.write(`Licensed under ${pkg.license} <http://spdx.org/licenses/${pkg.license}.html>\n`)
        process.exit(0)
    }

    /*  establish CLI environment  */
    cli = new CLIio({
        encoding:  "utf8",
        logLevel:  args.logLevel,
        logTime:   false,
        logPrefix: "capsula"
    })

    /*  helper function wrapping execa()  */
    const exec = <T extends Options>(cmd: string, args: string[], opts: T) => {
        const str = [ cmd, ...args ].map((x) => x.match(/\s/) ? `'${x.replace(/'/g, "\\'")}'` : x).join(" ")
        const options = []
        if (opts.cwd)
            options.push(`cwd: ${chalk.blue(opts.cwd)}`)
        if (opts.stdio)
            options.push(`stdio: ${chalk.blue(JSON.stringify(opts.stdio))}`)
        cli!.log("debug", `executing command: $ ${chalk.bold(str)}` +
            `${options.length > 0 ? ` (${options.join(", ")})` : ""}`)
        return execa(cmd, args, opts)
    }

    /*  helper function for ensuring a tool is available  */
    const ensureTool = async (tool: string) => {
        await which(tool).catch(() => {
            throw new Error(`necessary tool "${tool}" not found`)
        })
    }
    const existsTool = async (tool: string) => {
        return which(tool).then(() => true).catch(() => false)
    }

    /*  determine base directory  */
    let basedir = ""
    const scriptPath = process.argv[1]
    if (path.isAbsolute(scriptPath))
        /*  absolute path  */
        basedir = path.dirname(scriptPath)
    else if (scriptPath.includes(path.sep))
        /*  relative path  */
        basedir = path.resolve(path.dirname(scriptPath))
    else if (fs.existsSync(path.join(process.cwd(), scriptPath)))
        /*  local usage  */
        basedir = process.cwd()
    else {
        /*  search in PATH  */
        const pathDirs = (process?.env?.PATH ?? "").split(path.delimiter)
        for (const dir of pathDirs) {
            if (fs.existsSync(path.join(dir, scriptPath))) {
                basedir = dir
                break
            }
        }
        if (!basedir)
            throw new Error("capsula: ERROR: cannot determine base directory")
    }
    cli.log("debug", `base directory: ${chalk.blue(basedir)}`)

    /*  detect current working directory  */
    const workdir = process.cwd()
    const home    = os.homedir()
    cli!.log("debug", `home directory: ${chalk.blue(home)}`)
    cli!.log("debug", `working directory: ${chalk.blue(workdir)}`)
    if (!workdir.startsWith(`${home}${path.sep}`))
        throw new Error(`working directory ${chalk.blue(workdir)} not below home directory ${chalk.blue(home)}`)

    /*  the temporary development environment image and container name  */
    const ENV_IMAGE     = "capsula"
    const ENV_CONTAINER = "capsula"
    const ENV_VOLUME    = "capsula"

    /*  determine docker(1) compatible tool  */
    const haveDocker  = await existsTool("docker")
    const havePodman  = await existsTool("podman")
    const haveRancher = await existsTool("nerdctl")
    const docker = (
        args.docker !== "" ? args.docker : (
            haveDocker ? "docker" : (
                havePodman ? "podman" : (
                    haveRancher ? "nerdctl" : ""))))
    if (docker === "")
        throw new Error("neither docker(1), podman(1) or nerctl(1) command found in shell path")
    cli.log("debug", `docker command: ${chalk.blue(docker)}`)

    /*  build development environment image  */
    const imageExists = await exec(docker, [ "images", "-q", ENV_IMAGE ], { stdio: "ignore" })
        .then(() => true).catch(() => false)
    if (!imageExists) {
        cli.log("info", `building development environment container image ${chalk.blue(ENV_IMAGE)}`)
        const subSpool = spool.sub()
        ;(async () => {
            const tmpdir = tmp.dirSync({ mode: 0o750, prefix: "capsula-" })
            subSpool.roll(tmpdir, (tmpdir) => { tmpdir.removeCallback() })

            const dockerfile = path.join(tmpdir.name, "Dockerfile")
            subSpool.roll(dockerfile, (dockerfile) => fs.promises.unlink(dockerfile))
            await fs.promises.writeFile(dockerfile, args.platform === "debian" ? rawDocker1 : rawDocker2, { encoding: "utf8" })

            const rcfile = path.join(tmpdir.name, "capsula-container.bash")
            subSpool.roll(rcfile, (rcfile) => fs.promises.unlink(rcfile))
            await fs.promises.writeFile(rcfile, rawBash, { encoding: "utf8" })

            await exec(docker, [
                "build",
                "--progress", "plain",
                "-t", ENV_IMAGE,
                "-f", "Dockerfile",
                "."
            ], {
                cwd:   tmpdir.name,
                stdio: "inherit",
                all:   true
            })
        })().catch(async (err: any) => {
            throw new Error(`failed to build container: ${err?.message ?? err}`)
        }).finally(async () => {
            await spool.unroll()
        })
    }

    /*  create capsula volume  */
    const volumeExists = await exec(docker, [ "volume", "inspect", ENV_VOLUME ], { stdio: "ignore" })
        .then(() => true).catch(() => false)
    if (!volumeExists) {
        cli.log("info", `creating persistent volume ${chalk.blue(ENV_VOLUME)}`)
        await exec(docker, [ "volume", "create", ENV_VOLUME ], { stdio: "ignore" })
            .catch((err: any) => { throw new Error(`failed to create persistent volume: ${err.message ?? err}`) })
    }

    /*  list of dotfiles to expose  */
    //  FIXME
    const dotfiles = ".dotfiles .bashrc .bash_login .bash_logout .bash-fzf.rc " +
        ".ssh/config .ssh/known_hosts .ssh/authorized_keys " +
        ".tmux.conf .claude! .claude.json! .gitconfig .npmrc .vimrc .vim " +
        ".cache!"

    /*  determine "docker run" options for dotfiles  */
    let opts = []
    for (let dotfile of dotfiles.split(" ")) {
        let ro = true
        if (dotfile.endsWith("!")) {
            ro = false
            dotfile = dotfile.replace(/!$/, "")
        }
        const dotfilePath = path.join(home, dotfile)
        const mountOption = ro ? ":ro" : ""
        opts.push("-v", `${dotfilePath}:/mnt/fs-home${dotfilePath}${mountOption}`)
    }

    /*  execute development environment image  */
    const ui = os.userInfo()
    const uid = ui.uid.toString()
    const gid = ui.gid.toString()
    const usr = ui.username
    await ensureTool("id")
    const response = await exec("id", [ "-g", "-n" ], { stdio: [ "ignore", "pipe", "ignore" ] })
        .catch((err: any) => { throw new Error(`failed to determine group name: ${err.message ?? err}`) })
    const grp = response.stdout.trim()
    const hostname = os.hostname()
    const subSpool = spool.sub()
    const tmpdir = tmp.dirSync({ mode: 0o750, prefix: "capsula-" })
    subSpool.roll(tmpdir, (tmpdir) => { tmpdir.removeCallback() })
    const rcfile = path.join(tmpdir.name, "capsula-container.bash")
    subSpool.roll(rcfile, (rcfile) => fs.promises.unlink(rcfile))
    await fs.promises.writeFile(rcfile, rawBash, { mode: 0o750, encoding: "utf8" })
    opts = [
        "run",
        "--rm",
        "-i",
        ...((process.stdin.isTTY ?? false) ? [ "-t" ] : []),
        "--privileged",
        "-e", "TERM", "-e", "HOME",
        "-v", `${rcfile}:/etc/capsula-container:ro`,
        ...opts,
        "-v", `${workdir}:/mnt/fs-work${workdir}`,
        "-v", `${ENV_VOLUME}:/mnt/fs-volume`,
        "--name", ENV_CONTAINER,
        "--entrypoint", "/etc/capsula-container",
        ENV_IMAGE,
        hostname,
        usr, uid,
        grp, gid,
        home,
        workdir,
        dotfiles,
        ...args._.map((x) => String(x))
    ]
    const result = await exec(docker, opts, { stdio: "inherit" })

    /*  cleanup resources  */
    await spool.unrollAll()

    /*  terminate gracefully  */
    if (result.exitCode !== 0) {
        cli.log("warning", `failed to execute: ${result.stderr}`)
        process.exit(result.exitCode)
    }
    process.exit(0)
})().catch(async (err) => {
    /*  cleanup resources and terminate ungracefully  */
    if (cli !== null)
        cli.log("error", err.message ?? err)
    else
        process.stderr.write(`rulebook: ${chalk.red("ERROR")}: ${err.message ?? err} ${err.stack}\n`)
    await spool.unrollAll()
    process.exit(1)
})

