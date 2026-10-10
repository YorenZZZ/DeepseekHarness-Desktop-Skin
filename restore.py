#!/usr/bin/env python3
"""Check/repair the external animation plugin without modifying the signed App."""
from pathlib import Path
import argparse,hashlib,json,os,plistlib,shutil,tempfile,zipfile

NAME='@yoren/dsh-animations'
def run(root,profile,repair=False):
    manifest=json.loads((root/'recovery-manifest.json').read_text())
    archive=root/'plugin-recovery.zip'
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=manifest['archive_sha256']:
        raise RuntimeError('Recovery archive checksum mismatch; refusing repair')
    issues=[];changes=[]
    live=root/'plugin'
    with zipfile.ZipFile(archive) as z:
        for rel,digest in manifest['files'].items():
            if Path(rel).is_absolute() or '..' in Path(rel).parts:raise RuntimeError('Invalid recovery path')
            if hashlib.sha256(z.read(rel)).hexdigest()!=digest:raise RuntimeError('Invalid recovery member '+rel)
            path=live/rel
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
                issues.append('plugin/'+rel)
                if repair:
                    if path.is_symlink():raise RuntimeError('Refusing to write through modified file symlink')
                    path.parent.mkdir(parents=True,exist_ok=True)
                    temp=path.with_name(path.name+'.restore-tmp');temp.write_bytes(z.read(rel));temp.replace(path)
                    changes.append('restored '+rel)
    project=profile/'package.json'
    if not project.exists():
        issues.append('desktop profile not initialized')
        return {'ok':False,'issues':issues,'changes':changes,'action':'Open the official desktop App once, then rerun --repair.'}
    current=json.loads(project.read_text())
    dependency='file:'+str(live)
    bundles=current.get('dsh',{}).get('profile',{}).get('bundles',[])
    needs_manifest=current.get('dependencies',{}).get(NAME)!=dependency or NAME not in bundles
    if needs_manifest:issues.append('desktop profile package registration')
    link=profile/'node_modules/@yoren/dsh-animations'
    good_link=link.is_symlink() and link.resolve()==live.resolve()
    if not good_link:issues.append('desktop profile module link')
    if repair and (needs_manifest or not good_link):
        lock=profile/'lock'
        try:fd=os.open(lock,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        except FileExistsError:raise RuntimeError('Desktop profile is busy; retry later')
        try:
            os.write(fd,str(os.getpid()).encode());os.close(fd)
            current=json.loads(project.read_text())
            if needs_manifest:
                before=profile/'package.json.before-yoren-animations'
                if not before.exists():shutil.copy2(project,before)
                current.setdefault('dependencies',{})[NAME]=dependency
                bundles=current.setdefault('dsh',{}).setdefault('profile',{}).setdefault('bundles',[])
                if NAME not in bundles:bundles.append(NAME)
                temp=project.with_name('package.json.animation-tmp')
                temp.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n');temp.chmod(project.stat().st_mode&0o777);temp.replace(project)
                changes.append('registered external bundle')
            if not good_link:
                link.parent.mkdir(parents=True,exist_ok=True)
                if link.is_symlink():link.unlink()
                elif link.exists():
                    saved=root/'replaced-plugin-install'
                    if saved.exists():raise RuntimeError('Previous package backup exists; inspect before replacing')
                    shutil.move(str(link),saved)
                link.symlink_to(live,target_is_directory=True);changes.append('restored module link')
        finally:lock.unlink(missing_ok=True)
    app=Path('/Applications/DeepSeek Harness.app/Contents/Info.plist')
    version=None
    if app.exists():
        value=plistlib.loads(app.read_bytes());version=value.get('CFBundleShortVersionString')
    health=root/'health.json'
    result={'ok':not issues or repair,'app_version':version,'issues':issues,'changes':changes,
      'restart_needed':bool(changes),'runtime':json.loads(health.read_text()) if health.exists() else None}
    if repair:
        (root/'last-repair.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(__file__).resolve().parent)
    p.add_argument('--profile',type=Path,default=Path.home()/'.dsh/profiles/desktop')
    p.add_argument('--repair',action='store_true')
    a=p.parse_args();result=run(a.root.resolve(),a.profile.resolve(),a.repair)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if result['ok'] else 2)
