
# capsula(1) -- Encapsulated Command Execution

## SYNOPSIS

`capsula`
\[`-h`|`--help`\]
\[`-V`|`--version`\]
\[`-v`|`--verbose`\]
\[`-p`|`--platform` *platform*\]
\[`-c`|`--context` *context*\]
\[*command* ...\]

## DESCRIPTION

**Capsula** is a utility program for executing a *Linux* command in the
current working directory from within an encapsulated environment
based on a *Docker* container. The crux is that the **Capsula** container
environment provides a special filesystem layout to the command, which
mimicks the host filesystem paths as close as possible, but prevents
access to non-relevant areas of the user's home directory and persists
changes to the areas outside the user's home directory.

## OPTIONS

The following command-line options and arguments exist to the `capsula(1)` command:

- \[`-h`|`--help`\]:
  Show program usage information only.

- \[`-V`|`--version`\]:
  Show program version information only.

- \[`-v`|`--verbose`\]:
  Enable verbose messages.

- \[`-p`|`--platform` *platform*\]:
  Use a certain Linux platform for the Docker container.
  Currently `debian` and `alpine` are supported.

- \[`-c`|`--context` *context*\]:
  Use a certain context for naming the Docker container and volume.
  This allows to use separate encapsulations in parallel.

- \[*command* ...\]:
  Execute the particular command inside the Linux Docker container.
  If missing, `bash`(1) is called.

## EXAMPLE

The following installs and runs *Claude Code* inside an encapsulated
environment:

```sh
$ capsula apt update
$ capsula apt install -y nodejs
$ capsula npm install -g @anthropic-ai/claude-code
$ capsula claude
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
   configured paths (usuall dotfiles) and the working
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
