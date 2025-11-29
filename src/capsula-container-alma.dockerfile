##
##  Capsula -- Encapsulated Command Execution
##  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT <https://spdx.org/licenses/MIT>
##

#   derive image from a certain base image
FROM        almalinux:9

#   switch working directory
WORKDIR     /

#   prepare
RUN         dnf makecache && \
            dnf install -y epel-release && \
            dnf makecache

#   update system to latest patch-level
RUN         dnf upgrade -y

#   install additional tools
RUN         dnf install -y \
                dnf-utils ca-certificates lsb-release

#   install additional tools
RUN         dnf install -y --allowerasing \
                sudo bash less tmux vim curl git \
                procps-ng net-tools htop lsof strace \
                man-db man-pages

#   reconfigure system for EN/DE and ISO-Latin1/UTF8
RUN         dnf install -y glibc-langpack-en glibc-langpack-de glibc-locale-source && \
            localedef -i en_US -f ISO-8859-1 en_US && \
            localedef -i en_US -f ISO-8859-15 en_US.ISO-8859-15 && \
            localedef -i en_US -f UTF-8 en_US.UTF-8 && \
            localedef -i de_DE -f ISO-8859-1 de_DE && \
            localedef -i de_DE -f UTF-8 de_DE.UTF-8 && \
            localedef -i de_DE -f ISO-8859-15 de_DE@euro

#   make sure TLS uses up-to-date CA certificates
RUN         update-ca-trust

#   create volume
RUN         mkdir -p /mnt/fs-volume
VOLUME      /mnt/fs-volume
RUN         chmod 777 /mnt/fs-volume

#   cleanup
RUN         dnf autoremove -y && \
            dnf clean all && \
            rm -rf /var/cache/dnf/*
RUN         rm -rf /tmp/* /var/tmp/*

#   provide default entry point
ENTRYPOINT  []
CMD         []

