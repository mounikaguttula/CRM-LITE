import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/login';
import Setup from './pages/setup';

import MainPage from './pages/workspace/MainPage';
import OverviewPage from './pages/workspace/OverviewPage';
import DetailPage from './pages/workspace/DetailPage';
import CreatePage from './pages/workspace/CreatePage';
import EditPage from './pages/workspace/EditPage';
import LeadScannerPage from './pages/workspace/LeadScannerPage';
import CampaignsPage from './pages/workspace/CampaignsPage';
import CampaignFormPage from './pages/public/CampaignFormPage';
import FormsPage from './pages/workspace/FormsPage';
import FormBuilderPage from './pages/workspace/FormBuilderPage';
import FormSubmissionsPage from './pages/workspace/FormSubmissionsPage';
import PublicFormPage from './pages/public/PublicFormPage';

import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';
import './styles/global.css';
import './styles/responsive.css';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 text-muted">
        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status" />
        Authenticating…
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/public/campaign-form" element={<CampaignFormPage />} />
          <Route path="/forms/:slug" element={<PublicFormPage />} />
          <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />

          <Route path="/workspace" element={<ProtectedRoute><MainPage /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<OverviewPage />} />
            <Route path="lead-scanner" element={<LeadScannerPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="object/campaign" element={<CampaignsPage />} />
            <Route path="forms" element={<FormsPage />} />
            <Route path="object/form" element={<FormsPage />} />
            <Route path="forms/new" element={<FormBuilderPage />} />
            <Route path="forms/:formId/edit" element={<FormBuilderPage />} />
            <Route path="forms/:formId/submissions" element={<FormSubmissionsPage />} />
            <Route path="validation-rules" element={<Navigate to="/setup?tab=validation" replace />} />
            <Route path="object/:objectTypeId" element={<OverviewPage />} />
            <Route path="object/:objectTypeId/new" element={<CreatePage />} />
            <Route path="object/:objectTypeId/create" element={<CreatePage />} />
            <Route path="object/:objectTypeId/:recordId" element={<DetailPage />} />
            <Route path="object/:objectTypeId/:recordId/edit" element={<EditPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}


export default App;
