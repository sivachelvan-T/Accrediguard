import { Link } from 'react-router-dom';
import { ShieldCheck, FileSearch, GitCompareArrows, AlertTriangle, Eye, Lock } from 'lucide-react';

export default function Landing() {
  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#0b1530' }}>
        <div style={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={20} /> AccrediGuard AI
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/login" className="btn btn-outline">Sign In</Link>
        </div>
      </header>

      <section className="landing-hero">
        <h1>Explainable Academic Evidence Intelligence & Accreditation Readiness</h1>
        <p>AccrediGuard AI reads student project reports, maps the evidence they contain to your academic criteria, explains why each match was made, and flags what's missing — before a human reviewer makes the final call.</p>
      </section>

      <section className="landing-section">
        <h2 style={{ fontSize: 24 }}>Not a document store. An evidence-intelligence engine.</h2>
        <p className="subtitle">The central question: does this report contain sufficient, traceable, credible evidence to support a given criterion?</p>
        <div className="landing-grid">
          <div className="feature-card">
            <FileSearch size={22} color="#1e3a8a" />
            <h3>Evidence Provenance</h3>
            <p>Every recommendation traces back to a document, page, section, and exact extracted text — click through from criterion to source.</p>
          </div>
          <div className="feature-card">
            <AlertTriangle size={22} color="#b45309" />
            <h3>Uncertainty-First AI</h3>
            <p>The system never fakes certainty. Low-confidence or contradictory evidence is labeled "human review required," not silently approved.</p>
          </div>
          <div className="feature-card">
            <GitCompareArrows size={22} color="#0d9488" />
            <h3>Evidence Integrity</h3>
            <p>Beyond "does evidence exist" — is it specific, measurable, complete, duplicated, or contradicted elsewhere in the document?</p>
          </div>
          <div className="feature-card">
            <Eye size={22} color="#6d28d9" />
            <h3>Human-in-the-Loop</h3>
            <p>AI never declares a criterion officially satisfied. Faculty reviewers approve, reject, or request revision — and every override is logged.</p>
          </div>
          <div className="feature-card">
            <Lock size={22} color="#b91c1c" />
            <h3>Security by Design</h3>
            <p>Role-based access control, magic-byte file validation, rate limiting, and immutable audit logs protect sensitive academic documents.</p>
          </div>
          <div className="feature-card">
            <ShieldCheck size={22} color="#15803d" />
            <h3>No Paid AI API Required</h3>
            <p>A fully local, deterministic analysis engine — no OpenAI, Claude, or Gemini key needed to run or demo the platform.</p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <h2 style={{ fontSize: 24 }}>Demo credentials</h2>
        <p className="subtitle">Password for every account: <code>Demo@1234</code></p>
        <table>
          <thead><tr><th>Role</th><th>Email</th></tr></thead>
          <tbody>
            <tr><td>Super Admin</td><td>admin@accrediguard.demo</td></tr>
            <tr><td>Accreditation Admin</td><td>accreditation@accrediguard.demo</td></tr>
            <tr><td>Faculty Reviewer</td><td>faculty@accrediguard.demo</td></tr>
            <tr><td>Project Coordinator</td><td>coordinator@accrediguard.demo</td></tr>
            <tr><td>Student</td><td>student@accrediguard.demo</td></tr>
            <tr><td>Viewer / Auditor</td><td>auditor@accrediguard.demo</td></tr>
          </tbody>
        </table>
        <div className="disclaimer-box">
          AccrediGuard AI provides automated evidence analysis and academic quality recommendations. It does not make official accreditation decisions and does not replace faculty, institutional, or accreditation authority review. The seeded "Demo Academic Quality Framework" is illustrative only and is not an official NBA/NAAC framework.
        </div>
      </section>
    </div>
  );
}
