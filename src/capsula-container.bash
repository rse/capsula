#!/bin/bash
##
##  Capsula -- Encapsulated Command Execution
##  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT <https://spdx.org/licenses/MIT>
##

#   fatal error utility
fatal () { echo "capsula: ERROR: $1" 1>&2; exit 1; }

#   take over parameters
platform="$1"; shift
hostname="$1"; shift
usr="$1";      shift
uid="$1";      shift
grp="$1";      shift
gid="$1";      shift
homedir="$1";  shift
workdir="$1";  shift
dotfiles_count="$1"; shift
dotfiles=()
for ((i = 0; i < dotfiles_count; i++)); do
    dotfiles+=("$1"); shift
done
binds_count="$1"; shift
binds=()
for ((i = 0; i < binds_count; i++)); do
    binds+=("$1"); shift
done
envvars="$1";  shift
sudo="$1";     shift

#   implicitly change hostname
if [[ ! "$hostname" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    fatal "invalid hostname format"
fi
echo "127.0.0.1 $hostname" >>/etc/hosts
echo "$hostname" >/etc/hostname
hostname "$hostname"
HOSTNAME="$hostname"
export HOSTNAME

#   overlay root filesystem with external volume
mkdir -p /mnt/fs-root /mnt/fs-volume/root/{store,work}
mount -t overlay \
    -o lowerdir=/,upperdir=/mnt/fs-volume/root/store,workdir=/mnt/fs-volume/root/work \
    overlay /mnt/fs-root \
    || fatal "failed to mount overlay root filesystem"

#   remount standard system filesystems
mount --move /proc /mnt/fs-root/proc || fatal "failed to move /proc"
mount --move /sys  /mnt/fs-root/sys  || fatal "failed to move /sys"
mount --move /dev  /mnt/fs-root/dev  || fatal "failed to move /dev"

#   remount standard Docker bind mounts
mount --move /etc/resolv.conf /mnt/fs-root/etc/resolv.conf || fatal "failed to move /etc/resolv.conf"
mount --move /etc/hostname    /mnt/fs-root/etc/hostname    || fatal "failed to move /etc/hostname"
mount --move /etc/hosts       /mnt/fs-root/etc/hosts       || fatal "failed to move /etc/hosts"

#   remount custom Docker bind mounts for run-command script
mount --move /etc/capsula-container /mnt/fs-root/etc/capsula-container || fatal "failed to move /etc/capsula-container"

#   remount custom Docker bind mounts for dotfiles
mkdir -p "/mnt/fs-root$homedir"
for dotfile in "${dotfiles[@]}"; do
    if [[ -d "/mnt/fs-home$homedir/$dotfile" ]]; then
        mkdir -p "/mnt/fs-root$homedir/$dotfile"
    elif [[ -f "/mnt/fs-home$homedir/$dotfile" ]]; then
        mkdir -p "$(dirname "/mnt/fs-root$homedir/$dotfile")"
        touch "/mnt/fs-root$homedir/$dotfile"
    else
        echo "capsula: WARNING: dot-path \"$dotfile\" neither directory nor file" 1>&2
        continue
    fi
    mount --move "/mnt/fs-home$homedir/$dotfile" "/mnt/fs-root$homedir/$dotfile" \
        || fatal "failed to move dotfile \"$dotfile\""
done

#   remount custom Docker bind mounts for external binds
for bind in "${binds[@]}"; do
    if [[ -d "/mnt/fs-bind$bind" ]]; then
        mkdir -p "/mnt/fs-root$bind"
    elif [[ -f "/mnt/fs-bind$bind" ]]; then
        mkdir -p "$(dirname "/mnt/fs-root$bind")"
        touch "/mnt/fs-root$bind"
    else
        echo "capsula: WARNING: bind-path \"$bind\" neither directory nor file" 1>&2
        continue
    fi
    mount --move "/mnt/fs-bind$bind" "/mnt/fs-root$bind" \
        || fatal "failed to move bind \"$bind\""
done

#   remount custom Docker bind mount for working directory
mkdir -p "/mnt/fs-root$workdir"
mount --move "/mnt/fs-work$workdir" "/mnt/fs-root$workdir" \
    || fatal "failed to move working directory"

#   switch root filesystem
mkdir -p /mnt/fs-root/fs-root-old
cd /mnt/fs-root
pivot_root . fs-root-old \
    || fatal "failed to pivot root filesystem"
umount -l /fs-root-old \
    || fatal "failed to unmount old root filesystem"

#   provide hint about environment and platform
ENVIRONMENT="capsula"; export ENVIRONMENT
PLATFORM="$platform";  export PLATFORM

#   enforce shell
SHELL="/bin/bash"; export SHELL

#   provide hint about user/group
USER="$usr";  export USER
GROUP="$grp"; export GROUP

#   determine list of environment variables to pass-through
preserve="ENVIRONMENT,PLATFORM,SHELL,USER,GROUP"
if [[ -n "$envvars" ]]; then
    preserve="$preserve,$(echo "$envvars" | sed -e 's; ;,;g')"
fi

#   provide same user/group as on host
if ! getent group $grp >/dev/null 2>&1; then
    if ! groupadd -f -g $gid $grp; then
        fatal "failed to create group \"$grp\" ($gid)"
    fi
fi
if ! getent passwd $usr >/dev/null 2>&1; then
    if [[ $platform == "alpine" ]]; then
        useradd -M -d "$homedir" -s "$SHELL" -u $uid -g $grp $usr >/dev/null 2>&1
    else
        useradd -M -d "$homedir" -s "$SHELL" -u $uid -g $grp $usr
    fi
    if [[ $? -ne 0 ]]; then
        fatal "failed to create user \"$usr\" ($uid)"
    fi
fi

#   allows user to switch to superuser
if [[ $sudo == "yes" ]]; then
    echo "$usr ALL=(ALL:ALL) NOPASSWD: ALL" >"/etc/sudoers.d/capsula"
    chmod 440 "/etc/sudoers.d/capsula"
else
    rm -f "/etc/sudoers.d/capsula"
fi

#   grant access to home directory
chown $usr:$grp "$homedir"

#   implicitly change current working directory
cd "$workdir"

#   pass-through execution
if [[ $# -eq 0 ]]; then
    #   enter an interactive shell
    exec sudo -n "--preserve-env=$preserve" -g "$grp" -u "$usr" "$SHELL" -i
else
    #   execute batch command
    exec sudo -n "--preserve-env=$preserve" -g "$grp" -u "$usr" "$@"
fi

