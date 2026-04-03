#!/bin/bash
##
##  Capsula -- Encapsulated Command Execution
##  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT <https://spdx.org/licenses/MIT>
##

#   take over parameters
distro="$1"; shift
hostname="$1"; shift
usr="$1"; shift
uid="$1"; shift
grp="$1"; shift
gid="$1"; shift
homedir="$1"; shift
workdir="$1"; shift
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
nulls_count="$1"; shift
nulls=()
for ((i = 0; i < nulls_count; i++)); do
    nulls+=("$1"); shift
done
envvars="$1"; shift
sudo="$1"; shift

#   fatal error utility
fatal () { echo "capsula: ERROR: $1" 1>&2; exit 1; }

#   implicitly change hostname
if [[ ! "$hostname" =~ ^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$ ]] \
    || [[ "$hostname" =~ \.\. ]] \
    || [[ ${#hostname} -gt 253 ]]; then
    fatal "invalid hostname format"
fi
echo "127.0.0.1 $hostname" >>/etc/hosts
echo "$hostname" >/etc/hostname
if command -v hostname >/dev/null 2>&1; then
    hostname "$hostname"
else
    echo "$hostname" >/proc/sys/kernel/hostname
fi
HOSTNAME="$hostname"
export HOSTNAME

#   overlay root filesystem with external volume
mkdir -p /mnt/fs-root /mnt/fs-volume/root/{store,work}
mount -t overlay \
    -o lowerdir=/,upperdir=/mnt/fs-volume/root/store,workdir=/mnt/fs-volume/root/work \
    overlay /mnt/fs-root \
    || fatal "failed to mount overlay root filesystem"

#   remount standard system filesystems
mount --move /proc /mnt/fs-root/proc \
    || fatal "failed to move /proc"
mount --move /sys  /mnt/fs-root/sys \
    || fatal "failed to move /sys"
mount --move /dev  /mnt/fs-root/dev \
    || fatal "failed to move /dev"

#   remount standard Docker bind mounts
mount --move /etc/resolv.conf /mnt/fs-root/etc/resolv.conf \
    || fatal "failed to move /etc/resolv.conf"
mount --move /etc/hostname    /mnt/fs-root/etc/hostname \
    || fatal "failed to move /etc/hostname"
mount --move /etc/hosts       /mnt/fs-root/etc/hosts \
    || fatal "failed to move /etc/hosts"

#   remount custom Docker bind mounts for run-command script
mount --move /etc/capsula-container /mnt/fs-root/etc/capsula-container \
    || fatal "failed to move /etc/capsula-container"

#   remount custom Docker bind mount for working directory
mkdir -p "/mnt/fs-root$workdir"
mount --move "/mnt/fs-work$workdir" "/mnt/fs-root$workdir" \
    || fatal "failed to move working directory"

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

#   switch root filesystem
mkdir -p /mnt/fs-root/fs-root-old
cd /mnt/fs-root
pivot_root . fs-root-old \
    || fatal "failed to pivot root filesystem"
umount -l /fs-root-old \
    || fatal "failed to unmount old root filesystem"

#   null-mount (hide) specified files and directories
for nullpath in "${nulls[@]}"; do
    if [[ "$nullpath" != /* ]]; then
        fatal "null-path \"$nullpath\" is not an absolute path"
    fi
    if [[ -d "$nullpath" ]]; then
        nullmode=$(stat -c "%a" "$nullpath" 2>/dev/null)
        if [[ -z "$nullmode" ]]; then
            echo "capsula: WARNING: failed to determine permissions of directory \"$nullpath\" -- falling back to 0755" 1>&2
        fi
        mount -t tmpfs -o "size=0,mode=${nullmode:-0755},uid=$uid,gid=$gid" tmpfs "$nullpath" \
            || fatal "failed to null-mount directory \"$nullpath\""
    elif [[ -f "$nullpath" ]]; then
        nullmode=$(stat -c "%a" "$nullpath" 2>/dev/null)
        if [[ -z "$nullmode" ]]; then
            echo "capsula: WARNING: failed to determine permissions of file \"$nullpath\" -- falling back to 0644" 1>&2
        fi
        nullfile=$(mktemp /tmp/capsula-null.XXXXXX)
        chmod "${nullmode:-0644}" "$nullfile"
        chown "$uid:$gid" "$nullfile"
        mount --bind "$nullfile" "$nullpath" \
            || fatal "failed to null-mount file \"$nullpath\""
        rm -f "$nullfile"
    else
        echo "capsula: WARNING: null-path \"$nullpath\" neither directory nor file -- skipping" 1>&2
    fi
done

#   provide hint about environment, platform distribution and platform architecture
ENVIRONMENT="capsula"; export ENVIRONMENT
PLATFORM_DISTRO="$distro"; export PLATFORM_DISTRO
PLATFORM_ARCH="$(uname -m)"; export PLATFORM_ARCH

#   enforce shell
SHELL="/bin/bash"; export SHELL

#   provide hint about user/group
USER="$usr";  export USER
GROUP="$grp"; export GROUP

#   determine list of environment variables to pass-through
preserve="ENVIRONMENT,PLATFORM_DISTRO,PLATFORM_ARCH,SHELL,USER,GROUP"
if [[ -n "$envvars" ]]; then
    preserve="$preserve,$(echo "$envvars" | sed -e 's; ;,;g')"
fi

#   provide same user/group as on host
if ! getent group "$grp" >/dev/null 2>&1; then
    if ! groupadd -f -g "$gid" "$grp"; then
        fatal "failed to create group \"$grp\" ($gid)"
    fi
elif [[ "$(getent group "$grp" | cut -d: -f3)" != "$gid" ]]; then
    grp_exists=$(getent group "$gid" 2>/dev/null | cut -d: -f1)
    if [[ -n "$grp_exists" ]]; then
        #   free up the target group id if it is occupied by an existing group
        gid_free=$(awk -F: '{ if ($3 > max) max = $3 } END { print max + 1 }' /etc/group)
        if ! groupmod -g "$gid_free" "$grp_exists"; then
            fatal "failed to move group \"$grp_exists\" to \"$gid_free\""
        fi
    fi
    if ! groupmod -g "$gid" "$grp"; then
        fatal "failed to modify group \"$grp\" ($gid)"
    fi
fi
if ! getent passwd "$usr" >/dev/null 2>&1; then
    usr_exists=$(getent passwd "$uid" 2>/dev/null | cut -d: -f1)
    if [[ -n "$usr_exists" ]]; then
        #   free up the target user id if it is occupied by an existing user
        uid_free=$(awk -F: '{ if ($3 > max) max = $3 } END { print max + 1 }' /etc/passwd)
        if ! usermod -u "$uid_free" "$usr_exists"; then
            fatal "failed to move user \"$usr_exists\" to \"$uid_free\""
        fi
    fi
    if [[ "$distro" == "alpine" ]]; then
        if ! useradd -M -d "$homedir" -s "$SHELL" -u "$uid" -g "$grp" "$usr" >/dev/null 2>&1; then
            fatal "failed to create user \"$usr\" ($uid)"
        fi
    else
        if ! useradd -M -d "$homedir" -s "$SHELL" -u "$uid" -g "$grp" "$usr"; then
            fatal "failed to create user \"$usr\" ($uid)"
        fi
    fi
elif [[ "$(getent passwd "$usr" | cut -d: -f3)" != "$uid" ]]; then
    usr_exists=$(getent passwd "$uid" 2>/dev/null | cut -d: -f1)
    if [[ -n "$usr_exists" ]]; then
        #   free up the target user id if it is occupied by an existing user
        uid_free=$(awk -F: '{ if ($3 > max) max = $3 } END { print max + 1 }' /etc/passwd)
        if ! usermod -u "$uid_free" "$usr_exists"; then
            fatal "failed to move user \"$usr_exists\" to \"$uid_free\""
        fi
    fi
    if ! usermod -u "$uid" "$usr"; then
        fatal "failed to modify user \"$usr\" ($uid)"
    fi
fi

#   allow user to switch to superuser
if [[ $sudo == "yes" ]]; then
    echo "$usr ALL=(ALL:ALL) NOPASSWD: ALL" >"/etc/sudoers.d/capsula"
    chmod 440 "/etc/sudoers.d/capsula"
else
    rm -f "/etc/sudoers.d/capsula"
fi

#   grant access to home directory
chown "$usr:$grp" "$homedir"

#   implicitly change current working directory
cd "$workdir" \
    || fatal "failed to change to working directory \"$workdir\""

#   pass-through execution
if [[ $# -eq 0 ]]; then
    #   enter an interactive shell
    exec sudo -n "--preserve-env=$preserve" -g "$grp" -u "$usr" "$SHELL" -i
else
    #   execute batch command
    cmd=""
    for arg in "$@"; do
        cmd="${cmd:+$cmd }$(printf '%q' "$arg")"
    done
    exec sudo -n "--preserve-env=$preserve" -g "$grp" -u "$usr" "$SHELL" -l -c "exec $cmd"
fi

