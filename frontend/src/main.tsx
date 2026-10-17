import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { IntelligencePage } from './pages/IntelligencePage';
import { KnowledgePage } from './pages/KnowledgePage';
import { DocumentGraphPage } from './pages/DocumentGraphPage';
import { ChunkCloudPage } from './pages/ChunkCloudPage';
import { EntitiesPage } from './pages/EntitiesPage';
import { SettingsPage } from './pages/SettingsPage';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/knowledge/graph" element={<DocumentGraphPage />} />
          <Route path="/knowledge/chunks" element={<ChunkCloudPage />} />
          <Route path="/knowledge/entities" element={<EntitiesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
