import color
import vec

import sprites
import sheets // TODO invert ecs -> sheets dep

def build_string(body):
    var s = ""
    body() part:
        if s.length():
            s = s + " " + part
        else:
            s = s + part
    return s

def color_to_hex(c:color) -> string: return "#" +
    number_to_string(int(c.red   * 255), 16, 2) +
    number_to_string(int(c.green * 255), 16, 2) +
    number_to_string(int(c.blue  * 255), 16, 2) +
    number_to_string(int(c.alpha * 255), 16, 2)

def first_index(xs, x):
    for(xs) _, i: if _ == x:
        return i
    return -1

def while_first_index(xs, x, body):
    forever():
        let i = xs.first_index(x)
        if i < 0:
            return
        body(i)

//// entity

enum_flags entype:
    ent_none = 0    // free entity slot (if no other bits)
    ent_debug = 1   // enable debug logging on this entity
    ent_visible     // scene draw-ables
    ent_cascade     // destroy this entity along with its parent
    ent_cell        // defines "A space"; e.g. floor entities have this
    ent_body        // has a collide-able body
    ent_mind        // participates in the action system
    ent_input       // receives player input
    ent_holds       // can contain other entities (up to cap)
    ent_acts        // used to act upon the world

def entype_str(t:entype):
    let parts = []
    if t & ent_debug:   parts.push("debug")
    if t & ent_visible: parts.push("visible")
    if t & ent_cascade: parts.push("cascade")
    if t & ent_cell:    parts.push("cell")
    if t & ent_body:    parts.push("body")
    if t & ent_mind:    parts.push("mind")
    if t & ent_input:   parts.push("input")
    if t & ent_holds:  parts.push("holds")
    if t & ent_acts:  parts.push("acts")
    return parts.concat_string("|")

enum entrel:
    entrel_shrug
    entrel_held
    // entrel_worn TODO equipment
    // entrel_attached TODO upgrades?
    entrel_body
    entrel_status

def entrel_str(r:entrel):
    switch r:
        case entrel_shrug:  return "shrug"
        case entrel_held:   return "held"
        case entrel_body:   return "body"
        case entrel_status: return "status"
    return "unknown<" + r + ">"

//// systems

class system:
    def ent_changed(shard, id:int, new:entype, old:entype):
        return new

    def ent_linked(shard, id:int, pid:int, ex_pid:int):
        nil

//// toplevel components

struct spatial : xyzw_f
    // x, y are location   : integer part is the cell, fraction part is sub-cell offset
    // z is stacking order : drawn back-to-front, lowest z first
    // w is the size       : in terms of a cell-sized unit, so 1.0 is usual, 0.5 is half-cell

    def cell():
        return xy_i { int(x), int(y) }

    def cell_rel(off:xyz_f, size:float):
        return spatial { int(x) + off.x, int(y) + off.y, z + off.z, size }

let spatial_0 = spatial { 0, 0, 0, 0 }

let glyph_atlases = []::texture_atlas

def font_string(mode:int, s:string) -> int:
    return glyph_atlases[mode].symbolicate(s)

def font_rune(mode:int, code:int) -> int:
    return glyph_atlases[mode].symbolicate(unicode_to_string([code]))

def add_glyph_tile_atlas(atlas:texture_atlas):
    let atlas_id = glyph_atlases.length()
    glyph_atlases.push(atlas)
    return atlas_id

def add_glyph_font_atlas(font_name:string, res:xy_i, stretch:bool):
    return add_glyph_tile_atlas(text_atlas { res, stretch, font_name })

struct glyph:
    mode : int
    code : int

    def get_texture():
        return glyph_atlases[mode].get_texture(code)

let glyph_0 = glyph { 0, 0 }

struct render:
    bg   : color
    fg   : color
    glyf : glyph

    def draw():
        if bg != color_clear:
            gl_set_shader("color")
            gl_color(bg): gl_unit_square()
        if glyf.code != 0:
            gl_set_shader("textured")
            gl_set_primitive_texture(0, glyf.get_texture())
            gl_color(fg): gl_unit_square()

    def with_fg_color(c:color, g:glyph):
        if g != glyph_0 and c == color_clear: c = color_white
        return render { bg, c, g }
    def with_fg(c:color): return with_fg_color(c, glyf)
    def with_glyph(g:glyph): return with_fg_color(fg, g)

