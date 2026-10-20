# Build the browser edition

The upstream source layout is preserved. Tested engine files are listed in
`browser/verified-source-manifest.json`; wrapper/host bridge: `browser/web/`.

Requirements: Python 3.12+, Node.js 22+, Emscripten **4.0.23** from
[emsdk](https://github.com/emscripten-core/emsdk). Set `EMSDK` to the SDK root.
`JNB_NODE` is optional when Node is on PATH. No proprietary executable, website
credentials, or other repository is required.

```sh
export EMSDK=/path/to/emsdk
python3 browser/build-web.py
python3 -m http.server 8090 --directory build/web
```

PowerShell:

```powershell
$env:EMSDK = 'C:/path/to/emsdk'
$env:JNB_NODE = 'C:/path/to/node.exe'
python browser/build-web.py
python -m http.server 8090 --directory build/web
```

Open <http://localhost:8090/>; `?lang=zh-cn` selects Chinese. First build fetches
Emscripten ports: SDL2 2.32.8, SDL2_mixer 2.8.0 and libmodplug v11022021; notices
are in `browser/licenses/`. Original gobpack/jnbpack pack the 18 data files.
All generated files remain under the ignored `build/` directory.

The public recipe differs from deployment only in source/wrapper locations and
explicit toolchain configuration. Absolute preload/assert paths can differ, so
byte-identical JS/WASM across checkouts is not claimed. Source/data bytes are
checked against the manifest.

## Verification and limits

After installing the test packages and a Playwright browser:

```sh
npm --prefix browser install
npm --prefix browser exec -- playwright install chromium
node browser/accept-web.mjs local-check
```

This script serves `build/web`, writes evidence under `build/test-evidence`,
tests the real game and closes its own browser/server. Set
`JNB_TEST_BROWSER_CHANNEL=chrome` to use an existing Chrome installation.

The deployed build passed four separate keyboard groups, simultaneous touch
move/jump and release, solo natural AI scoring, visible original score table,
local two-player entry, pause/resume, cross-window message rejection and audio
disposal in Chrome. English/Chinese navigation, 320/390 px layouts and landscape
fullscreen passed. Tests use `--mute-audio` and close their browser. This is not
physical Android/iOS or audible sound testing.

The exact deployed source archive is linked in README. `COPYING` and `AUTHORS`
are unchanged; retain them and provide corresponding source when redistributing.
The upstream Makefile is preserved. This branch's tested browser entry point is
`browser/build-web.py`; native platforms have not been requalified for every
browser integration change.
