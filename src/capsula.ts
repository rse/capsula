#!/usr/bin/env node
/*
**  Capsula -- Encapsulated Command Execution
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
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
import jsYAML                  from "yaml"
import Ora                     from "ora"
import { DateTime }            from "luxon"
import deepmerge               from "deepmerge"

/*  internal dependencies  */
import pkg                     from "../package.json"                             with { type: "json"   }
import rawDockerAlpine         from "./capsula-container-alpine.dockerfile?raw"   with { type: "string" }
import rawDockerDebian         from "./capsula-container-debian.dockerfile?raw"   with { type: "string" }
import rawDockerUbuntu         from "./capsula-container-ubuntu.dockerfile?raw"   with { type: "string" }
import rawDockerAlma           from "./capsula-container-alma.dockerfile?raw"     with { type: "string" }
import rawDockerFedora         from "./capsula-container-fedora.dockerfile?raw"   with { type: "string" }
import rawDockerArch           from "./capsula-container-arch.dockerfile?raw"     with { type: "string" }
import rawDockerOpenSUSE       from "./capsula-container-opensuse.dockerfile?raw" with { type: "string" }
import rawBash                 from "./capsula-container.bash?raw"                with { type: "string" }
import rawDefaults             from "./capsula.yaml?raw"                          with { type: "string" }

/*  helper class for resource spooling  */
type SpoolCleanup<T = unknown> =
    (resource: T) => void | Promise<void>
type SpoolResource<T = unknown> = {
    resource: T,
    cleanup:  SpoolCleanup<T>
}
export class Spool {
    /*  internal state  */
    private resources: SpoolResource<unknown>[] = []
    private pending:   Promise<void> | null = null

    /*  roll cleanup procedure onto spool  */
    roll (cleanup: SpoolCleanup): void
    roll <T>(resource: T, cleanup: SpoolCleanup<T>): void
    roll (...args: any[]): void {
        /*  determine parameters  */
        let resource: unknown
        let cleanup:  SpoolCleanup<unknown>
        if      (args.length === 1) { resource = undefined; cleanup  = args[0] }
        else if (args.length === 2) { resource = args[0];   cleanup  = args[1] }
        else
            throw new Error("invalid number of arguments")

        /*  store information  */
        this.resources.push({ resource, cleanup })
    }

    /*  roll a sub-spool onto spool  */
    sub (): Spool {
        /*  create new spool  */
        const spool = new Spool()

        /*  roll sub-spool onto spool  */
        this.roll(spool, (s) => s.unroll())

        /*  return new spool  */
        return spool
    }

    /*  unroll all cleanup procedures from spool  */
    unroll (suppress = true): Promise<void> | void {
        /*  guard against concurrent unroll: if an unroll is already
            in progress, return the existing promise so all callers
            wait for the same completion  */
        if (this.pending !== null) {
            if (suppress)
                return this.pending.catch(() => {})
            return this.pending
        }

        /*  NOTICE: we operate synchronously until the first
            cleanup procedure returns a Promise. Then we continue
            asynchronously, regardless of whether the following
            cleanup procedures return a Promise or not!  */
        const errors: unknown[] = []
        let promise: Promise<void> | undefined
        while (this.resources.length > 0) {
            const entry    = this.resources.pop()!
            const resource = entry.resource
            const cleanup  = entry.cleanup
            if (promise) {
                /*  async continuation: isolate each cleanup so one rejection
                    does not prevent remaining cleanups from executing  */
                promise = promise.then(() => cleanup(resource))
                    .catch((err: unknown) => { errors.push(err) })
            }
            else {
                /*  sync start: wrap individually so a throw
                    does not exit the while loop  */
                try {
                    const result = cleanup(resource)
                    if (result instanceof Promise)
                        promise = result.catch((err: unknown) => { errors.push(err) })
                }
                catch (err: unknown) {
                    errors.push(err)
                }
            }
        }
        if (promise) {
            /*  store the pending promise for concurrent-caller guard  */
            this.pending = promise.then(() => {
                if (errors.length === 1)
                    throw errors[0]
                else if (errors.length > 1)
                    throw new AggregateError(errors, "multiple cleanup failures")
            })
            this.pending.then(
                () => { this.pending = null },
                () => { this.pending = null }
            )
            if (suppress)
                return this.pending.catch(() => {})
            return this.pending
        }
        else {
            if (!suppress && errors.length === 1)
                throw errors[0]
            else if (!suppress && errors.length > 1)
                throw new AggregateError(errors, "multiple cleanup failures")
            return
        }
    }
}

