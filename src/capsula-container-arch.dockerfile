##
##  Capsula -- Encapsulated Command Execution
##  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT <https://spdx.org/licenses/MIT>
##

#   derive image from a certain base image
FROM        archlinux/archlinux:base

#   switch working directory
WORKDIR     /

#   prepare and update system to latest
RUN         pacman -Syu --noconfirm

#   install additional tools
RUN         pacman -Sy --noconfirm ca-certificates

#   install additional tools
RUN         pacman -Sy --noconfirm \
                sudo bash less tmux vim curl git \
                procps-ng net-tools inetutils htop lsof strace \
                man-db man-pages

#   reconfigure system for EN/DE and ISO-Latin1/UTF8
RUN         sed -i \
                -e '/^NoExtract.*usr\/share\/i18n/s;$; !usr/share/i18n/charmaps/ISO-8859-*.gz !usr/share/i18n/locales/de_*;' \
                /etc/pacman.conf && \
            pacman -Sy --noconfirm --disable-sandbox glibc-locales && \
            pacman -S  --noconfirm --disable-sandbox glibc
RUN         sed -i -e 's;^#\(en_US\.UTF-8 UTF-8\);\1;' \
                -e 's;^#\(en_US ISO-8859-1\);\1;' \
                -e 's;^#\(de_DE\.UTF-8 UTF-8\);\1;' \
                -e 's;^#\(de_DE ISO-8859-1\);\1;' \
                -e 's;^#\(de_DE@euro ISO-8859-15\);\1;' \
                /etc/locale.gen
RUN         locale-gen

#   make sure TLS uses up-to-date CA certificates
RUN         trust extract-compat

#   create volume
RUN         mkdir -p /mnt/fs-volume
VOLUME      /mnt/fs-volume
RUN         chmod 777 /mnt/fs-volume

#   cleanup
RUN         pacman -Rns --noconfirm $(pacman -Qtdq) 2>/dev/null || true && \
            pacman -Scc --noconfirm && \
            rm -rf /var/cache/pacman/pkg/*
RUN         rm -rf /tmp/* /var/tmp/*

#   provide default entry point
ENTRYPOINT  []
CMD         []

