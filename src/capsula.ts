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
import jsYAML                  from "yaml"
import Ora                     from "ora"
import { DateTime }            from "luxon"

/*  internal dependencies  */
import pkg                     from "../package.json"                           with { type: "json"   }
import rawDocker1              from "./capsula-container-debian.dockerfile?raw" with { type: "string" }
import rawDocker2              from "./capsula-container-alpine.dockerfile?raw" with { type: "string" }
import rawBash                 from "./capsula-container.bash?raw"              with { type: "string" }
import rawDefaults             from "./capsula.yaml?raw"                        with { type: "string" }

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
            "[-f|--config <config>] " +
            "[-l|--log-level <level>] " +
            "[-p|--platform <platform>] " +
            "[-d|--docker <docker>] " +
            "[-c|--context <context>] " +
            "[-s|--sudo] " +
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
        .option("config", {
            alias:    "f",
            type:     "string",
            array:    false,
            coerce,
            default:  path.join(os.homedir(), ".capsula.yaml"),
            describe: "set context configuration file"
        })
        .option("log-level", {
            alias:    "l",
            type:     "string",
            nargs:    1,
            array:    false,
            coerce,
            default:  "info",
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
        .option("sudo", {
            alias:    "s",
            type:     "boolean",
            array:    false,
            coerce,
            default:  false,
            describe: "enable sudo(8) for user in container"
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
        if (opts.all)
            options.push(`all: ${chalk.blue(opts.all)}`)
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

    /*  helper function for checking whether a tool is available  */
    const existsTool = async (tool: string) => {
        return which(tool).then(() => true).catch(() => false)
    }

    /*  detect current working directory  */
    const workdir = process.cwd()
    const home    = os.homedir()
    cli!.log("debug", `home directory: ${chalk.blue(home)}`)
    cli!.log("debug", `working directory: ${chalk.blue(workdir)}`)
    if (!workdir.startsWith(`${home}${path.sep}`))
        throw new Error(`working directory ${chalk.blue(workdir)} not below home directory ${chalk.blue(home)}`)

    /*  load configurations  */
    const config = jsYAML.parse(rawDefaults)
    if (fs.existsSync(args.config)) {
        const yaml = fs.readFileSync(args.config, { encoding: "utf8" })
        const obj = jsYAML.parse(yaml)
        Object.assign(config, obj)
    }

    /*  define the container volume, container image and container names  */
    const username      = os.userInfo().username
    const timestamp     = DateTime.now().toFormat("yyyy-MM-dd-HH-mm-ss-SSS")
    const nameVolume    = `capsula-${username}-${args.platform}-${args.context}`
    const nameImage     = `capsula-${username}-${args.platform}-${args.context}:${pkg.version}`
    const nameContainer = `capsula-${username}-${args.platform}-${args.context}-${timestamp}`

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
    const imageId = await exec(docker, [ "images", "-q", nameImage ], { stdio: [ "ignore", "pipe", "ignore" ] })
    if ((imageId.stdout ?? "") === "") {
        cli.log("info", `creating container image ${chalk.blue(nameImage)}`)
        const subSpool = spool.sub()
        await (async () => {
            const tmpdir = tmp.dirSync({ mode: 0o750, prefix: "capsula-" })
            subSpool.roll(tmpdir, (tmpdir) => { tmpdir.removeCallback() })

            const dockerfile = path.join(tmpdir.name, "Dockerfile")
            subSpool.roll(dockerfile, (dockerfile) => fs.promises.unlink(dockerfile))
            await fs.promises.writeFile(dockerfile, args.platform === "debian" ? rawDocker1 : rawDocker2, { encoding: "utf8" })

            const rcfile = path.join(tmpdir.name, "capsula-container.bash")
            subSpool.roll(rcfile, (rcfile) => fs.promises.unlink(rcfile))
            await fs.promises.writeFile(rcfile, rawBash, { encoding: "utf8" })

            await new Promise<void>((resolve, reject) => {
                let spinner: ReturnType<typeof Ora> | null = null
                let spinnerStarted = false
                if (args.logLevel === "info") {
                    spinner = Ora()
                    spinner.color = "red"
                    spinner.prefixText = "capsule: INFO:"
                    spinner.spinner = "dots"
                    subSpool.roll(spinner, (spinner) => { spinner.stop() })
                }
                const response = exec(docker, [
                    "build",
                    "--progress", "plain",
                    "-t", nameImage,
                    "-f", "Dockerfile",
                    "."
                ], {
                    cwd:   tmpdir.name,
                    all:   true
                })
                response.all.on("data", (chunk: any) => {
                    const lines = chunk.toString().split(/\r?\n/)
                    if (spinner !== null) {
                        spinner.text = `${docker}: | ${lines[0]}`
                        if (!spinnerStarted) {
                            spinner.start()
                            spinnerStarted = true
                        }
                    }
                    else
                        for (const line of lines)
                            if (line !== "")
                                cli!.log("debug", `${docker}: | ${line}`)
                })
                response.all.on("error", (err) => {
                    if (spinner !== null)
                        spinner.fail(`${docker}: FAILED: ${err}`)
                    reject(err)
                })
                response.all.on("end", () => {
                    if (spinner !== null)
                        spinner.succeed(`${docker}: SUCCEEDED`)
                    resolve()
                })
            })
        })().catch(async (err: any) => {
            throw new Error(`failed to build container: ${err?.message ?? err}`)
        }).finally(async () => {
            await spool.unroll()
        })
    }

    /*  create capsula volume  */
    const volumeExists = await exec(docker, [ "volume", "inspect", nameVolume ], { stdio: "ignore" })
        .then(() => true).catch(() => false)
    if (!volumeExists) {
        cli.log("info", `creating persistent volume ${chalk.blue(nameVolume)}`)
        await exec(docker, [ "volume", "create", nameVolume ], { stdio: "ignore" })
            .catch((err: any) => { throw new Error(`failed to create persistent volume: ${err.message ?? err}`) })
    }

    /*  list of dotfiles to expose  */
    const dotfiles = config[args.context]?.dotfiles ?? config.default?.dotfiles ?? []

    /*  list of environment variables to expose  */
    const envvars = config[args.context]?.environment ?? config.default?.environment ?? []

    /*  determine "docker run" options for dotfiles  */
    const opts = []
    for (let dotfile of dotfiles) {
        let ro = true
        if (dotfile.endsWith("!")) {
            ro = false
            dotfile = dotfile.replace(/!$/, "")
        }
        const dotfilePath = path.join(home, dotfile)
        const mountOption = ro ? ":ro" : ""
        opts.push("-v", `${dotfilePath}:/mnt/fs-home${dotfilePath}${mountOption}`)
    }
    const dotfileInfo = dotfiles.join(" ")

    /*  determine "docker run" options for environment variables  */
    for (const envvar of envvars)
        opts.push("-e", envvar)

    /*  determine user/group information  */
    const ui = os.userInfo()
    const uid = ui.uid.toString()
    const gid = ui.gid.toString()
    const usr = ui.username
    await ensureTool("id")
    const response = await exec("id", [ "-g", "-n" ], { stdio: [ "ignore", "pipe", "ignore" ] })
        .catch((err: any) => { throw new Error(`failed to determine group name: ${err.message ?? err}`) })
    const grp = response.stdout.trim()

    /*  determine host information  */
    const hostname = os.hostname()

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
        "--rm",
        "--privileged",
        "-i",
        ...((process.stdin.isTTY ?? false) ? [ "-t" ] : []),
        ...opts,
        "-v", `${rcfile}:/etc/capsula-container:ro`,
        "-v", `${workdir}:/mnt/fs-work${workdir}`,
        "-v", `${nameVolume}:/mnt/fs-volume`,
        "--name", nameContainer,
        "--entrypoint", "/etc/capsula-container",

        /*  entrypoint arguments  */
        nameImage,
        args.platform,
        hostname,
        usr, uid,
        grp, gid,
        home,
        workdir,
        dotfileInfo,
        args.sudo ? "yes" : "false",

        /*  command to execute  */
        ...args._.map((x) => String(x))
    ], { stdio: "inherit" })
    result.on("exit", async (code) => {
        /*  cleanup resources  */
        await spool.unrollAll()

        /*  terminate gracefully  */
        if (code !== 0)
            cli!.log("warning", `encapsulated command terminated with ${chalk.red("error")} exit code ${chalk.red(code)}`)
        process.exit(code)
    })
})().catch(async (err) => {
    /*  cleanup resources and terminate ungracefully  */
    if (cli !== null)
        cli.log("error", err.message ?? err)
    else
        process.stderr.write(`rulebook: ${chalk.red("ERROR")}: ${err.message ?? err} ${err.stack}\n`)
    await spool.unrollAll()
    process.exit(1)
})

