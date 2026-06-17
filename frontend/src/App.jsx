import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ConcoursPage from './pages/ConcoursPage';
import ConcoursDetailPage from './pages/ConcoursDetailPage';
import EmploisPage from './pages/EmploisPage';
import JobDetailPage from './pages/JobDetailPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminConcours from './pages/AdminConcours';
import AdminEmplois from './pages/AdminEmplois';
import { applyRtl } from './i18n';

const GA_MEASUREMENT_ID = 'G-C5L229P3N6';

function isAnalyticsEnabled() {
  return import.meta.env.PROD && typeof window !== 'undefined' && !!GA_MEASUREMENT_ID;
}

function initializeAnalytics() {
  if (!isAnalyticsEnabled() || window.__atlasGaInitialized) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.__atlasGaInitialized = true;
}

function trackPageView(path) {
  if (!isAnalyticsEnabled() || typeof window.gtag !== 'function') return;
  if (window.__atlasLastPageView === path) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
  window.__atlasLastPageView = path;
}

function AnalyticsRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    initializeAnalytics();
  }, []);

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(path);
  }, [location]);

  return null;
}

import BlogPage from './pages/BlogPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import ChatWidget from './components/ChatWidget';

function App() {
  useEffect(() => { applyRtl(); }, []);

  return (
    <BrowserRouter>
      <AnalyticsRouteTracker />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/concours" element={<ConcoursPage />} />
        <Route path="/concours/:id" element={<ConcoursDetailPage />} />
        <Route path="/jobs" element={<EmploisPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<ArticleDetailPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/concours" element={<AdminConcours />} />
        <Route path="/admin/emplois" element={<AdminEmplois />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <ChatWidget />
      <Footer />
    </BrowserRouter>
  );
}

export default App;
