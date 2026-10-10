#!/usr/bin/env python3
"""安装或更新 DeepSeek Harness 桌面版皮肤（macOS）。

把仓库中的 plugin/ 打包成安装目录里的修复源（plugin-recovery.zip 与
recovery-manifest.json），再由 restore.py 放好插件文件，并在 Desktop profile
中注册。不修改官方 App，不创建定时任务、LaunchAgent 或后台进程。
"""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess,sys,zipfile

here=Path(__file__).resolve().parent
plugin=here/'plugin'
root=Path.home()/'Library/Application Support/DeepSeekAnimations'
profile=Path.home()/'.dsh/profiles/desktop'
skip={'.DS_Store'}

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def replace(target,write):
    temporary=target.with_name(target.name+'.install-tmp')
    write(temporary);temporary.replace(target)

def main():
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--name',help='入场问候语里的称呼，最多显示 8 个字；传空字符串取消称呼。不传则保留现有设置。')
    args=parser.parse_args()
    if sys.platform!='darwin':raise SystemExit('本皮肤只支持 macOS 版 DeepSeek Harness。')
    if not (plugin/'index.mjs').is_file():raise SystemExit('找不到 plugin/，请在完整的仓库目录中运行。')
    if not (profile/'package.json').is_file():raise SystemExit('请先打开官方 DeepSeek Harness 桌面版并完成初次设置，再运行本脚本。')
    files=sorted(path for path in plugin.rglob('*') if path.is_file() and path.name not in skip)
    rels=[path.relative_to(plugin).as_posix() for path in files]
    root.mkdir(parents=True,exist_ok=True)
    archive=root/'plugin-recovery.zip'
    def pack(target):
        with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as bundle:
            for rel,path in zip(rels,files):bundle.write(path,rel)
    replace(archive,pack)
    manifest={'archive_sha256':sha(archive),'files':{rel:sha(path) for rel,path in zip(rels,files)}}
    replace(root/'recovery-manifest.json',lambda target:target.write_text(json.dumps(manifest,indent=2)+'\n'))
    for name in ['restore.py','README.md']:
        replace(root/name,lambda target,name=name:shutil.copy2(here/name,target))
    if args.name is not None:
        config=root/'config.json'
        try:current=json.loads(config.read_text())
        except (OSError,ValueError):current={}
        if not isinstance(current,dict):current={}
        if args.name.strip():current['name']=args.name.strip()
        else:current.pop('name',None)
        replace(config,lambda target:target.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n'))
    subprocess.run([sys.executable,str(root/'restore.py'),'--repair'],check=True)
    subprocess.run([sys.executable,str(root/'restore.py')],check=True)
    print('\n皮肤已安装。请在方便时退出并重新打开 DeepSeek Harness。')
    print('本脚本没有修改官方 App，也没有创建定时任务或后台进程。')

if __name__=='__main__':
    main()
