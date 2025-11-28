#!/bin/bash
##
##  Capsula -- Encapsulated Command Execution
##  Copyright (c) 2025 Dr. Ralf S. Engelschall <rse@engelschall.com>
##  Licensed under MIT <https://spdx.org/licenses/MIT>
##

#   take over parameters
platform="$1"; shift
hostname="$1"; shift
usr="$1";      shift
uid="$1";      shift
grp="$1";      shift
gid="$1";      shift
homedir="$1";  shift
workdir="$1";  shift
dotfiles="$1"; shift
envvars="$1";  shift
sudo="$1";     shift

#   implicitly change hostname
if [[ ! "$hostname" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "capsula: ERROR: invalid hostname format" 1>&2
    exit 1
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
    overlay /mnt/fs-root

#   remount standard system filesystems
mount --move /proc /mnt/fs-root/proc
mount --move /sys  /mnt/fs-root/sys
mount --move /dev  /mnt/fs-root/dev

#   remount standard Docker bind mounts
mount --move /etc/resolv.conf /mnt/fs-root/etc/resolv.conf
mount --move /etc/hostname    /mnt/fs-root/etc/hostname
mount --move /etc/hosts       /mnt/fs-root/etc/hosts

#   remount custom Docker bind mounts for run-command script
mount --move /etc/capsula-container /mnt/fs-root/etc/capsula-container

#   remount custom Docker bind mounts for dotfiles
mkdir -p "/mnt/fs-root$homedir"
for dotfile in $dotfiles; do
    ro="true"
    if [[ $dotfile =~ .*!$ ]]; then
        ro="false"
        dotfile="${dotfile%!}"
    fi
    if [[ -d "/mnt/fs-home$homedir/$dotfile" ]]; then
        mkdir -p "/mnt/fs-root$homedir/$dotfile"
    elif [[ -f "/mnt/fs-home$homedir/$dotfile" ]]; then
        mkdir -p $(dirname "/mnt/fs-root$homedir/$dotfile")
        touch "/mnt/fs-root$homedir/$dotfile"
    else
        echo "capsula: WARNING: dot-path \"$dotfile\" neither directory nor file" 1>&2
        continue
    fi
    mount --move "/mnt/fs-home$homedir/$dotfile" "/mnt/fs-root$homedir/$dotfile"
done

#   remount custom Docker bind mount for working directory
mkdir -p "/mnt/fs-root$workdir"
mount --move "/mnt/fs-work$workdir" "/mnt/fs-root$workdir"

#   switch root filesystem
mkdir -p /mnt/fs-root/fs-root-old
cd /mnt/fs-root
pivot_root . fs-root-old
umount -l /fs-root-old

#   provide hint about environment and platform
ENVIRONMENT="capsula"; export ENVIRONMENT
PLATFORM="$platform";  export PLATFORM

#   enforce shell
SHELL="/bin/bash"; export SHELL

#   provide hint about user/group
USER="$usr";  export USER
GROUP="$grp"; export GROUP

#   determine list of environment variables to pass-through
preserve="ENVIRONMENT,PLATFORM,SHELL,USER,GROUP,$(echo "$envvars" | sed -e 's; ;,;g')"

#   provide same user/group as on host
if ! getent group $grp >/dev/null 2>&1; then
    groupadd -f -g $gid $grp
fi
if ! getent passwd $usr >/dev/null 2>&1; then
    if [[ $platform == "alpine" ]]; then
        useradd -M -d $homedir -s $SHELL -u $uid -g $grp -G wheel $usr >/dev/null 2>&1
    elif [[ $platform == "debian" || $platform == "ubuntu" ]]; then
        useradd -M -d $homedir -s $SHELL -u $uid -g $grp -G sudo $usr
    elif [[ $platform == "alma" ]]; then
        useradd -M -d $homedir -s $SHELL -u $uid -g $grp -G wheel $usr
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
    exec sudo -n "--preserve-env=$preserve" -g "$grp" -u "$usr" $SHELL -i
else
    #   execute batch command
    exec sudo -n "--preserve-env=$preserve" -g "$grp" -u "$usr" "$@"
fi

