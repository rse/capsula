
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
\[`-e`|`--env` *variable*\[`=`*value*\]\]
\[`-m`|`--mount` *dotfile*\]
\[`-b`|`--bind` *path*\]
\[`-n`|`--null` *path*\]
\[`-p`|`--port` *port-spec*\]
\[`-I`|`--image` *image-name*\]
\[`-C`|`--container` *container-name*\]
\[`-V`|`--volume` *volume-name*\]
\[`-P`|`--platform` *platform*\]
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
  Use a certain Linux distribution type for the Docker container.
  Currently `alpine`, `debian`, `ubuntu`, `alma`, `fedora`, `arch`,
  `opensuse`, and `void` are supported.

- \[`-d`|`--docker` *docker*\]:
  Use a certain `docker`(1) compatible command for access
  to the container runtime.

- \[`-c`|`--context` *context*\]:
  Use a certain context for naming the Docker container and volume.
  This allows one to use separate encapsulations in parallel. The
  default context is named `default`.

- \[`-s`|`--sudo`\]:
  Enable sudo(8) for user in container.

- \[`-e`|`--env` *variable*\[`=`*value*\]\]:
  Pass environment variable to encapsulated command.
  This option can be given multiple times.
  Passing `!` as *variable* resets the environment variables
  from the *context* given by the specified *config* or the default.
  Giving *value* allows optionally to override the value of the
  environment variable.

- \[`-m`|`--mount` *dotfile*\]:
  Pass dotfile to encapsulated command. The *dotfile* argument has to
  be a pathname relative to the current user's home directory. The
  mount is read-only by default. Appending `!` to the *dotfile* makes it
  read-write. This option can be given multiple times. Passing `!` as
  *dotfile* resets the dotfiles from the *context* given by the specified
  *config* or the default.

- \[`-b`|`--bind` *path*\]:
  Bind-mount an external directory or file into the container. The *path*
  argument has to be an absolute pathname. The bind mount is read-only
  by default. Appending `!` to the *path* makes it read-write. This
  option can be given multiple times. Passing `!` as *path* resets the
  bind mounts from the *context* given by the specified *config* or the
  default.

- \[`-n`|`--null` *path*\]:
  Null-mount (hide) a file or directory inside the container.
  If *path* starts with `/`, it is treated as an absolute pathname;
  otherwise it is treated as relative to the current working directory.
  For files, `/dev/null` is bind-mounted over the target, making it
  appear empty. For directories, an empty `tmpfs` is mounted over the target,
  making it appear empty. This is useful for hiding sensitive files
  (e.g., `.env`, credential files) that exist within mounted dotfiles
  or bind-mounted directories. This option can be given multiple times.
  Passing `!` as *path* resets the null mounts from the *context*
  given by the specified *config* or the default.

- \[`-p`|`--port` *port-spec*\]:
  Map port for encapsulated command.
  The *port-spec* can be a plain port number (e.g., `8080`),
  a *host-port*`:`*container-port* pair (e.g., `8080:9090`),
  an *ip*`:`*host-port*`:`*container-port* triple (e.g., `127.0.0.1:8080:9090`
  or `[::1]:8080:9090` for IPv6),
  or any of these with a `/tcp` or `/udp` protocol suffix (e.g., `8080/udp`).
  A plain port number is mapped identically on both host and container side.
  Port numbers must be in the range 1-65535.
  This option can be given multiple times.
  Passing `!` as *port-spec* resets the ports
  from the *context* given by the specified *config* or the default.

- \[`-I`|`--image` *image-name*\]:
  Set the name of the container image.
  When specified, the container runtime has to be able to fetch it.
  When not specified, it is auto-rebuilt based on the *type* (options `-t`/`--type`).
  The default is the unique name `capsula-`*username*`-`*type*`-`*context*\[`-`*platform*\]`:`*version*,
  where *username* is the username of the current user,
  *type* corresponds to option `-t`/`--type`,
  *context* corresponds to option `-c`/`--context`,
  *platform* (if given) corresponds to option `-P`/`--platform`
  with slashes replaced by dashes,
  and *version* is the current **Capsula** version.
  Custom images need to have at least `bash`(1) under the system path `/bin/bash`,
  and the companion commands `hostname`(8), `mount`(8), `umount`(8),
  `pivot_root`(8) and `sudo`(8) in `$PATH`.

