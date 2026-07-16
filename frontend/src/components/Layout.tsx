import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const NAV_ITEMS = [
  { to: '/', label: 'Главная', end: true },
  { to: '/reports', label: 'Отзывы' },
  { to: '/analytics', label: 'Аналитика' },
  { to: '/history', label: 'История' },
]

export function Layout() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <img src="/nu-shield.png" alt="Nazarbayev University" className="brand-mark" />
          AtriumSense
        </div>
        <nav className="nav-links" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'}
          title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