/*  central CLI context  */
let cli: CLIio | null = null

/*  central resource spool  */
const spool = new Spool()

/*  establish asynchronous environment  */
;(async () => {
    /*  ensure proper cleanup  */
    tmp.setGracefulCleanup()

    /*  parse command-line arguments  */
    const coerceS = <T>(arg: T | T[]): T => Array.isArray(arg) ? arg[arg.length - 1] : arg
    const coerceA = <T>(arg: T | T[]): T[] => Array.isArray(arg) ? arg : [ arg ]
    const args = await yargs()
        .usage([
            "Usage: capsula",
            "[-h|--help]",
            "[-v|--version]",
            "[-f|--config <config>]",
            "[-l|--log-level <level>]",
            "[-t|--type <type>]",
            "[-d|--docker <docker>]",
            "[-c|--context <context>]",
            "[-s|--sudo]",
            "[-e|--env <variable>[=<value>]]",
            "[-m|--mount <dotfile>]",
            "[-b|--bind <path>]",
            "[-p|--port <port>]",
            "[-I|--image <image-name>]",
            "[-C|--container <container-name>]",
            "[-V|--volume <volume-name>]",
            "[<command> ...]"
        ].join(" "))
        .version(false)
        .option("version", {
            alias:    "v",
            type:     "boolean",
            coerce:   coerceS<boolean>,
            default:  false,
            describe: "show program version"
        })
        .option("config", {
            alias:    "f",
            type:     "string",
            coerce:   coerceS<string>,
            default:  process.env.CAPSULA_CONFIG ?? path.join(os.homedir(), ".capsula.yaml"),
            describe: "set context configuration file"
        })
        .option("log-level", {
            alias:    "l",
            type:     "string",
            nargs:    1,
            coerce:   coerceS<string>,
            default:  process.env.CAPSULA_LOGLEVEL ?? "info",
            choices:  [ "error", "warning", "info", "debug" ] as const,
            describe: "set logging level"
        })
        .option("type", {
            alias:    "t",
            type:     "string",
            coerce:   coerceS<string>,
            default:  process.env.CAPSULA_TYPE ?? "debian",
            choices:  [ "alpine", "debian", "ubuntu", "alma", "fedora", "arch", "opensuse" ] as const,
            describe: "set Linux platform type to use for container"
        })
        .option("docker", {
            alias:    "d",
            type:     "string",
            coerce:   coerceS<string>,
            default:  process.env.CAPSULA_DOCKER ?? "",
            describe: "set docker(1) compatible tool"
        })
        .option("context", {
            alias:    "c",
            type:     "string",
            nargs:    1,
            coerce:   coerceS<string>,
            default:  process.env.CAPSULA_CONTEXT ?? "default",
            describe: "unique context name"
        })
        .option("sudo", {
            alias:    "s",
            type:     "boolean",
            coerce:   coerceS<boolean>,
            default:  process.env.CAPSULA_SUDO ? /^(true|1|yes)$/i.test(process.env.CAPSULA_SUDO) : false,
            describe: "enable sudo(8) for user in container"
        })
        .option("env", {
            alias:    "e",
            type:     "string",
            coerce:   coerceA<string>,
            default:  process.env.CAPSULA_ENV ? process.env.CAPSULA_ENV.split(/[\s,]+/) : [],
            describe: "pass environment variable to encapsulated command"
        })
        .option("mount", {
            alias:    "m",
            type:     "string",
            coerce:   coerceA<string>,
            default:  process.env.CAPSULA_MOUNT ? process.env.CAPSULA_MOUNT.split(/[\s,]+/) : [],
            describe: "pass additional dotfile to encapsulated command"
        })
        .option("bind", {
            alias:    "b",
            type:     "string",
            coerce:   coerceA<string>,
            default:  process.env.CAPSULA_BIND ? process.env.CAPSULA_BIND.split(/[\s,]+/) : [],
            describe: "bind-mount external directory into container"
        })
        .option("port", {
            alias:    "p",
            type:     "string",
            coerce:   coerceA<string>,
            default:  process.env.CAPSULA_PORT ? process.env.CAPSULA_PORT.split(/[\s,]+/) : [],
            describe: "pass additional port to encapsulated command"
        })
        .option("image", {
            alias:    "I",
            type:     "string",
            coerce:   coerceS<string>,
            default:  process.env.CAPSULA_IMAGE ?? "",
            describe: "set name of Docker container image"
        })
        .option("container", {
            alias:    "C",
            type:     "string",
            coerce:   coerceS<string>,
            default:  process.env.CAPSULA_CONTAINER ?? "",
            describe: "set name of Docker container"
        })
        .option("volume", {
            alias:    "V",
            type:     "string",
            coerce:   coerceS<string>,
            default:  process.env.CAPSULA_VOLUME ?? "",
            describe: "set name of Docker volume"
        })
        .help("h", "show usage help")
        .alias("h", "help")
        .showHelpOnFail(true)
        .strict()
        .demandCommand(0)
        .parserConfiguration({ "halt-at-non-option": true })
        .parse(hideBin(process.argv))

    /*  short-circuit printing of program version  */
    if (args.version) {
        process.stderr.write(`Capsula ${pkg.version} <${pkg.homepage}>\n`)
        process.stderr.write(`Copyright (c) 2025-2026 ${pkg.author.name} <${pkg.author.url}>\n`)
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
    const exec = <T extends Options>(cmd: string, cmdArgs: string[], opts: T) => {
        const str = [ cmd, ...cmdArgs ].map((x) => x.match(/\s/) ? `'${x.replace(/'/g, "'\\''")}'` : x).join(" ")
        const options: string[] = []
        if (opts.cwd)
            options.push(`cwd: ${chalk.blue(opts.cwd)}`)
        if (opts.all)
            options.push(`all: ${chalk.blue(opts.all)}`)
        if (opts.stdio)
            options.push(`stdio: ${chalk.blue(JSON.stringify(opts.stdio))}`)
        cli!.log("debug", `executing command: $ ${chalk.bold(str)}` +
            `${options.length > 0 ? ` (${options.join(", ")})` : ""}`)
        return execa(cmd, cmdArgs, opts)
    }

    /*  helper function for ensuring a tool is available  */
    const ensureTool = async (tool: string) => {
        await which(tool).catch(() => {
            throw new Error(`necessary tool "${tool}" not found`)
        })
    }

    /*  helper function for checking whether a tool is available  */
    const existsTool = async (tool: string) => {
        return which(tool).then(() => true).catch(() => false)
    }

    /*  detect current working directory  */
    const workdir = process.cwd()
    const home    = os.homedir()
    cli!.log("debug", `home directory: ${chalk.blue(home)}`)
    cli!.log("debug", `working directory: ${chalk.blue(workdir)}`)

    /*  load configurations  */
    let config = jsYAML.parse(rawDefaults)
    if (fs.existsSync(args.config)) {
        const yaml = fs.readFileSync(args.config, { encoding: "utf8" })
        const obj = jsYAML.parse(yaml)
        config = deepmerge(config, obj, { arrayMerge: (_dst: unknown[], src: unknown[]) => src })
    }

    /*  determine user/group information  */
    const ui  = os.userInfo()
    const usr = ui.username
    const uid = ui.uid.toString()
    const gid = ui.gid.toString()

    /*  define the container volume, container image and container names  */
    const timestamp = DateTime.now().toFormat("yyyy-MM-dd-HH-mm-ss-SSS")
    const nameImage = args.image !== "" ? args.image :
        `capsula-${usr}-${args.type}-${args.context}:${pkg.version}`
    const nameContainer = args.container !== "" ? args.container :
        `capsula-${usr}-${args.type}-${args.context}-${timestamp}`
    const nameVolume = args.volume !== "" ? args.volume :
        `capsula-${usr}-${args.type}-${args.context}`

    /*  determine docker(1) compatible tool  */
    const [ haveDocker, havePodman, haveRancher ] = await Promise.all([
        existsTool("docker"),
        existsTool("podman"),
        existsTool("nerdctl")
    ])
    const docker = (
        args.docker !== "" ? args.docker : (
            haveDocker ? "docker" : (
                havePodman ? "podman" : (
                    haveRancher ? "nerdctl" : ""))))
    if (docker === "")
        throw new Error("neither docker(1), podman(1) or nerdctl(1) command found in shell path")
    cli.log("debug", `docker command: ${chalk.blue(docker)}`)

    /*  create container image  */
    const imageId = await exec(docker, [ "images", "-q", nameImage ], { stdio: [ "ignore", "pipe", "ignore" ] })
    if ((imageId.stdout ?? "") === "") {
        cli.log("info", `creating container image ${chalk.blue(nameImage)}`)
        const subSpool = spool.sub()
        await (async () => {
            /*  create temporary directory  */
            const tmpdir = tmp.dirSync({ mode: 0o750, prefix: "capsula-" })
            subSpool.roll(tmpdir, (tmpdir) => { tmpdir.removeCallback() })

            /*  create Dockerfile  */
            const dockerfile = path.join(tmpdir.name, "Dockerfile")
            subSpool.roll(dockerfile, (dockerfile) => fs.promises.unlink(dockerfile))
            const dockerfileMap: Record<string, string> = {
                alpine:   rawDockerAlpine,
                debian:   rawDockerDebian,
                ubuntu:   rawDockerUbuntu,
                alma:     rawDockerAlma,
                fedora:   rawDockerFedora,
                arch:     rawDockerArch,
                opensuse: rawDockerOpenSUSE
            }
            const dockerfileText = dockerfileMap[args.type] ?? ""
            await fs.promises.writeFile(dockerfile, dockerfileText, { encoding: "utf8" })

            /*  create entrypoint script  */
            const rcfile = path.join(tmpdir.name, "capsula-container.bash")
            subSpool.roll(rcfile, (rcfile) => fs.promises.unlink(rcfile))
            await fs.promises.writeFile(rcfile, rawBash, { encoding: "utf8" })

            /*  build the container image  */
            await new Promise<void>((resolve, reject) => {
                /*  support spinner (part 1)  */
                let spinner: ReturnType<typeof Ora> | null = null
                let spinnerStarted = false
                if (args.logLevel === "info") {
                    spinner = Ora()
                    spinner.color = "red"
                    spinner.prefixText = "capsula: INFO:"
                    spinner.spinner = "dots"
                    subSpool.roll(spinner, (spinner) => { spinner.stop() })
                }

                /*  execute "docker build"  */
                const response = exec(docker, [
                    "build",
                    "--progress", "plain",
                    "-t", nameImage,
                    "-f", "Dockerfile",
                    "."
                ], {
                    cwd:    tmpdir.name,
                    all:    true,
                    reject: false
                })
                if (!response.all) {
                    reject(new Error("failed to capture combined output stream"))
                    return
                }

                /*  support spinner (part 2) and handle process termination  */
                let settled = false
                response.all.on("data", (chunk: Buffer | string) => {
                    const lines = chunk.toString().split(/\r?\n/)
                    if (spinner !== null) {
                        spinner.text = `${docker}: | ${lines[0]}`
                        if (!spinnerStarted) {
                            spinner.start()
                            spinnerStarted = true
                        }
                    }
                    else {
                        for (const line of lines)
                            if (line !== "")
                                cli!.log("debug", `${docker}: | ${line}`)
                    }
                })
                response.on("close", (code) => {
                    if (!settled) {
                        settled = true
                        if (code === 0) {
                            if (spinner !== null)
                                spinner.succeed(`${docker}: SUCCEEDED`)
                            resolve()
                        }
                        else {
                            if (spinner !== null)
                                spinner.fail(`${docker}: FAILED`)
                            reject(new Error(`failed with exit code ${code}`))
                        }
                    }
                })
                response.on("error", (err) => {
                    if (!settled) {
                        settled = true
                        if (spinner !== null)
                            spinner.fail(`${docker}: FAILED: ${err}`)
                        reject(err)
                    }
                })

                /*  suppress unhandled promise rejection errors  */
                response.catch(() => {})
            })
        })().catch((err: unknown) => {
            throw new Error(`failed to build container: ${err instanceof Error ? err.message : err}`)
        }).finally(async () => {
            await spool.unroll()
        })
    }

    /*  create capsula volume  */
    const volumeInspect = await exec(docker, [ "volume", "inspect", nameVolume ],
        { stdio: [ "ignore", "ignore", "pipe" ], reject: false })
    let volumeExists: boolean
    if (volumeInspect.exitCode === 0)
        volumeExists = true
    else if (volumeInspect.stderr.match(/no such volume/i))
        volumeExists = false
    else
        throw new Error("failed to inspect persistent volume: "
            + ((volumeInspect.stderr || null) ?? `unknown reason (exit code: ${volumeInspect.exitCode})`))
    if (!volumeExists) {
        cli.log("info", `creating persistent volume ${chalk.blue(nameVolume)}`)
        await exec(docker, [ "volume", "create", nameVolume ], { stdio: "ignore" })
            .catch((err: unknown) => {
                throw new Error(`failed to create persistent volume: ${err instanceof Error ? err.message : err}`)
            })
    }

    /*  determine group name  */
    await ensureTool("id")
    const response = await exec("id", [ "-g", "-n" ], { stdio: [ "ignore", "pipe", "ignore" ] })
        .catch((err: unknown) => {
            throw new Error(`failed to determine group name: ${err instanceof Error ? err.message : err}`)
        })
    const grp = response.stdout.trim()

    /*  determine host information  */
    const hostname = os.hostname()

    /*  start assembling "docker" options  */
    const opts: string[] = []

    /*  helper function for merging a list with reset support  */
    const mergeList = (base: string[], overrides: string[]) => {
        const result = [ ...base ]
        for (const item of overrides) {
            if (item === "!")
                result.length = 0
            else
                result.push(item)
        }
        return result
    }

    /*  determine environment variables to expose  */
    let envs: string[] = mergeList(config[args.context]?.env ?? config.default?.env ?? [], args.env)
    for (const env of envs)
        opts.push("-e", env)
    envs = envs.map((env) => env.replace(/^([^=]+)=.*$/, "$1"))

    /*  determine dotfile mounts to expose  */
    const mounts: string[] = mergeList(config[args.context]?.mount ?? config.default?.mount ?? [], args.mount)
    for (let mount of mounts) {
        let ro = true
        if (mount.endsWith("!")) {
            ro = false
            mount = mount.replace(/!$/, "")
        }
        const mountPath = path.join(home, mount)
        const mountOption = ro ? ":ro" : ""
        opts.push("-v", `${mountPath}:/mnt/fs-home${mountPath}${mountOption}`)
    }

    /*  determine external bind mounts to expose  */
    const binds: string[] = mergeList(config[args.context]?.bind ?? config.default?.bind ?? [], args.bind)
    const bindPaths: string[] = []
    for (let bind of binds) {
        let ro = true
        if (bind.endsWith("!")) {
            ro = false
            bind = bind.replace(/!$/, "")
        }
        if (!path.isAbsolute(bind))
            throw new Error(`bind path ${chalk.blue(bind)} has to be an absolute path`)
        bindPaths.push(bind)
        const bindOption = ro ? ":ro" : ""
        opts.push("-v", `${bind}:/mnt/fs-bind${bind}${bindOption}`)
    }

    /*  validate working directory (after bind processing)  */
    const workdirAllowed = workdir.startsWith(`${home}${path.sep}`)
        || bindPaths.some((bp) => workdir === bp || workdir.startsWith(`${bp}${path.sep}`))
    if (!workdirAllowed)
        throw new Error(`working directory ${chalk.blue(workdir)} not below home directory ${chalk.blue(home)} ` +
            "or any bind-mounted directory")

    /*  determine ports to expose  */
    const ports: string[] = mergeList(config[args.context]?.port ?? config.default?.port ?? [], args.port)
    for (const port of ports)
        opts.push("-p", `${port}:${port}`)

    /*  create local copies of entrypoint script  */
    const subSpool = spool.sub()
    const tmpdir = tmp.dirSync({ mode: 0o750, prefix: "capsula-" })
    subSpool.roll(tmpdir, (tmpdir) => { tmpdir.removeCallback() })
    const rcfile = path.join(tmpdir.name, "capsula-container.bash")
    subSpool.roll(rcfile, (rcfile) => fs.promises.unlink(rcfile))
    await fs.promises.writeFile(rcfile, rawBash, { mode: 0o750, encoding: "utf8" })

    /*  execute command inside encapsulating container  */
    const result = exec(docker, [
        /*  standard arguments  */
        "run",
        "--name", nameContainer,
        "--privileged",
        "--rm",
        "-i",
        ...((process.stdin.isTTY ?? false) ? [ "-t" ] : []),
        ...opts,
        "-v", `${rcfile}:/etc/capsula-container:ro`,
        "-v", `${workdir}:/mnt/fs-work${workdir}`,
        "-v", `${nameVolume}:/mnt/fs-volume`,
        "--entrypoint", "/etc/capsula-container",

        /*  entrypoint arguments  */
        nameImage,
        args.type,
        hostname,
        usr, uid,
        grp, gid,
        home,
        workdir,
        mounts.join(" "),
        binds.join(" "),
        envs.join(" "),
        args.sudo ? "yes" : "no",

        /*  command to execute  */
        ...args._.map((x) => String(x))
    ], {
        stdio:  "inherit",
        reject: false
    })

    /*  propagate signals to container child process  */
    for (const signal of [ "SIGINT", "SIGTERM" ] as const) {
        process.on(signal, () => {
            result.kill(signal)

            /*  force-kill safety net  */
            setTimeout(async () => {
                result.kill("SIGKILL")
                await spool.unroll()
                const sigNum = os.constants.signals[signal]
                process.exit(128 + (sigNum ?? 0))
            }, 10 * 1000).unref()
        })
    }

    /*  handle container termination  */
    result.on("exit", async (code, signal) => {
        /*  cleanup resources  */
        await spool.unroll()

        /*  determine effective exit code  */
        let exitCode = code ?? 1
        if (code === null && signal !== null) {
            const sigNum = os.constants.signals[signal]
            if (sigNum !== undefined)
                exitCode = 128 + sigNum
        }

        /*  terminate gracefully  */
        if (exitCode !== 0)
            cli!.log("warning", `encapsulated command terminated with ${chalk.red("error")} ` +
                (signal !== null ? `signal ${chalk.red(signal)}` : `exit code ${chalk.red(exitCode)}`))
        process.exit(exitCode)
    })

    /*  handle execution errors  */
    result.on("error", async (err) => {
        /*  cleanup resources and terminate ungracefully  */
        cli!.log("error", err.message ?? err)
        await spool.unroll()
        process.exit(1)
    })

    /*  suppress unhandled promise rejection errors  */
    result.catch(() => {})
})().catch(async (err) => {
    /*  cleanup resources and terminate ungracefully  */
    if (cli !== null)
        cli.log("error", err.message ?? err)
    else
        process.stderr.write(`capsula: ${chalk.red("ERROR")}: ${err.message ?? err} ${err.stack}\n`)
    await spool.unroll()
    process.exit(1)
})