- \[`-C`|`--container` *container-name*\]:
  Set the name of the container.
  When specified, it has to be unique across the container runtime.
  It is created on all executions of **Capsula**.
  The default is the unique name `capsula-`*username*`-`*type*`-`*context*\[`-`*platform*\]`-`*timestamp*,
  where *username* is the username of the current user,
  *type* corresponds to option `-t`/`--type`,
  *context* corresponds to option `-c`/`--context`,
  *platform* (if given) corresponds to option `-P`/`--platform`
  with slashes replaced by dashes,
  and *timestamp* is the current timestamp in `yyyy-MM-dd-HH-mm-ss-SSS` format.

- \[`-V`|`--volume` *volume-name*\]:
  Set the name of the container volume.
  When specified, it has to be unique across the container runtime.
  It is initially auto-created and then reused across all executions of **Capsula**.
  The default is the unique name `capsula-`*username*`-`*type*`-`*context*\[`-`*platform*\],
  where *username* is the username of the current user,
  *type* corresponds to option `-t`/`--type`,
  *context* corresponds to option `-c`/`--context`,
  and *platform* (if given) corresponds to option `-P`/`--platform`
  with slashes replaced by dashes.

- \[`-P`|`--platform` *platform*\]:
  Set the Docker platform for building and running the container
  (e.g., `linux/amd64` or `linux/arm64`). This is passed as
  `--platform` to both `docker build` and `docker run`.
  When specified, the platform is also encoded into the
  auto-generated image, container, and volume names
  (with slashes replaced by dashes) to keep them distinct
  per platform.

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
    bind: []
    null: []
    port:
        - "8888"
```

An overriding custom configuration file can be given with option `-f`/`--config`.
Option `-e`/`--env` can be used to override the section `env`.
Option `-m`/`--mount` can be used to override the section `mount`.
Option `-b`/`--bind` can be used to override the section `bind`.
Option `-n`/`--null` can be used to override the section `null`.
Option `-p`/`--port` can be used to override the section `port`.

## ENVIRONMENT

The following environment variables can be used to provide
default values for the corresponding command-line options:

- `CAPSULA_CONFIG`:
  Default value for option `-f`/`--config`.
  If not set, defaults to `$HOME/.capsula.yaml`.

- `CAPSULA_LOGLEVEL`:
  Default value for option `-l`/`--log-level`.
  If not set, defaults to `info`.

- `CAPSULA_TYPE`:
  Default value for option `-t`/`--type`.
  If not set, defaults to `debian`.

- `CAPSULA_DOCKER`:
  Default value for option `-d`/`--docker`.
  If not set, auto-detects `docker`, `podman`, or `nerdctl`.

- `CAPSULA_CONTEXT`:
  Default value for option `-c`/`--context`.
  If not set, defaults to `default`.

- `CAPSULA_SUDO`:
  Default value for option `-s`/`--sudo`.
  Set to `true`, `1`, or `yes` (case-insensitive) to enable.
  If not set, defaults to `false`.

- `CAPSULA_ENV`:
  Default value for option `-e`/`--env`.
  Multiple values can be separated by whitespace or comma.
  If not set, defaults to an empty list.

- `CAPSULA_MOUNT`:
  Default value for option `-m`/`--mount`.
  Multiple values can be separated by whitespace or comma.
  If not set, defaults to an empty list.

- `CAPSULA_BIND`:
  Default value for option `-b`/`--bind`.
  Multiple values can be separated by whitespace or comma.
  If not set, defaults to an empty list.

- `CAPSULA_NULL`:
  Default value for option `-n`/`--null`.
  Multiple values can be separated by whitespace or comma.
  If not set, defaults to an empty list.

- `CAPSULA_PORT`:
  Default value for option `-p`/`--port`.
  Multiple values can be separated by whitespace or comma.
  If not set, defaults to an empty list.

- `CAPSULA_PLATFORM`:
  Default value for option `-P`/`--platform`.
  If not set, defaults to no explicit platform (Docker default).

- `CAPSULA_IMAGE`:
  Default value for option `-I`/`--image`.
  If not set, the image name is auto-generated.

- `CAPSULA_CONTAINER`:
  Default value for option `-C`/`--container`.
  If not set, the container name is auto-generated.

- `CAPSULA_VOLUME`:
  Default value for option `-V`/`--volume`.
  If not set, the volume name is auto-generated.

## EXAMPLE

The following installs *Node.js* and *Claude Code* inside an
encapsulated environment with the help of `capsula`(1) and `yq`(1):

```sh
# update system
capsula -s sudo apt update
capsula -s sudo apt upgrade

