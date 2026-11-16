# Wonders Unseen

Marvels that science fiction described in print and never put on screen, built in 3D so you can play with them.

**Eight wonders so far**, all from the Star Wars novels. Every model, texture and sound is generated in code: there are no image, model or audio files.

| Wonder | What it is | What you do |
| --- | --- | --- |
| **Zonama Sekot** | A living planet that can fly | Hold to wake its engines, let go to jump to a new sky. Tap the planet and it answers. |
| **Centerpoint Station** | An ancient machine that tows planets | Hold the tractor beam to pull a wandering world in, and let go while a ring is lit to set it in orbit. Place all five. |
| **The Starcave of ThonBoka** | A nebula full of Oswaft, gentle giants that swim in open space | Steer one. Sing to call the pod and draw starlight in. Leap to dash ahead. Gather starlight and the pod grows. |
| **The Sun Crusher** | A tiny ship that can make a star explode | Hold to arm the torpedo. Watch what happens to the star. Then find another. |
| **The Cathedral of Winds** *(phase 2)* | A crystal organ as tall as a mountain, played by the storm | Tap spires to open them. The wind sweeps down the nave and every open spire sings. Hold to call the storm and the whole cathedral joins in. |
| **The Maw Installation** *(phase 2)* | A secret laboratory hidden in a knot of black holes | Drag from the ship to aim and let go. Gravity bends the path, starlight bends around the holes, and three layouts get steadily trickier. |
| **The Grass Paintings** *(phase 2)* | Alderaan's meadows, planted as pictures the size of cities | Pick a flower colour and drag across the plain to plant it, mirrored six ways if you like. Call the wind, then fly over what you made. |
| **The Katana Fleet** *(phase 2)* | Two hundred lost warships wired to move as one | Wake the fleet with one tap. Drag to steer and every ship follows your exact path. Change formation, then jump them all together. |

A galaxy map ties them together, and every trip between wonders is a hyperspace jump. **Just look** in the top bar puts the interface away so you can simply watch.

## Run it

There is no build step. Serve the folder with any static file server and open it:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It also works as-is on GitHub Pages. (Opening `index.html` straight from disk will not work, because browsers block JavaScript modules on `file://`.)

## Controls

| | Mouse / keyboard | Touch |
| --- | --- | --- |
| Look around | Drag, scroll to zoom | Drag, pinch to zoom |
| Look around where a drag steers, aims or paints | `Shift`-drag or right-drag | Two fingers |
| Main action | The on-screen button, or `Space` | The on-screen button |
| Steer (Starcave, Katana Fleet) | Drag, or `WASD` / arrow keys | Drag |
| Pull a world (Centerpoint) | Press and hold a planet, or hold `Space` | Press and hold a planet |
| Open a spire (Cathedral) | Click it | Tap it |
| Aim and launch (Maw) | Drag from the ship and let go, or arrow keys then `Space` | Drag from the ship and let go |
| Plant flowers (Grass Paintings) | Drag across the plain | Drag across the plain |
| Hide the interface | `L`, or "Just look" | "Just look"; tap to bring it back |
| Next / previous wonder | `←` `→` where they are not steering, or the arrow buttons | The arrow buttons |
| Back to the map | `Esc` or `M` | "Galaxy map" |

A direct link to a wonder works too: `#zonama`, `#centerpoint`, `#thonboka`, `#suncrusher`, `#cathedral`, `#maw`, `#alderaan`, `#katana`.

## How it is put together

```
index.html            page shell and HUD markup
css/style.css         HUD styling
js/main.js            renderer, camera, input, HUD, hyperspace transitions
js/core/              shared pieces: painted skies, planets and stars, warp streaks, orbit camera, sound
js/scenes/            one file per place: galaxy map + the eight wonders
vendor/three/         three.js r170 and its bloom post-processing (MIT)
```

Each scene file exports a `meta` object (name, blurb, accent colour) and a `create(app)` function that returns its 3D scene, its action buttons and an `update` loop. Adding a wonder means adding one file to `js/scenes/` and one line to the list at the top of `js/main.js`.

## Ideas for later phases

- A guided tour that plays itself, visiting each wonder and performing its signature moment.
- More unseen wonders: the floating herd cities of Ithor, the Room of a Thousand Fountains, the glitter-webs of Kessel's spice mines, the worldships of the far invaders.
- Wonders from other universes. The framework does not care which galaxy a scene comes from.

## Credits

A fan-made tribute. Not affiliated with, endorsed by or sponsored by Lucasfilm or Disney. Star Wars and all related names are trademarks of their owners. The wonders shown here are original interpretations of places and things described in *Rogue Planet* (2000), the *Corellian Trilogy* (1995), *Lando Calrissian and the Starcave of ThonBoka* (1983), the *Jedi Academy Trilogy* (1994), *The Illustrated Star Wars Universe* (1995) and *Dark Force Rising* (1992).

Built with [three.js](https://threejs.org) (MIT). Simplex noise by Ian McEwan and Ashima Arts (MIT). Type: Fraunces and Michroma (SIL Open Font License), loaded from Google Fonts.
