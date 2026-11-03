# FanTree — Family Fan Chart Designer

A local, browser-based editor for beautiful ancestor fan charts. Drop in photos, position them inside each frame, add names, choose a theme, and export a crisp UHD image (up to 8K) ready for printing or sharing.

Everything runs on your machine. Photos are never uploaded; they are stored in your browser's IndexedDB.

Your chart and photos save automatically and come back when you reopen the app. Saved data is tied to the browser and address you use (for example `http://127.0.0.1:5178`). Clearing site data or using a private window will remove it, so export a `.fantree` project file as a backup (see below).

## Getting started

Requires Node.js 20+.

```bash
npm install
npm start          # opens http://127.0.0.1:5178
```

For a production build: `npm run build && npm run preview`.

## Features

- **Fan chart**: a centre circle plus up to 6 generations. You can adjust the span (up to 360°), the centre size, gaps and corner rounding.
- **Photos**:
  - Click an empty frame to add a photo, or drop images onto a frame.
  - Drop many images (or use **Add several photos**) to fill the empty frames in order.
  - Drag to reposition, scroll to zoom, and use the arrow keys to nudge.
  - Framing is stored relative to each frame, so changing generations, span, gaps or centre size never shifts a photo's position or zoom.
  - Rotate, mirror, and adjust brightness, contrast and saturation in the Inspector.
  - Photos can stay upright or follow the fan's angle.
- **Themes**:
  - 14 presets, or your own solid, linear or radial background.
  - Optional film-grain, paper or linen texture, and a vignette.
  - Photo tones: original, black & white, noir, sepia, warm or cool.
- **Frame styles**: solid, outlined (solid, dashed or dotted), no outline, faded edges, blurred edges, and frosted glass, with colour, opacity, width and drop-shadow controls. Turn off **Show empty frames** to make frames without a photo invisible in the export; they still appear as dashed placeholders while editing. *No outline* always hides them.
- **Names**:
  - Optional name and dates for each person.
  - Labels can curve along the arc or run radially, in a choice of 7 typefaces.
  - Shown in a band or directly on the photo.
- **Title**: an optional title and subtitle above the fan.
- **Export**:
  - PNG, JPEG, WebP or SVG at HD, 4K, 5K, 8K or a 60 cm poster print (300 dpi), with an optional transparent background.
  - Each photo is resampled from its original to exactly the size needed.
  - Fonts are embedded, so the output matches the editor.
- **Projects**:
  - Autosaves locally, with full undo/redo.
  - Export and import a portable `.fantree` file that includes your photos (see below).

## Project files (`.fantree`)

**Export project file** (the save icon, or ⌘/Ctrl S) writes one self-contained file you can back up or move to another computer or browser. It contains:

- every photo, stored as the exact image data the app uses (no re-compression)
- each photo's position, zoom, rotation, mirroring and brightness/contrast/saturation
- all names and dates
- every theme, frame, label, title and layout setting

**Import project file** (the folder icon, or ⌘/Ctrl O) restores everything, even into a brand-new installation. You can also drag a `.fantree` file onto the app window. Importing replaces the current chart, and Undo brings the previous one back.

A `.fantree` file is a standard zip archive containing `project.json` and an `images/` folder, so your photos are never locked in. Files are validated on import: missing or damaged photos are reported and the rest of the chart still loads. Files saved by earlier versions of FanTree still open.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| ⌘/Ctrl Z, ⇧⌘/Ctrl Z | Undo / redo |
| ⌘/Ctrl S | Export project file |
| ⌘/Ctrl O | Import project file |
| ⌘/Ctrl E | Export |
| ⌘/Ctrl V | Paste an image into the selected frame |
| Arrows (⇧ for larger steps) | Nudge photo |
| Scroll / ⌘/Ctrl + scroll | Zoom photo / zoom view |
| + / − | Zoom view |
| Delete | Remove photo |
| Esc | Deselect |

## Development

```bash
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run typecheck
```

The tech stack is React 19, TypeScript (strict), Vite, Zustand + Immer and idb-keyval. The chart is a single SVG ([src/components/FanChart.tsx](src/components/FanChart.tsx)), and all geometry lives in [src/lib/geometry.ts](src/lib/geometry.ts). Export ([src/lib/export.ts](src/lib/export.ts)) builds a self-contained SVG and rasterises it on a canvas.