let render_0 = render { color_clear, color_clear, glyph_0 }

//// entity allocation arenas ( shards )

class shard:
    // entity type
    type = []::entype
    name = []::string

    // id-linked graph structure
    par   = []::int    // id of parent
    rel   = []::entrel // relation to parent
    next  = []::int    // id of next sibling
    prev  = []::int    // id of previous sibling
    first = []::int    // id of first child

    // global data relevant to any entity
    pos = []::spatial   // outer spatial position and size
    cap = []::xy_f      // inner spatial capacity
    ren = []::render    // colored glyph with an optional background
    tex = []::resource? // render texture overrides any glyph
    ksh = []::resource? // cached render to texture
    // TODO drop tex aspect, once we switch fully to graph-structured drawing into ksh

    systems = []::system

    free_ids = []::int

    def tag(id:int) -> string:
        if name[id] != "":
            return "[" + name[id] + "]#" + id
        else:
            return "#" + id

    def describe(id:int) -> string:
        return build_string() emit:
            emit(tag(id))
            describe_intrinsics(id, emit)
            describe_draw(id, emit)
            describe_graph(id, emit)

    def describe_intrinsics(id, emit):
        emit(entype_str(type[id]))
        emit("@<" + pos[id].x + ", " + pos[id].y + ">")
        emit("z:" + pos[id].z)
        if pos[id].w: emit("size:" + pos[id].w)

    def describe_draw(id, emit):
        if ren[id].bg != color_clear: emit("bg:" + color_to_hex(ren[id].bg))
        if ren[id].glyf != glyph_0:
            emit("fg:" + color_to_hex(ren[id].fg))
            emit("" + ren[id].glyf)
        if tex[id]: emit("tex:" + tex[id])
        if ksh[id]: emit("ksh:" + ksh[id])

    def describe_graph(id, emit):
        if cap[id] != xy_0: emit("cap:" + cap[id])
        if par[id]:
            emit("par" + tag(par[id]))
            emit("rel:" + rel[id])
        if prev[id]: emit("prev" + tag(prev[id]))
        if next[id]: emit("next" + tag(next[id]))
        if first[id]: emit("first" + tag(first[id]))

    def alloc() -> int:
        def grow():
            let id = type.length
            type.push(ent_none)
            name.push("")
            par.push(0)
            rel.push(entrel_shrug)
            next.push(0)
            prev.push(0)
            first.push(0)
            pos.push(spatial_0)
            cap.push(xy_0)
            ren.push(render_0)
            tex.push(nil)
            ksh.push(nil)
            return id
        def reuse():
            let id = free_ids.remove_obj(free_ids.min())
            type[id] = ent_none
            name[id] = ""
            par[id] = 0
            rel[id] = entrel_shrug
            next[id] = 0
            prev[id] = 0
            first[id] = 0
            pos[id] = spatial_0
            cap[id] = xy_0
            ren[id] = render_0
            tex[id] = nil
            ksh[id] = nil
            return id
        if not type.length: grow() // reserve #0
        return if free_ids.length: reuse() else: grow()

    def add_child(pid:int, r:entrel, cid:int):
        assert pid and cid
        unlink(cid)
        link_after(pid, r, cid, 0)

    def add_sibling(sid:int, r:entrel, cid:int):
        assert sid and cid
        let pid = par[sid]
        assert pid
        unlink(cid)
        link_after(pid, r, cid, sid)

    def link_after(pid:int, r:entrel, cid:int, sid:int):
        let fid = first[pid]
        let ex_pid = par[cid]
        if fid:
            if not sid: sid = prev[fid]
            assert par[sid] == pid
            let nid = next[sid]
            // [sid] <=> [cid] <=> [nid]
            par[cid] = pid
            rel[cid] = r
            next[cid] = nid
            prev[cid] = sid
            next[sid] = cid
            prev[nid] = cid
        else:
            assert not sid
            // [cid] <=> [cid]
            par[cid] = pid
            rel[cid] = r
            next[cid] = cid
            prev[cid] = cid
            first[pid] = cid
        notify_par(cid, pid, ex_pid)

    def link_before(pid:int, r:entrel, cid:int, sid:int):
        let fid = first[pid]
        let ex_pid = par[cid]
        if fid:
            if not sid: sid = fid
            assert par[sid] == pid
            let rid = prev[sid]
            // [rid] <=> [cid] <=> [sid]
            par[cid] = pid
            rel[cid] = r
            next[cid] = sid
            prev[cid] = rid
            next[rid] = cid
            prev[sid] = cid
        else:
            assert not sid
            // [cid] <=> [cid]
            par[cid] = pid
            rel[cid] = r
            next[cid] = cid
            prev[cid] = cid
            first[pid] = cid
        notify_par(cid, pid, ex_pid)

    def unlink(id:int):
        let pid = par[id]
        if pid:
            let fid = first[pid]
            var sid = next[id]
            var rid = prev[id]
            if sid == id: sid = 0
            if rid == id: rid = 0
            par[id] = 0
            rel[id] = entrel_shrug
            next[id] = 0
            prev[id] = 0
            next[rid] = sid
            prev[sid] = rid
            if fid == id: first[pid] = sid
            notify_par(id, 0, pid)

    def unlink_children(id:int, body):
        let cids = collect(): walk_next(first[id], _)
        first[id] = 0
        if cids.length:
            for(cids): par[_] = 0
            for(cids): rel[_] = entrel_shrug
            for(cids): next[_] = 0
            for(cids): prev[_] = 0
            for(cids): notify_par(_, 0, id)
            body(cids)

    def root_of(id:int):
        let fid = id
        while(id):
            let pid = par[id]
            if not pid or pid == id or pid == fid: return id
            id = pid
        return 0

    def walk_par(id:int, body):
        let fid = id
        while(id):
            let nid = par[id]
            if not nid or nid == id or nid == fid: return
            body(id = nid)

    def walk_next(id:int, body):
        let fid = id
        while(id):
            body(id)
            let nid = next[id]
            if nid == fid: return
            id = nid

    def walk_rec(id:int, body):
        def rec(nid:int, depth:int):
            body(nid, depth):
                let nd = depth + 1
                walk_next(first[nid]): rec(_, nd)
        rec(id, 0)

    def create(t:entype, init):
        let id = alloc()
        type[id] = t
        init(id)
        notify_type(id, ent_none, t)
        return id

    def set_type(id:int, t:entype):
        let old = type[id]
        if old == t: return
        if t == ent_none: destroy(id) else:
            type[id] = t
            notify_type(id, old, t)

    def destroy(id:int):
        // unlink any cascaded children, building a list of gone ids for later reclamation
        let gone = collect() que:
            def rec(nid):
                que(nid)
                // this is unlink_children, sans notify_par...
                let cids = collect(): walk_next(first[nid], _)
                first[nid] = 0
                if cids.length:
                    for(cids): par[_] = 0
                    for(cids): rel[_] = entrel_shrug
                    for(cids): next[_] = 0
                    for(cids): prev[_] = 0
                    // for(cids): notify_par(_, 0, nid) ... assumed redundant with notify_type below
                    let descend = cids.filter(): type[_] & ent_cascade
                    for(descend) cid: rec(cid)
            rec(id)
        // finally unlink the subject id...
        unlink(id)
        // ...then reclaim it and any cascaded children
        let old_types = map(gone): type[_]
        for(gone): type[_] = ent_none
        for(gone) gid, i: notify_type(gid, old_types[i], ent_none)
        for(gone): free_ids.push(_)

    def add_type(id:int, t:entype): set_type(id, type[id] |  t)
    def del_type(id:int, t:entype): set_type(id, type[id] & ~t)

    def notify_type(id:int, old:entype, new:entype) -> entype:
        invalidate(id)
        for(systems):
            let prior = new
            new = _.ent_changed(this, id, new, old)
            if new != prior:
                type[id] = new
        return new

    def notify_par(id:int, pid:int, ex_pid:int):
        invalidate(id)
        if ex_pid: invalidate(ex_pid)
        for(systems):
            _.ent_linked(this, id, pid, ex_pid)

    def invalidate(id:int):
        ksh[id] = nil
        walk_par(id) pid: ksh[pid] = nil

