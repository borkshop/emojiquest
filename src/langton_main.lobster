// Langton's Ents is a demonstration of a cellular automaton modelling
// multiple agents moving on a square tesselated world.

import color
import vec
import std
import langton
import topology
import sprites
import sheets
import brand
import tessel_square_topology

fatal(gl_window("Langton\'s Ents", 512, 512, 0))

let sheet_sprites = load_sheet_sprites()

let tex = sheet_sprites.get_texture(tile_sprite_id[tile_pine_tree])
assert tex

// center_unit_square projects a unit square coordinate system over
// the center of the window, regardless of its aspect ratio.
def center_unit_square():
    let size = float(gl_window_size())
    let scale = xy_1 * min(size)
    gl_translate((size - scale) / 2)
    gl_scale(scale)

do():
    let hz = 4
    let size = 16
    let count = 4
    let rules = [1, -1, 0]
    let neighborhoods, turns = new_tessel_square_topology(size)
    let w = langton_new_world(neighborhoods, turns, count, rules)
    let first_rule_color = dark_brown
    let last_rule_color = dark_green
    let v = langton_new_square_view(size, neighborhoods, turns, first_rule_color, last_rule_color)

    w.tick()
    var start = gl_time()
    def next():
        let now = gl_time()
        let tween = (now - start) * hz
        if tween < 1.0:
            return tween
        start = now
        w.tick()
        return 0.0

    while gl_frame() and gl_button("escape") != -1:
        let tween = next()
        gl_clear(first_rule_color)
        center_unit_square()
        v.draw(w, 0, tween, tex)
