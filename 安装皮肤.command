#!/bin/zsh
set -euo pipefail
cd -- "$(dirname -- "$0")"
python3 install.py
printf '\n按回车关闭此窗口。'
read -r
