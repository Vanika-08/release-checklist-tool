import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { ReleaseList } from "./pages/ReleaseList";
import { ReleaseDetail } from "./pages/ReleaseDetail";
import { ToastContainer } from "react-toastify";

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="light"
      />

      <header className="topbar">
        <Link to="/" className="brand">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <rect
              x="1"
              y="1"
              width="20"
              height="20"
              rx="5"
              fill="var(--accent)"
            />
            <path
              d="M6 11.5l3.2 3.2L16 7.8"
              stroke="#fff"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Release Checklist
        </Link>
      </header>

      <Routes>
        <Route path="/" element={<ReleaseList />} />
        <Route path="/releases/:id" element={<ReleaseDetail />} />
        <Route
          path="*"
          element={
            <main className="page">
              <h1>Page not found</h1>
              <Link to="/">Back to releases</Link>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
