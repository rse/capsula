
ChangeLog
=========

1.2.2 (2026-03-15)
------------------

- IMPROVEMENT: use a more elaborated version of the internal Spool class
- IMPROVEMENT: provide more meaningful error messages in case "docker volume inspect" failed
- BUGFIX: use "deepmerge" for merging configuration
- BUGFIX: avoid double settlement of internal promise and use "close" event of sub-process
- BUGFIX: correctly handle the signal case in the "exit" handler of "docker run"
- BUGFIX: correctly propagate signals to container child process and add force-killsafety net
- BUGFIX: make inspection of docker volume more robust
- BUGFIX: avoid "unhandled promise rejection" errors on spawning commands
- BUGFIX: handle errors in spawning commands
- BUGFIX: fix internal processing of both an environment variable and a CLI option at the same time
- BUGFIX: avoid unhandled promise rejection errors caused by async callback functions
- BUGFIX: unspool the correct spool in case of a "docker build" failure
- BUGFIX: do not produce trailing commas for environment variable related sudo option
- BUGFIX: pass dotfiles and bind information as individual arguments into container for more robustness
- BUGFIX: correctly quote risky variables in container startup script
- CLEANUP: activate more locales also in Arch container
- CLEANUP: add error handling to the container startup script
- CLEANUP: be more precise in description what to install as prequisites
- CLEANUP: check the return code of groupadd and useradd commands in the container startup script
- CLEANUP: do not pass the read-only flag of volumes into container as it is unused there
- UPDATE: upgrade NPM dependencies

1.2.1 (2026-03-15)
------------------

- CLEANUP: various code cleanups (improve readability, type safety, and structure)
- CLEANUP: update README.md for latest changes

1.2.0 (2026-03-15)
------------------

- IMPROVEMENT: support bind-mounting arbitrary paths

1.1.0 (2026-03-14)
------------------

- IMPROVEMENT: let option -e/--env accept also values
- IMPROVEMENT: allow options to be overridden by environment variables
- IMPROVEMENT: factor out common code
- IMPROVEMENT: improve type safety
- IMPROVEMENT: improve rendering
- IMPROVEMENT: provide more elaborative usage example
- BUGFIX: fix shell escaping
- BUGFIX: fix option handling
- BUGFIX: avoid compiler warning
- UPDATE: upgrade NPM dependencies
- CLEANUP: update year in copyright messages
- CLEANUP: replace tabs with spaces
- CLEANUP: add missing trailing blank line

1.0.2 (2025-12-15)
------------------

- UPGRADE: updated Alpine container image to Alpine Linux 3.23
- UPGRADE: upgrade NPM dependencies

1.0.1 (2025-12-06)
------------------

- UPGRADE: upgrade NPM dependencies

1.0.0 (2025-11-29)
------------------

- IMPROVEMENT: add Ubuntu Linux platform support
- IMPROVEMENT: add Alma Linux platform support
- IMPROVEMENT: add Arch Linux platform support
- IMPROVEMENT: add Fedora Linux platform support
- IMPROVEMENT: add OpenSUSE Linux platform support
- IMPROVEMENT: allow dotfiles to be added on command-line
- IMPROVEMENT: allow ports to be mapped
- IMPROVEMENT: allow image, container and volume name be overridden
- BUGFIX: fix handling of execa() response object

0.9.8 (2025-11-27)
------------------

- IMPROVEMENT: be more precise on platform detection inside container
- IMPROVEMENT: add option -s|--sudo to enable sudo(8) for user in container
- IMPROVEMENT: add option -e|--env to pass environment variable to container

0.9.7 (2025-11-27)
------------------

- IMPROVEMENT: add platform to names
- IMPROVEMENT: switch to info level by default
- IMPROVEMENT: switch to plain non-node container images by default
- IMPROVEMENT: improve platform handling

0.9.6 (2025-11-27)
------------------

- IMPROVEMENT: allows dotfiles and environment to be configured
- IMPROVEMENT: add spinner to track "docker build" output
- IMPROVEMENT: make container image, container and volume names more unique
- BUGFIX: fix building of container image
- BUGFIX: stop parsing command-line options on first non-option
- CLEANUP: cleanup usage documentation
- CLEANUP: remove no longer needed base directory calculation

0.9.5 (2025-11-26)
------------------

- BUGFIX: fix argument passing to "docker run"
- IMPROVEMENT: use CLIio for logging and connect option "-v"
- CLEANUP: cleanup logging outputs

0.9.4 (2025-11-25)
------------------

- IMPROVEMENT: allow docker(1) compatible command to be explicity set, too
- IMPROVEMENT: blindly add support for Podman [Desktop] and Rancher Desktop
- CLEANUP: remove unnecessary dependency

0.9.3 (2025-11-25)
------------------

- IMPROVEMENT: pass option "-t" only to "docker run" when stdin is a TTY
- BUGFIX: fix packaging and publishing again

0.9.2 (2025-11-25)
------------------

- BUGFIX: fix packaging and publishing

0.9.1 (2025-11-25)
------------------

- UPGRADE: upgrade NPM dependencies
- CLEANUPS: various code cleanups

0.9.0 (2025-11-25)
------------------

(first version)

