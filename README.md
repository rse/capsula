
<img src="https://raw.githubusercontent.com/rse/capsula/master/etc/capsula-logo.png" width="400" align="right" alt=""/>

Capsula
=======

**Encapsulated Command Execution**

[![github (author stars)](https://img.shields.io/github/stars/rse?logo=github&label=author%20stars&color=%233377aa)](https://github.com/rse)
[![github (author followers)](https://img.shields.io/github/followers/rse?label=author%20followers&logo=github&color=%234477aa)](https://github.com/rse)
<br/>
[![npm (project release)](https://img.shields.io/npm/v/capsula?logo=npm&label=npm%20release&color=%23cc3333)](https://npmjs.com/capsula)
[![npm (project downloads)](https://img.shields.io/npm/dm/capsula?logo=npm&label=npm%20downloads&color=%23cc3333)](https://npmjs.com/capsula)

Abstract
--------

**Capsula** is a utility program for executing a *Linux* command in the
current working directory from within an encapsulated environment
based on a *Docker* container. The crux is that the **Capsula** container
environment provides a special filesystem layout to the command, which
mimics the host filesystem paths as close as possible, but prevents
access to non-relevant areas of the user's home directory and persists
changes to the areas outside the user's home directory.

Installation
------------

```
$ npm install -g capsula
```

Usage
-----

**Capsula** provides the following command-line interface:

$ `capsula`
\[`-h`|`--help`\]
\[`-V`|`--version`\]
\[`-v`|`--verbose`\]
\[`-p`|`--platform` *platform*\]
\[`-c`|`--context` *context*\]
\[*command* ...\]

The particular command-line options and arguments are:

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

Example
-------

The following installs and runs *Claude Code* inside an encapsulated
environment:

```sh
$ capsula apt update
$ capsula apt install -y nodejs
$ capsula npm install -g @anthropic-ai/claude-code
$ capsula claude
```

Design
------

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

License
-------

Copyright &copy; 2025 Dr. Ralf S. Engelschall (http://engelschall.com/)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