# install Node.js
capsula -s bash -c \
    "curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -"
capsula -s sudo apt install -y nodejs

# configure NPM environment
yq -i '.claude.env += [ "NPM=/npm" ]' ~/.capsula.yaml
yq -i '.claude.env += [ "NPM_CONFIG_PREFIX=/npm" ]' ~/.capsula.yaml
yq -i '.claude.env += [ "NPM_CONFIG_CACHE=/npm/.cache" ]' ~/.capsula.yaml
capsula -s sudo bash -c 'mkdir $NPM && chown $USER:$GROUP $NPM'

# install Claude Code and companion tools into NPM environment
capsula npm install -y -g @anthropic-ai/claude-code
capsula npm install -y -g ccstatusline
capsula npm install -y -g tweakcc

# configure Claude Code environment
yq -i '.claude.mount += [ ".claude/" ]' ~/.capsula.yaml
yq -i '.claude.mount += [ ".claude.json" ]' ~/.capsula.yaml
yq -i '.claude.mount += [ ".config/ccstatusline/" ]' ~/.capsula.yaml
yq -i '.claude.mount += [ ".tweakcc/" ]' ~/.capsula.yaml

# use Claude Code
echo 'alias claude="capsula -c claude /npm/bin/claude"' >~/.dotfiles/bashrc
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
   *RATIONALE*: This allows one to execute commands inside the container in
   a mostly identical way as they would be executed on the host.

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

4. *External Bind Mounts* (user read-only or read-write):
   Arbitrary directories or files outside the home directory can be bind-mounted
   into the container with their original paths preserved.
   By default, external bind mounts are read-only. Appending `!` to
   the path makes them read-write.
   *RATIONALE*: This allows commands inside the container to access
   external data directories (e.g., `/data/projects`, `/opt/tools`)
   without granting access to the entire host filesystem.

5. *Parent Paths inside Root Directory* (root read/write):
   The parent directories of the home directory
   up to the root directory are exactly those as provided by the
   Linux container operating system, but changes are
   persisted across container usages in a Docker volume.
   *RATIONALE*: This allows one to permanently install tools (as `root` via `sudo`(8))
   into the container in an arbitrary way without having
   to build a custom container image.

6. *Null Mounts* (hidden):
   Specific files or directories can be null-mounted (hidden) inside the
   container. Files are hidden by bind-mounting `/dev/null` over them,
   directories by mounting an empty `tmpfs`. Null mounts are applied after
   all other mounts are in place.
   *RATIONALE*: This allows one to hide sensitive files like `.env` or
   credential files that might be present in mounted dotfiles or
   bind-mounted directories, preventing the encapsulated command
   from accessing them.

## SEE ALSO

`docker`(1), `yq`(1).

## HISTORY

`capsula`(1) was developed in November 2025 to support
convenient encapsulated execution of sensitive programs
like `claude`(1) (*Claude Code*) or `codex`(1) (*OpenAI Codex*).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>

