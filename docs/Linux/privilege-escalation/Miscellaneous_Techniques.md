# Miscellaneous Techniques
## Shared Object Hijacking - RUNPATH
- `readelf -d /path/to/binary | grep PATH`

## Weak NFS Privileges (no_root_squash)
- `mount -o rw,vers=3 target-ip:/shared_folder /tmp/mounted_nfs`

## Python Library Hijacking
- `sudo PYTHONPATH=/tmp /usr/bin/python3 -c "import random"`