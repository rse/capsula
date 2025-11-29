
# capsula(1) -- Encapsulated Command Execution

## SYNOPSIS

`capsula`
\[`-h`|`--help`\]
\[`-v`|`--version`\]
\[`-f`|`--config` *config*\]
\[`-l`|`--log-level` *level*\]
\[`-t`|`--type` *type*\]
\[`-d`|`--docker` *docker*\]
\[`-c`|`--context` *context*\]
\[`-s`|`--sudo`\]
\[`-e`|`--env` *variable*\]
\[`-m`|`--mount` *dotfile*\]
\[`-p`|`--port` *port*\]
\[`-I`|`--image` *image-name*\]
\[`-C`|`--container` *container-name*\]
\[`-V`|`--volume` *volume-name*\]
\[*command* ...\]

## DESCRIPTION

**Capsula** is a utility program for executing a *Linux* command in the
current working directory from within an encapsulated environment based
on a *Docker* or *Podman* container.

The crux is that the **Capsula** container environment provides a
special filesystem layout to the command, which mimics the host
filesystem paths as close as possible, but prevents access to
non-relevant areas of the user's home directory and persists changes to
the operating system.

## OPTIONS

The following command-line options and arguments exist to the `capsula(1)` command:

- \[`-h`|`--help`\]:
  Show program usage information only.

- \[`-v`|`--version`\]:
  Show program version information only.

- \[`-f`|`--config` *config*\]:
  For context configurations, read the custom file instead
  of the default `$HOME/.capsula.yaml` file.

- \[`-l`|`--log-level` *level*\]:
  Set the logging level: `error`, `warning`, `info` or `debug`.

- \[`-t`|`--type` *type*\]:
  Use a certain Linux platform for the Docker container.
  Currently `alpine`, `debian`, `ubuntu`, `alma`, `fedora`, `arch`,
  and `opensuse` are supported.

- \[`-d`|`--docker` *docker*\]:
  Use a certain `docker`(1) compatible command for access
  to the container runtime.

- \[`-c`|`--context` *context*\]:
  Use a certain context for naming the Docker container and volume.
  This allows to use separate encapsulations in parallel. The
  default context is named `default`.

- \[`-s`|`--sudo`\]:
  Enable sudo(8) for user in container.

- \[`-e`|`--env` *variable*\]:
  Pass environment variable to encapsulated command.
  This option can be given multiple times.
  Passing `!` as *variable* resets the environment variables
  from the *context* given by the specified *config* or the default.

- \[`-m`|`--mount` *mount*\]:
  Pass dotfile to encapsulated command.
  The *mount* argument has to be a pathname relative to the current user's home directory.
  This option can be given multiple times.
  Passing `!` as *mount* resets the dotfiles
  from the *context* given by the specified *config* or the default.

- \[`-p`|`--port` *port*\]:
  Map port for encapsulated command.
  This option can be given multiple times.
  Passing `!` as *port* resets the ports
  from the *context* given by the specified *config* or the default.

- \[`-I`|`--image` *image-name*\]:
  Set the name of the container image.
  When specified, the container runtime has to be able to fetch it.
  When not specified, it is auto-rebuilt based on the *type* (options `-t`/`--type`).
  The default is the unique name `capsula-`*username*`-`*type*`-`*context*`:`*version*,
  where *username* is the username of the current user,
  *type* corresponds to option `-t`/`--type`,
  *context* corresponds to option `-c`/`--context`,
  and *version* is the current **Capsula** version.
  Custom images need to have at least `bash`(1) under the system path `/bin/bash`,
  and the companion commands `hostname`(8), `mount`(8), `umount`(8),
  `pivot_root`(8) and `sudo`(8) in `$PATH`.

