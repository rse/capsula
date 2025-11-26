
ChangeLog
=========

0.9.6 (2025-11-26)
------------------

- IMPROVEMENT: allows dotfiles and environment to be configured
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

