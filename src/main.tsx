import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from 'react-router-dom';
import App from "./App.tsx";
import { DailyProvider } from "@daily-co/daily-react";
import { ErrorBoundary } from "./components/ErrorBoundary";

import "./fonts/Christmas and Santona.ttf";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Router>
        <DailyProvider>
          <App />
        </DailyProvider>
      </Router>
    </ErrorBoundary>
  </React.StrictMode>,
);