//// ancillary component: spatial animation

enum_flags anim_flags:
    anim_base  = 0
    anim_block = 1
    anim_keep
    anim_loop

class anims : system
    blocked = false
    ids     = []::int
    flags   = []::anim_flags
    time    = []::float
    elapsed = []::float
    as      = []::spatial
    bs      = []::spatial
    // TODO size animation
    // TODO animation of other spatial attributes as added, e.g. heading or other transforms

    def drop(live, dead): if dead.length:
        ids     = map(live): ids[_]
        flags   = map(live): flags[_]
        blocked = flags.fold(false): if (_a | _b) & anim_block: true else: false
        time    = map(live): time[_]
        elapsed = map(live): elapsed[_]
        as      = map(live): as[_]
        bs      = map(live): bs[_]

    def update(shard:shard, update_dt:float):
        let left = map(shard.type.length()): update_dt

        let resets = []::int

        // TODO maybe decompose loop into stages
        for(ids) id, anim_id:
            def anims_advance(dt):
                if dt <= 0:
                    return 0.0

                let prior = elapsed[anim_id]
                let total = time[anim_id]
                if prior >= total:
                    return dt

                let t = clamp(prior + dt, 0, total)
                let spent = t - prior

                let f = t / total
                let a = as[anim_id]
                let b = bs[anim_id]
                shard.pos[id] = lerp(a, b, f)

                if t >= total and flags[anim_id] & anim_loop:
                    resets.push(id)

                elapsed[anim_id] = t
                return dt - spent
            left[id] = anims_advance(left[id])

        // prune all expired animations (that aren't flagged to keep)
        let live, dead = elapsed.partition_indices() t, anim_id:
            t < time[anim_id] || flags[anim_id] & anim_keep

        // reset all looped animations
        if resets.length:
            for(ids) id, anim_id:
                if resets.first_index(id) >= 0:
                    elapsed[anim_id] = 0

        this.drop(live, dead)

    def has_any(id):
        let anim_id = ids.first_index(id)
        return anim_id >= 0

    def clear(shard:shard, id):
        let prior, rest = ids.partition_indices(): _ == id
        if prior.length:
            let anim_id = prior[prior.length - 1]
            shard.pos[id] = bs[anim_id]
        this.drop(rest, prior)

    def add(
        id : int,
        f  : anim_flags,
        t  : float,
        a  : spatial,
        b  : spatial
    ): if a == b: return -1 else:
        let anim_id = ids.length()
        ids.push(id)
        flags.push(f)
        time.push(t)
        elapsed.push(0)
        as.push(a)
        bs.push(b)
        blocked = blocked || f & anim_block
        return anim_id

