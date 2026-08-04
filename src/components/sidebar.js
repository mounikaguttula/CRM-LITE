import React from 'react';
import NavigationPage from '../pages/workspace/NavigationPage';

function Sidebar({ onNavigate, open }) {
  return (
    <aside className={`app-sidebar h-100 ${open ? 'open' : ''}`}>
      <NavigationPage onNavigate={onNavigate} />
    </aside>
  );
}

export default Sidebar;
