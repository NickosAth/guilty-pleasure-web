import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {auth} from './lib/firebase';
import App from './App';

auth.languageCode='el';

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