class anim_scaffold:
    anims : anims
    id    : int
    time  : float

    looped   = false
    blocking = false
    pos      = spatial_0
    last_t   = 0.0

    q_pos   = []::spatial
    q_flags = []::anim_flags
    q_time  = []::float

    def clear(shard): anims.clear(shard, id)
    def has_any(): return anims.has_any(id)

    def with(body):
        if last_t > 0:
            last_t  = 0.0
            q_pos   = []
            q_flags = []
            q_time  = []
        body(this)
        if last_t > 0:
            var a = spatial_0
            for(q_pos) b, i:
                if i > 0:
                    var f = q_flags[i]
                    if looped:
                        f = f | anim_keep
                        if i == q_pos.length - 1:
                            f = f | anim_loop
                    let t = q_time[i] / last_t * time
                    anims.add(id, f, t, a, b)
                a = b

    def after(t:float, body):
        let prior_t = last_t
        if q_pos.length > 0:
            last_t += t
        body(this)
        q_pos.push(pos)
        q_flags.push(if blocking: anim_block else: anim_base)
        q_time.push(last_t - prior_t)

def animate(this::anims, id:int, over:float, body):
    anim_scaffold {
        anims: this,
        id:    id,
        time:  over,
    }.with(body)

//// ancillary component: root bodys collide

class bodys : system
    ids:[int] = []

    def enter(id):
        ids.push(id)

    def exit(id): while_first_index(ids, id) body_id:
        ids.remove(body_id, 1)

    def ent_changed(shard, id:int, new:entype, old:entype):
        if shard.par[id] == 0 and  (old ^ new) & ent_body:
            if       new & ent_body: this.enter(id)
            else: if old & ent_body: this.exit(id)
        return new

    def ent_linked(shard, id:int, pid:int, ex_pid:int):
        if pid == 0:
            if shard.type[id] & ent_body: this.enter(id)
        else: if ex_pid == 0:
            if shard.type[id] & ent_body: this.exit(id)

//// ancillary component: minds take action

