import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OverviewPage } from './pages/OverviewPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { IntelligencePage } from './pages/IntelligencePage';
import { KnowledgePage } from './pages/KnowledgePage';
import { DocumentGraphPage } from './pages/DocumentGraphPage';
import { ChunkCloudPage } from './pages/ChunkCloudPage';
import { EntitiesPage } from './pages/EntitiesPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { InsightsPage } from './pages/InsightsPage';
import './styles/design.css';
import { AppLayoutWithErrorBoundary } from './layouts/AppLayoutWithErrorBoundary';
import { KnowledgeLayout } from './pages/KnowledgeLayout';
import './styles/glass.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayoutWithErrorBoundary />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/knowledge" element={<KnowledgeLayout />}>
            <Route index element={<KnowledgePage />} />
            <Route path="graph" element={<DocumentGraphPage />} />
            <Route path="chunks" element={<ChunkCloudPage />} />
            <Route path="entities" element={<EntitiesPage />} />
          </Route>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
