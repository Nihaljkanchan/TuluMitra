import { Link } from "react-router-dom";
import { isMockMode } from "../services/api";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <p>
          <span className="kn-display">ತುಳು ಮಿತ್ರ</span> · AI-powered Tulu voice assistant
        </p>
        <p className="footer__meta">
          Canara Engineering College · Artificial Intelligence and Machine Learning
          {isMockMode && <span className="footer__flag">Demo data</span>}
          <Link to="/admin" className="footer__admin">
            Admin
          </Link>
        </p>
      </div>
    </footer>
  );
}
