import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PortsProvider} from './contexts/PortsContext.tsx';
import {ViewModeProvider} from './contexts/ViewModeContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ViewModeProvider>
      <PortsProvider>
        <App />
      </PortsProvider>
    </ViewModeProvider>
  </StrictMode>,
);