- \[`-C`|`--container` *container-name*\]:
  Set the name of the container.
  When specified, it has to be unique across the container runtime.
  It is created on all executions of **Capsula**.
  The default is the unique name `capsula-`*username*`-`*type*`-`*context*`-`*timestamp*,
  where *username* is the username of the current user,
  *type* corresponds to option `-t`/`--type`,
  *context* corresponds to option `-c`/`--context`,
  and *timestamp* is the current timestamp in `yyyy-MM-dd-HH-mm-ss-SSS` format.

- \[`-V`|`--volume` *volume-name*\]:
  Set the name of the container volume.
  When specified, it has to be unique across the container runtime.
  It is initially auto-created and then reused across all executions of **Capsula**.
  The default is the unique name `capsula-`*username*`-`*type*`-`*context*,
  where *username* is the username of the current user,
  *type* corresponds to option `-t`/`--type`,
  *context* corresponds to option `-c`/`--context`.

- \[*command* ...\]:
  Execute the particular command inside the Linux Docker container.
  If missing, `bash`(1) is called.

## CONFIGURATION

The following is the default context configuration:

```yaml
default:
    env:
        - TERM
        - HOME
    mount:
        - .bash_login
        - .bash_logout
        - .bashrc
        - .ssh/config
        - .ssh/authorized_keys
        - .ssh/known_hosts
        - .vim
        - .vimrc
        - .tmux.conf
        - .gitconfig
        - .npmrc
        - .cache!
    port:
        - 8888
```

An overriding custom configuration file can be given with option `-f`/`--config`.
Option `-e`/`--env` can be used to override the section `env`.
Option `-m`/`--mount` can be used to override the section `mount`.
Option `-p`/`--port` can be used to override the section `port`.

## EXAMPLE

The following installs *Node.js* and establishes a global package
environment for the user inside an encapsulated environment:

```sh
$ capsula -s sudo apt update
$ capsula -s bash -c \
  "curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -"
$ capsula -s sudo apt install -y nodejs
$ NPM=/npm
$ export NPM_CONFIG_PREFIX=$NPM
$ export NPM_CONFIG_CACHE=$NPM/.cache
$ capsula -e NPM -s sudo bash -c 'mkdir $NPM && chown $USER:$GROUP $NPM'
```

The following installs and runs *Claude Code* inside an encapsulated
environment:

```sh
$ capsula -e NPM_CONFIG_PREFIX -e NPM_CONFIG_CACHE \
  npm install -g @anthropic-ai/claude-code
$ capsula /npm/bin/claude
```

## DESIGN

**Capsula** provides a special filesystem layout to the encapsulated
commands with the following distinct design:

1. *Working Directory* (user read/write):
   The command is executed in the current working directory
   of the host system. This is achieved by read-write bind mounting
   the directory into the container under the same path as on the host.
   A constraint is that this working directory is either the
   home directory of the user or an arbitrary sub-directory.
   *RATIONALE*: This allows to execute command inside the container in
   a mostly identical way, as they would be executed on the host.

2. *Parent Paths inside Home Directory* (user read-only):
   The parent directories of the current working directory
   up to the home directory are empty, except for the
   directories on the path towards the current working
   directory.
   *RATIONALE*: This shields all potentially private data
   inside the home directory from the executed command.

3. *Home Directory* (user read/write):
   The home directory is empty except for the explicitly
   configured paths (usually dotfiles) and the working
   directory.
   *RATIONALE*: This allows one to run the command inside the container
   with the same configuration as it is available on the host.

4. *Parent Paths inside Root Directory* (root read/write):
   The parent directories of the home directory
   up to the root directory are exactly those as provided by the
   Linux container operating system, but changes are
   persisted across container usages in a Docker volume.
   *RATIONALE*: This allows to permanently install tools (as `root` via `sudo`(8))
   into the container in an arbitrary way without having
   to build a custom container image.

## SEE ALSO

docker(1).

## HISTORY

`capsula`(1) was developed in November 2025 to support
convenient encapsulated execution of sensible programs
like `claude`(1) (*Claude Code*) or `codex`(1) (*OpenAI Codex*).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
