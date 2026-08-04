import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { WorkspaceProvider } from '../../context/WorkspaceContext';
import Sidebar from '../../components/sidebar';
import Navbar from '../../components/navbar';
import AIChatBotWidget from '../../components/AIChatBotWidget';

function MainPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <WorkspaceProvider>
      <div className="orbit-root">
        <div className="orbit-bg-mesh" />
        <div className="app-shell">
          <Sidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
          {mobileOpen && (
            <div
              className="sidebar-backdrop"
              onClick={() => setMobileOpen(false)}
            />
          )}

          <div className="app-main">
            <header className="app-header">
              <Navbar onMenuToggle={() => setMobileOpen((v) => !v)} />
            </header>
            <main className="app-content orbit-scrollbar fade-in">
              <Outlet />
            </main>
          </div>
        </div>

        {/* Global AI Chatbot Widget — visible across all workspace pages */}
        <AIChatBotWidget />
      </div>
    </WorkspaceProvider>
  );
}

export default MainPage;
