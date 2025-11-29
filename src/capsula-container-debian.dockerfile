##
##  Capsula -- Encapsulated Command Execution
##  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT <https://spdx.org/licenses/MIT>
##
##  capsula-container-debian.dockerfile: Docker Container Specification (Debian)
##

#   derive image from a certain base image
FROM        debian:13

#   switch working directory
WORKDIR     /

#   prepare
RUN         apt-get update

#   update system to latest patch-level
RUN         apt-get upgrade -y

#   install additional tools
RUN         apt-get install -y --no-install-recommends \
                apt-utils apt-transport-https ca-certificates lsb-release

#   install additional tools
RUN         apt-get install -y --no-install-recommends \
                sudo bash less tmux vim curl git \
                procps net-tools htop lsof strace \
                man manpages

#   reconfigure system for EN/DE and ISO-Latin1/UTF8
RUN         apt-get install -y --no-install-recommends locales && \
            ( echo "en_US ISO-8859-1"; \
              echo "en_US.ISO-8859-15 ISO-8859-15"; \
              echo "en_US.UTF-8 UTF-8"; \
              echo "de_DE ISO-8859-1"; \
              echo "de_DE.UTF-8 UTF-8"; \
              echo "de_DE@euro ISO-8859-15"; \
            ) >/etc/locale.gen; \
            locale-gen

#   make sure TLS uses up-to-date CA certificates
RUN         update-ca-certificates

#   create volume
RUN         mkdir -p /mnt/fs-volume
VOLUME      /mnt/fs-volume
RUN         chmod 777 /mnt/fs-volume

#   cleanup
RUN         apt-get purge -y --auto-remove && \
            apt-get clean && \
            rm -rf /var/lib/apt/lists/*
RUN         /tmp/* /var/tmp/*

#   provide default entry point
ENTRYPOINT  []
CMD         []

