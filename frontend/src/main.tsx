import { config } from '@fortawesome/fontawesome-svg-core';
import { configureSpanishMessages } from '@sistema-e/contracts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';

// Su CSS va en index.css: la CSP bloquea estilos inyectados.
config.autoAddCss = false;
configureSpanishMessages();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