enum_flags actiontype:
    action_none = 0
    action_move = 1
    action_hand_drop
    action_hand_swap
    action_hand_use
    action_hand_combine

struct action:
    act:actiontype
    dir:xy_f

    def target(p:spatial):
        var l = p.xy
        if act & action_move:
            l += dir
        return int(l)

let action_0 = action { action_none, xy_0 }

def move_dir(d:xy_f):   return action { action_move, d }
def act(at:actiontype): return action { at, xy_0 }

def input_fun() -> action

class mind:
    // TODO partial information sensed in, rather than direct world access
    id    : int
    state : int = 0

    def think():
        let m = state % 2
        let d = state / 2
        let x = m ^ d
        state = ++state % 4
        return if x & d: move_dir(xy {  0.0,  1.0 }) // down
        else: if  x & m: move_dir(xy {  1.0,  0.0 }) // right
        else: if  d:     move_dir(xy { -1.0,  0.0 }) // left
        else:            move_dir(xy {  0.0, -1.0 }) // up

class minds : system
    ids   = []::int
    types = []::entype
    inits = []::int
    minds = []::mind

    def enter(id, type):
        let n, i = ids.binary_search(id)
        ids.insert(i, id)
        types.insert(i, type)
        inits.insert(i, 0)
        minds.insert(i, mind { id: id })

    def exit(id):
        let n, i = ids.binary_search(id)
        ids.remove(i, n)
        types.remove(i, n)
        inits.remove(i, n)
        minds.remove(i, n)

    def ent_changed(shard, id:int, new:entype, old:entype):
        if (old ^ new) & ent_mind:
            if       new & ent_mind: this.enter(id, new)
            else: if old & ent_mind: this.exit(id)
        else:
            let n, i = ids.binary_search(id)
            for(n) j: types[i + j] = new
        return new

    def set_init(id:int, init:int):
        let n, i = ids.binary_search(id)
        for(n) j: inits[i + j] = init

    def intents(input:input_fun):
        let intents = map(types) t, mind_id:
            if t & ent_input: input()
            else:             minds[mind_id].think()
        let by_init   = vector_reserve(typeof [int], intents.length)
        let actor_ids = vector_reserve(typeof [int], intents.length)
        let actions   = vector_reserve(typeof [action], intents.length)
        for(intents) act, mind_id: if act.act != action_none:
            let init = -inits[mind_id] // reverse initiative order
            let n, i = by_init.binary_search(init)
            by_init.insert(i, init)
            actor_ids.insert(i, ids[mind_id])
            actions.insert(i, act)
        return actor_ids, actions

//// entity building

class ent_template:
    type  : entype
    name  = ""
    bg    = color_clear
    fg    = color_clear
    glyph = glyph_0
    z     = 0.0
    size  = 1.0
    cap   = xy_0

    rel_in  = entrel_shrug // sets scaffold rel when creating if non-shrug
    rel_out = entrel_shrug // sets scaffold rel when descending if non-shrug

    initiative = 0

    spawn      = []::ent_template
    spawn_prob = []::xy_i
    spawn_rel  = []::entrel
    spawn_at   = []::xy_f

    child_at = []::xy_f
    childrel = []::entrel
    children = []::ent_template

    def extend(body):
        let tmpl = dupe()
        body(tmpl)
        return tmpl

    def dupe():
        let tmpl = copy(this)
        tmpl.spawn = copy(tmpl.spawn)
        tmpl.spawn_prob = copy(tmpl.spawn_prob)
        tmpl.spawn_rel = copy(tmpl.spawn_rel)
        tmpl.spawn_at = copy(tmpl.spawn_at)
        tmpl.child_at = copy(tmpl.child_at)
        tmpl.childrel = copy(tmpl.childrel)
        tmpl.children = copy(tmpl.children)
        return tmpl

    def init_entity(shard:shard, id:int, pid:int, r:entrel, loc:xy_f):
        shard.name[id] = name
        shard.cap[id] = cap
        shard.ren[id] = render { bg, fg, glyph }
        shard.pos[id] = spatial { loc.x, loc.y, z, size }
        if pid:
            shard.link_after(pid, r, id, 0)
            if shard.type[pid] & ent_debug:
                shard.type[id] |= ent_debug

    def add_child(rel:entrel, at:xy_f, tmpl:ent_template):
        let child_id = children.length
        child_at.push(at)
        childrel.push(rel)
        children.push(tmpl) // TODO should copy?
        return child_id

    def add_spawn_sibling(tmpl:ent_template, prob:xy_i):
        spawn.push(tmpl)
        spawn_prob.push(prob)
        spawn_rel.push(entrel_shrug)
        spawn_at.push(xy_0)

    def add_spawn_child(tmpl:ent_template, prob:xy_i, rel:entrel, at:xy_f):
        spawn.push(tmpl)
        spawn_prob.push(prob)
        spawn_rel.push(rel)
        spawn_at.push(at)

