import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'fossflow/dist/styles.css';
import 'react-quill/dist/quill.snow.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorBoundaryFallbackUI from './components/ErrorBoundary';
import { loadSharedIcons } from './sharedIcons';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

function renderApp() {
  root.render(
    <React.StrictMode>
      <ErrorBoundary FallbackComponent={ErrorBoundaryFallbackUI}>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

// Load the server-side shared icon library before the first render so those
// icons are already in the palette on startup. Fails soft (empty set) if the
// backend is unavailable, so the app always renders.
loadSharedIcons().finally(renderApp);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Register service worker for PWA functionality
serviceWorkerRegistration.register({
  onSuccess: () => console.log('Service worker registered successfully'),
  onUpdate: () => console.log('Service worker update available')
});
