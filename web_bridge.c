/* Browser controls for the existing SDL game, Old Games Archive, 2026.
 * GPL-2.0-or-later. AI, physics, level and scoring belong to upstream. */
#include "globals.h"
#include "web_bridge.h"
#ifdef __EMSCRIPTEN__
int oga_scene = 0, oga_paused = 0, oga_muted = 1, oga_solo_request = 0;
unsigned int oga_ticks = 0;
int oga_stop_requested = 0;
extern char keyb[SDL_NUM_SCANCODES];

EMSCRIPTEN_KEEPALIVE void oga_release_all(void)
{
    memset(keyb, 0, SDL_NUM_SCANCODES);
    SDL_FlushEvents(SDL_KEYDOWN, SDL_KEYUP);
}

EMSCRIPTEN_KEEPALIVE void oga_key(int scancode, int down)
{
    if (oga_paused || oga_scene == 4 || scancode <= 0 || scancode >= SDL_NUM_SCANCODES)
        return;
    /* Escape is the original engine's legacy exit/score key. */
    if (scancode == SDL_SCANCODE_ESCAPE) scancode = 1;
    addkey((unsigned int)scancode | (down ? 0 : 0x8000));
}

EMSCRIPTEN_KEEPALIVE int oga_key_held(int scancode)
{
    return key_pressed(scancode);
}

EMSCRIPTEN_KEEPALIVE void oga_pause(int paused)
{
    oga_release_all();
    oga_paused = !!paused;
}

EMSCRIPTEN_KEEPALIVE void oga_mute(int muted) { oga_muted = !!muted; }

/* Exit from the running loop, not reentrantly while Asyncify is suspended. */
EMSCRIPTEN_KEEPALIVE void oga_stop(void)
{
    oga_release_all(); oga_muted = 1; oga_paused = 0; oga_stop_requested = 1;
}

/* A normal menu action: choose Dott plus three existing AI opponents.
 * Level initialization, collisions and results still run in the original code. */
EMSCRIPTEN_KEEPALIVE int oga_start_solo(void)
{
    if (oga_scene != 1 || oga_paused) return 0;
    oga_release_all();
    oga_solo_request = 1;
    oga_scene = 0;
    return 1;
}

/* Read-only acceptance evidence; there is no score/position setter. */
EMSCRIPTEN_KEEPALIVE const char *oga_state(void)
{
    static char output[2048];
    int i, n = snprintf(output, sizeof(output),
        "{\"scene\":%d,\"paused\":%d,\"muted\":%d,\"ticks\":%u,\"players\":[",
        oga_scene, oga_paused, oga_muted, oga_ticks);
    for (i = 0; i < JNB_MAX_PLAYERS; i++)
        n += snprintf(output + n, sizeof(output) - n,
            "%s{\"enabled\":%d,\"ai\":%d,\"x\":%d,\"y\":%d,\"score\":%d,\"dead\":%d}",
            i ? "," : "", player[i].enabled, ai[i], player[i].x >> 16,
            player[i].y >> 16, player[i].bumps, player[i].dead_flag);
    snprintf(output + n, sizeof(output) - n, "]}");
    return output;
}
#endif
