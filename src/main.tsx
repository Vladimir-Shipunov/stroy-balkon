/**
 * @file React entry point for the БАЛКОН-МСК site.
 * Mounts the application into the `#root` element defined in `index.html`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found in document.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
