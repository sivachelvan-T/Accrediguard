import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { reviewStatusBadgeClass } from '../utils/badges';

const REVIEWER_ROLES = [
  'FACULTY_REVIEWER',
  'ACCREDITATION_ADMIN',
  'SUPER_ADMIN',
];

export default function EvidenceExplorer() {
  const [projects, setProjects] = useState([]);
  const [allEvidence, setAllEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [comment, setComment] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('accrediguard_user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const canReview = REVIEWER_ROLES.includes(user?.role);

  async function loadEvidence() {
    try {
      setLoading(true);
      setError('');

      const projRes = await api.get('/projects');
      const projectList = projRes.data.data || [];
      setProjects(projectList);

      const collected = [];
      for (const project of projectList) {
        try {
          const detail = await api.get(`/projects/${project.id}`);
          const doc = detail.data.data?.documents?.[0];
          if (!doc) continue;

          const versionsRes = await api.get(`/documents/${doc.id}/versions`);
          const latest = (versionsRes.data.data || [])[0];
          if (!latest) continue;

          const analysisRes = await api.get(`/documents/${latest.id}/analysis`);
          (analysisRes.data.data?.evidence || []).forEach((evidence) => {
            collected.push({
              ...evidence,
              projectTitle: project.title,
              projectId: project.id,
            });
          });
        } catch (projectError) {
          console.warn(`Could not load evidence for project ${project.id}`, projectError);
        }
      }

      setAllEvidence(collected);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Unable to load evidence.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvidence();
  }, []);

  const filtered = useMemo(
    () => allEvidence.filter((e) =>
      (typeFilter === 'ALL' || e.evidence_type === typeFilter) &&
      (statusFilter === 'ALL' || e.review_status === statusFilter)
    ),
    [allEvidence, typeFilter, statusFilter]
  );

  const types = useMemo(
    () => Array.from(new Set(allEvidence.map((e) => e.evidence_type).filter(Boolean))),
    [allEvidence]
  );

  async function submitReview(decision) {
    if (!selectedEvidence) return;

    if (['REJECT', 'REQUEST_REVISION', 'PARTIAL'].includes(decision) && !comment.trim()) {
      setError('A reviewer comment is required for this decision.');
      return;
    }

    try {
      setReviewingId(selectedEvidence.id);
      setError('');
      setSuccess('');

      await api.post(`/reviews/${selectedEvidence.id}/review`, {
        decision,
        comment: comment.trim(),
      });

      setSuccess(`Evidence ${decision.replace(/_/g, ' ').toLowerCase()} successfully.`);
      setSelectedEvidence(null);
      setComment('');
      await loadEvidence();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Unable to submit the evidence review.');
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) return <div className="page-loading">Loading evidence…</div>;

  return (
    <div>
      <h1>Evidence Explorer</h1>
      <p className="subtitle">
        Every evidence item extracted across your accessible projects, with full provenance.
      </p>

      {error && <div className="card" style={{ color: '#b91c1c', background: '#fef2f2', marginBottom: 16 }}>{error}</div>}
      {success && <div className="card" style={{ color: '#166534', background: '#f0fdf4', marginBottom: 16 }}>{success}</div>}

      <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Evidence type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Review status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PARTIAL">Partial</option>
            <option value="NEEDS_HUMAN_REVIEW">Needs Human Review</option>
          </select>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">No evidence has been extracted yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Project</th><th>Page</th><th>Type</th><th>Quality</th><th>Confidence</th><th>Status</th>
                {canReview && <th>Review</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>{e.projectTitle}</td>
                  <td>{e.page_number}</td>
                  <td>{e.evidence_type}</td>
                  <td>{e.overall_quality}/100</td>
                  <td>{e.confidence}%</td>
                  <td><span className={`badge ${reviewStatusBadgeClass(e.review_status)}`}>{e.review_status.replace(/_/g, ' ')}</span></td>
                  {canReview && (
                    <td>
                      <button className="btn btn-primary" onClick={() => { setSelectedEvidence(e); setComment(''); setError(''); setSuccess(''); }}>
                        Review
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedEvidence && (
        <div className="card" style={{ marginTop: 20, border: '2px solid #1d4ed8' }}>
          <h2>Review Evidence</h2>
          <p><strong>Project:</strong> {selectedEvidence.projectTitle}</p>
          <p><strong>Page:</strong> {selectedEvidence.page_number}</p>
          <p><strong>Evidence Type:</strong> {selectedEvidence.evidence_type}</p>
          <p><strong>Quality:</strong> {selectedEvidence.overall_quality}/100</p>
          <p><strong>Confidence:</strong> {selectedEvidence.confidence}%</p>
          {selectedEvidence.section && <p><strong>Section:</strong> {selectedEvidence.section}</p>}

          <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 8, lineHeight: 1.6 }}>
            <strong>Extracted Evidence</strong>
            <p>{selectedEvidence.extracted_text || 'No extracted text available.'}</p>
          </div>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Reviewer Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your review comment..."
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn btn-primary" disabled={reviewingId === selectedEvidence.id} onClick={() => submitReview('APPROVE')}>Approve</button>
            <button className="btn" disabled={reviewingId === selectedEvidence.id} onClick={() => submitReview('PARTIAL')}>Partial</button>
            <button className="btn" disabled={reviewingId === selectedEvidence.id} onClick={() => submitReview('REQUEST_REVISION')}>Request Revision</button>
            <button className="btn" disabled={reviewingId === selectedEvidence.id} onClick={() => submitReview('REJECT')}>Reject</button>
            <button className="btn" disabled={reviewingId === selectedEvidence.id} onClick={() => { setSelectedEvidence(null); setComment(''); setError(''); }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 13, color: '#64748b' }}>
        AI-generated analysis is an assistive recommendation and does not constitute an official accreditation decision.
      </div>
    </div>
  );
}
