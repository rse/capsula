##
##  Capsula -- Encapsulated Command Execution
##  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT <https://spdx.org/licenses/MIT>
##

#   derive image from a certain base image
FROM        opensuse/tumbleweed:latest

#   switch working directory
WORKDIR     /

#   prepare
RUN         zypper --non-interactive refresh

#   update system to latest patch-level
RUN         zypper --non-interactive update

#   install additional tools
RUN         zypper --non-interactive install \
                ca-certificates hostname lsb-release

#   install additional tools
RUN         zypper --non-interactive install \
                sudo bash less tmux vim curl git \
                procps net-tools htop lsof strace \
                man man-pages

#   reconfigure system for EN/DE and ISO-Latin1/UTF8
RUN         zypper --non-interactive install glibc-locale glibc-i18ndata && \
            localedef -i en_US -f ISO-8859-1 en_US && \
            localedef -i en_US -f ISO-8859-15 en_US.ISO-8859-15 && \
            localedef -i en_US -f UTF-8 en_US.UTF-8 && \
            localedef -i de_DE -f ISO-8859-1 de_DE && \
            localedef -i de_DE -f UTF-8 de_DE.UTF-8 && \
            localedef -i de_DE -f ISO-8859-15 de_DE@euro

#   make sure TLS uses up-to-date CA certificates
RUN         update-ca-certificates

#   create volume
RUN         mkdir -p /mnt/fs-volume
VOLUME      /mnt/fs-volume
RUN         chmod 777 /mnt/fs-volume

#   cleanup
RUN         zypper --non-interactive clean --all && \
            rm -rf /var/cache/zypp/*
RUN         rm -rf /tmp/* /var/tmp/*

#   provide default entry point
ENTRYPOINT  []
CMD         []

