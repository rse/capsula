##
##  Capsula -- Encapsulated Command Execution
##  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT <https://spdx.org/licenses/MIT>
##
##  capsula-container-alpine.dockerfile: Docker Container Specification (Alpine)
##

#   derive image from a certain base image
FROM        alpine:3.22

#   switch working directory
WORKDIR     /

#   prepare
RUN         apk update

#   update Alpine to latest patch-level
RUN         apk upgrade

#   install additional tools
RUN         apk add \
                ca-certificates lsb-release

#   install additional tools
RUN         apk add \
                shadow coreutils \
                sudo bash less tmux vim \
                procps net-tools htop lsof strace \
                mandoc man-pages man-pages-posix

#   reconfigure Alpine for EN/DE and ISO-Latin1/UTF8
RUN         apk add musl-locales musl-locales-lang && \
            ( echo "en_US ISO-8859-1"; \
              echo "en_US.ISO-8859-15 ISO-8859-15"; \
              echo "en_US.UTF-8 UTF-8"; \
              echo "de_DE ISO-8859-1"; \
              echo "de_DE.UTF-8 UTF-8"; \
              echo "de_DE@euro ISO-8859-15"; \
            ) >/etc/locale.gen; \
            locale -a

#   make sure TLS uses up-to-date CA certificates
RUN         update-ca-certificates

#   force new NPM prefix
RUN         mkdir -p /mnt/fs-volume
VOLUME      /mnt/fs-volume
RUN         chmod 777 /mnt/fs-volume

#   cleanup
RUN         apk cache clean && \
            rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

#   provide default entry point
ENTRYPOINT  []
CMD         []

