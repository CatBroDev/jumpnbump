"""Build the attributed SDL source using the existing Emscripten toolchain.

No prebuilt DOS executables or third-party game assets are used. The original
gobpack and jnbpack programs build the data archive from this source release.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys

LAB = Path(__file__).resolve().parents[1]
if not os.environ.get('EMSDK'):
    raise SystemExit('Set EMSDK to an Emscripten 4.0.23 SDK installation.')
SDK = Path(os.environ['EMSDK'])
EMCC = SDK / 'upstream/emscripten/emcc.py'
node_path = os.environ.get('JNB_NODE') or shutil.which('node')
if not node_path: raise SystemExit('Install Node.js or set JNB_NODE.')
NODE = Path(node_path)
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='build/web')
parser.add_argument('--source', default='.')
args = parser.parse_args()
source = LAB / args.source
out = LAB / args.output
out.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, EM_CONFIG=str(SDK / '.emscripten'),
           EMSDK_PYTHON=sys.executable, EMCC_CORES='4')
temporary = LAB / 'build/tmp'
temporary.mkdir(parents=True, exist_ok=True)
env.update(TEMP=str(temporary), TMP=str(temporary), EMCC_TEMP_DIR=str(temporary))

def run(command, cwd=source):
    subprocess.run([str(x) for x in command], cwd=cwd, env=env, check=True)

generated = LAB / 'build/generated'
generated.mkdir(parents=True, exist_ok=True)
(generated / 'globals.h').write_text(
    (source / 'globals.pre').read_text(encoding='utf-8').replace('%%DATADIR%%', 'assets'), encoding='utf-8')
packed = LAB / 'build/packed'
packed.mkdir(parents=True, exist_ok=True)
for f in (source / 'data').iterdir():
    if f.is_file():
        shutil.copy2(f, packed / f.name)
for tool in ['gobpack', 'jnbpack']:
    target = generated / f'{tool}.js'
    if not target.exists():
        run([sys.executable, EMCC, source / f'modify/{tool}.c', '-O2',
             '-sNODERAWFS=1', '-sENVIRONMENT=node', '-o', target])
for stem in ['font', 'numbers', 'objects', 'rabbit']:
    run([NODE, generated / 'gobpack.js', stem], packed)
files = 'bump.mod calib.dat death.smp fly.smp jump.mod jump.smp levelmap.txt level.pcx mask.pcx menu.pcx menumask.pcx font.gob numbers.gob objects.gob rabbit.gob scores.mod splash.smp spring.smp'.split()
run([NODE, generated / 'jnbpack.js', '-o', 'jumpbump.dat', *files], packed)
assets = generated / 'assets'
assets.mkdir(exist_ok=True)
shutil.copy2(packed / 'jumpbump.dat', assets / 'jumpbump.dat')
sources = ['main.c', 'menu.c', 'filter.c', 'network.c', 'sdl/gfx.c',
           'sdl/interrpt.c', 'sdl/sound.c', 'sdl/input.c']
if (source / 'web_bridge.c').exists():
    sources.append('web_bridge.c')
command = [sys.executable, EMCC, *[source / f for f in sources],
           '-I' + str(generated), '-I' + str(source), '-O2', '-std=gnu99',
           '-Dstricmp=strcasecmp', '-Dstrnicmp=strncasecmp', '-DUSE_SDL',
           '-sUSE_SDL=2', '-sUSE_SDL_MIXER=2', '-sSDL2_MIXER_FORMATS=["mod"]',
           '-sASYNCIFY', '-sALLOW_MEMORY_GROWTH=1', '-sENVIRONMENT=web', '-sEXIT_RUNTIME=1',
           '-sASSERTIONS=1', '--preload-file', str(assets) + '@/assets',
           '-sEXPORTED_RUNTIME_METHODS=["UTF8ToString"]',
           '-o', out / 'index.html']
shell = LAB / 'browser/web/shell.html'
if shell.exists():
    command += ['--shell-file', shell]
run(command)
if (LAB / 'browser/web/bridge.js').exists():
    shutil.copy2(LAB / 'browser/web/bridge.js', out / 'bridge.js')
report = {f.name: {'bytes': f.stat().st_size, 'sha256': hashlib.sha256(f.read_bytes()).hexdigest()}
          for f in out.iterdir() if f.is_file() and f.name != 'build-manifest.json'}
(out / 'build-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'output': str(out), 'files': report}, indent=2))