let ent_0 = ent_template { type: ent_none }

def new_template(t:entype, body):
    let tmpl = ent_template { type: t }
    body(tmpl)
    return tmpl

class ent_scaffold:
    tmpl = ent_template { type : ent_none }

    loc = xy_0            // location cell in parent or world
    off = xy { 0.5, 0.5 } // sub-cell offset for root entities

    par = 0            // graph parent
    rel = entrel_shrug // graph relation

    def under(id:int, body):
        let old_par = par
        let old_off = off
        par = id
        off = xy { 0.5, 0.5 } // reset sub-cell offset at each level
        body()
        par = old_par
        off = old_off

    def with_rel(r:entrel, body):
        if r: // non-shrug
            let old_rel = rel
            rel = r
            body()
            rel = old_rel
        else:
            body()

    def init_entity(shard:shard, id:int):
        tmpl.init_entity(shard, id, par, rel, loc + off)

    def use(template:ent_template, body):
        let old_tmpl = tmpl
        tmpl = template
        body()
        tmpl = old_tmpl

    def at(l:xy_f, body):
        let old_loc = loc
        loc = l
        body()
        loc = old_loc

    def at_each(locs, body):
        let old_loc = loc
        for(locs) l, i:
            loc = l
            body(i)
        loc = old_loc

    def translate(by:xy_f, body):
        at(loc + by, body)

    def translate_each(offsets, body):
        let base = loc
        for(offsets) offset, i:
            loc = base + offset
            body(i)
        loc = base

    def fill_rect(n, body):
        let base = loc
        for(n) x: for(n) y:
            loc = base + xy_f { x, y }
            body(x, y)
        loc = base

//// ancillary component: entities spawn other entities

class spawner : system
    ids  = []::int
    prob = []::xy_i
    scaf = []::ent_scaffold

    def ent_changed(shard, id:int, new:entype, old:entype):
        if new == ent_none:
            let n, i = ids.binary_search(id)
            if n:
                ids.remove(i, n)
                prob.remove(i, n)
                scaf.remove(i, n)
        return new

    def clear_spawn(id:int):
        let n, i = ids.binary_search(id)
        if n:
            ids.remove(i, n)
            prob.remove(i, n)
            scaf.remove(i, n)

class spawn_scaffold:
    spawner:spawner
    id: int
    next_spawn_id: int

    p = xy_0i

    def prob(x:int, y:int): p = xy_i { x,     y }
    def odds(x:int, y:int): p = xy_i { x, x + y }

    def add_spawn(ctx:ent_scaffold):
        if ctx.tmpl.type and p.x and p.y:
            spawner.ids.insert(next_spawn_id, id)
            spawner.prob.insert(next_spawn_id, p)
            spawner.scaf.insert(next_spawn_id, copy(ctx))
            next_spawn_id++

def add_spawns(this::spawner, id:int, ctx:ent_scaffold):
    let n, spawn_id = ids.binary_search(id)
    let sp = spawn_scaffold {
        spawner: this,
        id: id,
        next_spawn_id: spawn_id,
    }
    ctx.under(id): for(ctx.tmpl.spawn) tmpl, i:
        let p = ctx.tmpl.spawn_prob[i]
        if p != xy_0i: sp.p = p
        let spawn_rel = ctx.tmpl.spawn_rel[i]
        nest_if(spawn_rel) body:
            ctx.with_rel(spawn_rel):
                ctx.at(ctx.tmpl.spawn_at[i]):
                    body()
        with: ctx.use(tmpl): sp.add_spawn(ctx)

def add_spawn(this::spawner, id:int, body):
    let n, spawn_id = ids.binary_search(id)
    body(spawn_scaffold {
        spawner: this,
        id: id,
        next_spawn_id: spawn_id,
    })
