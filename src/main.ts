// The entry point. index.html loads this file, and everything else starts from here.

import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/vt323/400.css';
import './ui/ui.css';
import { Game } from './core/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

const game = new Game(canvas, ui);

// Exposed only while developing, for automated checks in the browser.
if (import.meta.env.DEV) {
  (window as unknown as { __annex: Game['debug'] }).__annex = game.debug;
  import.meta.hot?.dispose(() => game.dispose());
}

void game.boot();
