# Voxsmith

Hum, sing or beatbox into your mic and get five ready-to-play tunes. Swap instruments, edit the beat on a step grid, and load demo beats, all in the browser with no backend.

## How it works

1. **Record.** Pitch is tracked with a normalised autocorrelation detector, and non-pitched mouth sounds are classified as kick, snare or hi-hat by their spectral brightness.
2. **Pick a tune.** One take is arranged into five styles (Anime fight, Lo-fi, Trap, EDM, Epic) with drums, bass and chords, in your detected key.
3. **Edit.** Change the instruments, tempo and the 16-step pattern grid, or load one of 8 demo beats.

All sound is synthesized with the Web Audio API, so there are no samples to license and no network calls.

## Run it locally

The microphone needs a secure context (`https://` or `localhost`), so don't open the file directly. Serve it:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Push to `main` and the included GitHub Actions workflow publishes the site to GitHub Pages.
In your repo: **Settings → Pages → Source: GitHub Actions**.

## Project layout

```
index.html          page markup
css/style.css       styles
js/app.js           audio engine, pitch and beat detection, arranger, UI
.github/workflows/  GitHub Pages deploy
```

## Notes

- The "Pro" tier is a front-end mock. The upgrade button only flips a flag, and no billing is connected.
- Free vs Pro limits are defined by the `PRO` flag and the `pro: 1` markers on instruments and demo beats in `js/app.js`.

## Roadmap

- Real recorded instrument samples (replace the oscillator voices)
- ML pitch and beatbox classification (for example Basic Pitch or CREPE)
- WAV and MIDI export
- Saved projects
- Tempo-matching your melody to the chosen style
- Real payments (Stripe plus a small backend)

## License

MIT
