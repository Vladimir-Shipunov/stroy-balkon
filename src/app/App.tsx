/**
 * @file Application root — routing, modal provider, scroll restoration.
 *
 * Marketing pages share the `Layout` shell (header + footer); the configurator
 * renders full-screen on its own route. Pages are code-split with `lazy()` so the
 * initial bundle stays small (Lighthouse budget).
 *
 * The router basename is always `/` — the app is served at the site root
 * (`/`, `/configurator`, `/services`...) in both dev and prod (see
 * `server/server.js`'s catch-all). This is intentionally independent of Vite's
 * own `base` (`/app/` in prod), which only controls where the *built JS/CSS
 * asset files* are requested from (`/app/assets/...`) — the physical files
 * stay under `public/app/` so the build never collides with the legacy static
 * site's own files in `public/`, but the HTML shell that references them is
 * served at every top-level route, not just under `/app/`.
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CallModalProvider } from '../components/CallModal/CallModalProvider';
import { ChatWidget } from '../components/ChatWidget/ChatWidget';
import { ManagerChatWidget } from '../components/ManagerChatWidget/ManagerChatWidget';
import { Layout } from '../components/Layout/Layout';
import { PageLoader } from '../components/PageLoader';
import { ScrollToTop } from '../components/ScrollToTop';
import { ConfiguratorProvider } from '../pages/Configurator/ConfiguratorContext';
import { ErrorBoundary } from '../pages/Configurator/ErrorBoundary';

const Home = lazy(() => import('../pages/Home/Home').then((m) => ({ default: m.Home })));
const Services = lazy(() =>
  import('../pages/Services/Services').then((m) => ({ default: m.Services })),
);
const Portfolio = lazy(() =>
  import('../pages/Portfolio/Portfolio').then((m) => ({ default: m.Portfolio })),
);
const About = lazy(() => import('../pages/About/About').then((m) => ({ default: m.About })));
const Contacts = lazy(() =>
  import('../pages/Contacts/Contacts').then((m) => ({ default: m.Contacts })),
);
const Configurator = lazy(() =>
  import('../pages/Configurator/Configurator').then((m) => ({ default: m.Configurator })),
);
const OrdersAdmin = lazy(() =>
  import('../pages/Admin/OrdersAdmin').then((m) => ({ default: m.OrdersAdmin })),
);
const AdminCalls = lazy(() =>
  import('../pages/Admin/AdminCalls').then((m) => ({ default: m.AdminCalls })),
);
const AdminChats = lazy(() =>
  import('../pages/Admin/AdminChats').then((m) => ({ default: m.AdminChats })),
);
const NotFound = lazy(() =>
  import('../pages/NotFound/NotFound').then((m) => ({ default: m.NotFound })),
);

/**
 * The application shell.
 * @returns The rendered app.
 */
export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <ConfiguratorProvider>
        <CallModalProvider>
          <ScrollToTop />
          <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="services" element={<Services />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="about" element={<About />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route
            path="configurator"
            element={
              <Suspense fallback={<PageLoader />}>
                <ErrorBoundary>
                  <Configurator />
                </ErrorBoundary>
              </Suspense>
            }
          />
          <Route path="admin" element={<Navigate to="/admin/orders" replace />} />
          <Route
            path="admin/orders"
            element={
              <Suspense fallback={<PageLoader />}>
                <OrdersAdmin />
              </Suspense>
            }
          />
          <Route
            path="admin/orders/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <OrdersAdmin />
              </Suspense>
            }
          />
          <Route path="admin/calls" element={<Suspense fallback={<PageLoader />}><AdminCalls /></Suspense>} />
          <Route path="admin/chats" element={<Suspense fallback={<PageLoader />}><AdminChats /></Suspense>} />
          <Route path="admin/chats/:id" element={<Suspense fallback={<PageLoader />}><AdminChats /></Suspense>} />
          </Routes>
          <ChatWidget />
          <ManagerChatWidget />
        </CallModalProvider>
      </ConfiguratorProvider>
    </BrowserRouter>
  );
}
