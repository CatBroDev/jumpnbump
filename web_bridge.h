/* Optional browser integration, Old Games Archive, 2026.
 * GPL-2.0-or-later, like the original Jump 'n Bump engine. */
#ifndef OGA_WEB_BRIDGE_H
#define OGA_WEB_BRIDGE_H
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
extern int oga_scene, oga_paused, oga_muted, oga_solo_request;
extern unsigned int oga_ticks;
extern int oga_stop_requested;
void oga_release_all(void);
#endif
#endif
