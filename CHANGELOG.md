
ChangeLog
=========

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

