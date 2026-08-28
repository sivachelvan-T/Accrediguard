import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { UploadCloud, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { bandBadgeClass, confidenceBadgeClass, scoreColor, reviewStatusBadgeClass } from '../utils/badges';

const REVIEWER_ROLES = ['FACULTY_REVIEWER', 'ACCREDITATION_ADMIN', 'SUPER_ADMIN'];

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [expandedCriterion, setExpandedCriterion] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get(`/projects/${id}`);
    setProject(res.data.data);
    const latestDoc = res.data.data.documents?.[0];
    if (latestDoc) {
      const versionsRes = await api.get(`/documents/${latestDoc.id}/versions`);
      const latestVersion = versionsRes.data.data[0];
      if (latestVersion) {
        const analysisRes = await api.get(`/documents/${latestVersion.id}/analysis`);
        setAnalysis({ ...analysisRes.data.data, documentVersionId: latestVersion.id, documentId: latestDoc.id });
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post(`/projects/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadMsg(res.data.message || 'Document uploaded and analyzed.');
      await load();
    } catch (err) {
      setUploadMsg(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function submitReview(evidenceId, decision, comment) {
    await api.post(`/evidence/${evidenceId}/review`, { decision, comment });
    await load();
  }

  async function submitProject() {
    setStatusBusy(true);
    setStatusMsg('');
    try {
      await api.post(`/projects/${id}/submit`);
      await load();
      setStatusMsg('Project submitted successfully. The selected faculty reviewer has been notified.');
    } catch (err) {
      setStatusMsg(err.response?.data?.message || 'Unable to submit the project.');
    } finally {
      setStatusBusy(false);
    }
  }

  async function changeStatus(status) {
    setStatusBusy(true);
    setStatusMsg('');
    try {
      await api.patch(`/projects/${id}`, { status });
      await load();
      setStatusMsg(`Project status changed to ${status.replace(/_/g, ' ')}.`);
    } catch (err) {
      setStatusMsg(err.response?.data?.message || 'Unable to change project status.');
    } finally {
      setStatusBusy(false);
    }
  }

  if (loading) return <div className="page-loading">Loading project…</div>;
  if (!project) return <div className="empty-state">Project not found.</div>;

  const overallReadiness = analysis?.analysis?.overall_readiness;
  const canReview = REVIEWER_ROLES.includes(user.role);
  const isAdmin = ['SUPER_ADMIN', 'ACCREDITATION_ADMIN'].includes(user.role);
  const isAssignedFaculty = user.role === 'FACULTY_REVIEWER' && project.faculty_id === user.id;
  const isCoordinator = user.role === 'PROJECT_COORDINATOR' && project.coordinator_id === user.id;
  const canApproveProject = isAdmin || isAssignedFaculty;
  const canSubmitProject = isAdmin || isCoordinator || user.role === 'STUDENT';

  return (
    <div>
      <h1>{project.title}</h1>
      <p className="subtitle">Status: <span className="badge badge-gray">{project.status.replace(/_/g, ' ')}</span></p>
      <p className="form-help">Faculty Reviewer: <strong>{project.faculty_name || 'Not assigned'}</strong>{project.framework_name ? ` · Framework: ${project.framework_name}` : ''}</p>

      {(canApproveProject || canSubmitProject || isAdmin) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Workflow</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canSubmitProject && ['DRAFT', 'REVISION_REQUIRED'].includes(project.status) && (
              <>
                {analysis?.analysis?.status === 'COMPLETED' ? (
                  <button className="btn btn-primary" disabled={statusBusy} onClick={submitProject}>Submit Project for Faculty Verification</button>
                ) : (
                  <span className="form-help">Upload and complete PDF analysis before submitting.</span>
                )}
              </>
            )}
            {canApproveProject && project.status === 'UNDER_REVIEW' && (
              <>
                <button className="btn btn-primary" disabled={statusBusy} onClick={() => changeStatus('APPROVED')}>Approve Project</button>
                <button className="btn btn-outline" disabled={statusBusy} onClick={() => changeStatus('REVISION_REQUIRED')}>Request Revision</button>
              </>
            )}
            {isAdmin && project.status !== 'ARCHIVED' && (
              <button className="btn btn-outline" disabled={statusBusy} onClick={() => changeStatus('ARCHIVED')}>Archive</button>
            )}
          </div>
          {statusMsg && <p className="form-help" style={{ marginTop: 8 }}>{statusMsg}</p>}
        </div>
      )}

      <div className="card">
        <h2>Document</h2>
        <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
          <UploadCloud size={16} /> {uploading ? 'Uploading…' : 'Upload PDF Report'}
          <input type="file" accept="application/pdf" hidden onChange={handleUpload} disabled={uploading} />
        </label>
        {uploadMsg && <p className="form-help" style={{ marginTop: 8 }}>{uploadMsg}</p>}
        <p className="form-help">Max 10MB. PDF only. Uploading a new version re-runs the full analysis pipeline.</p>
      </div>

      {analysis?.analysis && (
        <div className="card">
          <h2>Evidence Readiness</h2>
          <div className="card-grid">
            <StatBlock label="Overall Readiness" value={`${Math.round(overallReadiness)}%`} color={scoreColor(overallReadiness)} />
            <StatBlock label="Evidence Health" value={`${Math.round(analysis.analysis.evidence_health)}/100`} />
            <StatBlock label="Evidence Debt" value={analysis.analysis.evidence_debt_level} />
            <StatBlock label="Traceability Index" value={`${Math.round(analysis.analysis.traceability_index)}%`} />
          </div>
          <div className="disclaimer-box">
            AI-generated analysis is an assistive recommendation and does not constitute an official accreditation decision.
          </div>
        </div>
      )}

      {analysis?.criterionResults?.length > 0 && (
        <div className="card">
          <h2>Criterion Mapping</h2>
          {analysis.criterionResults.map((cr) => {
            const evidenceItems = analysis.evidence.filter((e) => e.criterion_id === cr.criterion_id);
            const expanded = expandedCriterion === cr.criterion_id;
            return (
              <div key={cr.id}>
                <div className="criterion-row" onClick={() => setExpandedCriterion(expanded ? null : cr.criterion_id)}>
                  <div>
                    <strong>{cr.code}</strong> &nbsp; {cr.title}
                    <div style={{ marginTop: 4 }}>
                      <span className={`badge ${bandBadgeClass(cr.band)}`}>{cr.band}</span>{' '}
                      <span className={`badge ${confidenceBadgeClass(cr.confidence_label)}`}>{cr.confidence_label}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="criterion-bar-track">
                      <div className="criterion-bar-fill" style={{ width: `${cr.score}%`, background: scoreColor(cr.score) }} />
                    </div>
                    <span style={{ fontWeight: 700, width: 40, textAlign: 'right' }}>{cr.score}%</span>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expanded && (
                  <div className="evidence-panel">
                    <p style={{ margin: '0 0 10px', fontSize: 13.5 }}><strong>Recommendation:</strong> {cr.recommendation}</p>
                    {cr.missing_expectations?.length > 0 && (
                      <p style={{ fontSize: 13.5, color: 'var(--color-red)' }}>
                        Missing/underrepresented: {cr.missing_expectations.join(', ')}
                      </p>
                    )}

                    {evidenceItems.length === 0 ? (
                      <p className="form-help">No evidence detected for this criterion.</p>
                    ) : (
                      evidenceItems.map((ev) => (
                        <EvidenceCard key={ev.id} evidence={ev} canReview={canReview} onReview={submitReview} />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBlock({ label, value, color }) {
  return (
    <div className="card stat-card" style={{ boxShadow: 'none', border: '1px solid var(--color-border)' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}

function EvidenceCard({ evidence, canReview, onReview }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function decide(decision) {
    if (['REJECT', 'REQUEST_REVISION'].includes(decision) && !comment.trim()) {
      alert('A comment is required for this decision.');
      return;
    }
    setBusy(true);
    try {
      await onReview(evidence.id, decision, comment);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <span className="form-help">Page {evidence.page_number} · {evidence.section} · {evidence.evidence_type}</span>
        <span className={`badge ${reviewStatusBadgeClass(evidence.review_status)}`}>{evidence.review_status.replace(/_/g, ' ')}</span>
      </div>

      <div className="evidence-source-text">{evidence.extracted_text}</div>

      <ul className="explain-list">
        {evidence.matched_keywords.map((k) => <li key={k}>&quot;{k}&quot; found</li>)}
        {evidence.has_numeric === 1 && <li>Numeric evidence detected</li>}
        <li>Evidence quality: {evidence.overall_quality}/100 · Confidence: {evidence.confidence}%</li>
      </ul>

      {evidence.contradiction_flag === 1 && (
        <p style={{ color: 'var(--color-purple)', fontSize: 13, fontWeight: 600 }}>⚠ {evidence.contradiction_note}</p>
      )}
      {evidence.duplicate_of && (
        <p className="form-help">This evidence text also appears elsewhere in the document.</p>
      )}

      {canReview && (
        <div style={{ marginTop: 10 }}>
          <textarea placeholder="Reviewer comment (required for reject / revision)" value={comment} onChange={(e) => setComment(e.target.value)}
            rows={2} style={{ width: '100%', padding: 8, border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => decide('APPROVE')}>Approve</button>
            <button className="btn btn-outline" disabled={busy} onClick={() => decide('PARTIAL')}>Partial</button>
            <button className="btn btn-outline" disabled={busy} onClick={() => decide('REQUEST_REVISION')}>Request Revision</button>
            <button className="btn btn-danger" disabled={busy} onClick={() => decide('REJECT')}>Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}
