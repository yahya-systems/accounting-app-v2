import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModuleRegistry, AllCommunityModule, ValidationModule } from 'ag-grid-community'
import './index.css'
import App from './App.jsx'

// Temporary: ValidationModule surfaces the full text of AG Grid warnings/errors
// (e.g. #135) in the console instead of just an error code + doc link.
ModuleRegistry.registerModules([AllCommunityModule, ValidationModule])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
