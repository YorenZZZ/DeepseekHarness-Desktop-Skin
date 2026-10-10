# 更新记录

## 1.0.0 — 2026-10-10

- 首个版本：入场动画和首页骑士背景以外部插件形式接入官方 DeepSeek Harness 桌面版，不修改官方 App。
- `install.py` 从仓库的 `plugin/` 打包修复源并注册插件；`restore.py` 检查和修复插件文件与注册。只手动运行，不创建定时任务或后台进程。
- 已在官方 0.2.0-rc.2 上验证：插件事件 client-ready、hero-mounted、splash-playing、hero-playing、splash-dismissed 都出现过，官方 App 的签名校验通过。
