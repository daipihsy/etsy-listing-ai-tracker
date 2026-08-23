import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, Store, Settings as SettingsIcon } from 'lucide-react'

export function App(): JSX.Element {
  return (
    <div className="flex h-screen flex-col">
      {/* 顶部拖动条（配合无边框标题栏，红绿灯按钮区留白） */}
      <div className="drag h-9 w-full shrink-0" />
      <div className="flex min-h-0 flex-1">
        <aside className="drag flex w-52 shrink-0 flex-col gap-1 border-r border-black/5 px-3 pb-4">
          <div className="px-2 pb-3">
            <p className="text-sm font-semibold leading-tight">Etsy Listing</p>
            <p className="text-sm font-semibold leading-tight text-etsy">AI Tracker</p>
          </div>
          <NavItem to="/listings" icon={<LayoutGrid size={17} />} label="单链接分析" />
          <NavItem to="/stores" icon={<Store size={17} />} label="整店分析" />
          <NavItem to="/settings" icon={<SettingsIcon size={17} />} label="Settings" />
          <div className="mt-auto px-2 text-[11px] text-black/30">本地数据 · 无需联网存储</div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({
  to,
  icon,
  label
}: {
  to: string
  icon: JSX.Element
  label: string
}): JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        'no-drag flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ' +
        (isActive ? 'bg-etsy/10 text-etsy' : 'text-black/60 hover:bg-black/5')
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
