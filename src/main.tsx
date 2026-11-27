import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocalStore } from './store/LocalStore';
import { App } from './ui/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={new LocalStore(window.localStorage)} />
  </StrictMode>,
);
