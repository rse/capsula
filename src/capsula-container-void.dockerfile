##
##  Capsula -- Encapsulated Command Execution
##  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT <https://spdx.org/licenses/MIT>
##

#   derive image from a certain base image
FROM        ghcr.io/void-linux/void-glibc:latest

#   switch working directory
WORKDIR     /

#   prepare and update system to latest
RUN         xbps-install -Syu xbps
RUN         xbps-install -Syu

#   install additional tools
RUN         xbps-install -Sy \
                ca-certificates

#   install additional tools
RUN         xbps-install -Sy \
                util-linux shadow \
                sudo bash less tmux vim curl git \
                procps-ng net-tools htop lsof strace \
                man-db man-pages

#   ensure root has a proper shadow entry and PAM/sudo works
RUN         passwd -d root && \
            printf "%s\n" \
                "auth       sufficient  pam_permit.so"  \
                "account    sufficient  pam_permit.so"  \
                "session    sufficient  pam_permit.so"  \
                >/etc/pam.d/sudo

#   reconfigure system for EN/DE and ISO-Latin1/UTF8
RUN         xbps-install -Sy glibc-locales && \
            sed -i -e 's;^#\(en_US\.UTF-8 UTF-8\);\1;' \
                -e 's;^#\(en_US ISO-8859-1\);\1;' \
                -e 's;^#\(de_DE\.UTF-8 UTF-8\);\1;' \
                -e 's;^#\(de_DE ISO-8859-1\);\1;' \
                -e 's;^#\(de_DE@euro ISO-8859-15\);\1;' \
                /etc/default/libc-locales && \
            xbps-reconfigure -f glibc-locales

#   make sure TLS uses up-to-date CA certificates
RUN         update-ca-certificates

#   create volume
RUN         mkdir -p /mnt/fs-volume
VOLUME      /mnt/fs-volume
RUN         chmod 777 /mnt/fs-volume

#   cleanup
RUN         xbps-remove -Oo && \
            rm -rf /var/cache/xbps/*
RUN         rm -rf /tmp/* /var/tmp/*

#   provide default entry point
ENTRYPOINT  []
CMD         []
