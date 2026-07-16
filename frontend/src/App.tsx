import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { Analytics } from './pages/Analytics'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Reports } from './pages/Reports'

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="history" element={<History />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="reports" element={<Reports />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
