import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Could not find the root element with id "root".');
}

createRoot(rootElement).render(<App />);
