import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ACCREDITATION_ADMIN'];
const emptyFramework = { name: '', description: '', isOfficial: false };
const emptyForm = {
  frameworkId: '', code: '', title: '', description: '', keywords: '', requiredSections: '', evidenceExpectations: '',
  minConfidence: 50, weightRelevance: 0.30, weightSpecificity: 0.20, weightCompleteness: 0.20, weightMeasurability: 0.15, weightTraceability: 0.15,
};

function csvToArray(value) {
  return String(value || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
}
function arrayToCsv(value) { return Array.isArray(value) ? value.join(', ') : ''; }

export default function Criteria() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const [frameworks, setFrameworks] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFrameworkForm, setShowFrameworkForm] = useState(false);
  const [frameworkForm, setFrameworkForm] = useState(emptyFramework);
  const [editingFrameworkId, setEditingFrameworkId] = useState(null);
  const [savingFramework, setSavingFramework] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const [fw, cr] = await Promise.all([api.get('/frameworks'), api.get('/criteria')]);
      setFrameworks(fw.data.data || []);
      setCriteria(cr.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load criteria.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => frameworks.map((fw) => ({ ...fw, criteria: criteria.filter((c) => c.framework_id === fw.id) })), [frameworks, criteria]);


  function openFrameworkCreate() {
    setEditingFrameworkId(null); setFrameworkForm(emptyFramework); setNotice(''); setError(''); setShowFrameworkForm(true);
  }
  function openFrameworkEdit(fw) {
    setEditingFrameworkId(fw.id); setFrameworkForm({ name: fw.name, description: fw.description || '', isOfficial: Boolean(fw.is_official) }); setNotice(''); setError(''); setShowFrameworkForm(true);
  }
  async function saveFramework(e) {
    e.preventDefault(); setSavingFramework(true); setError(''); setNotice('');
    try {
      const payload = { name: frameworkForm.name, description: frameworkForm.description, isOfficial: Boolean(frameworkForm.isOfficial) };
      if (editingFrameworkId) await api.patch(`/frameworks/${editingFrameworkId}`, payload);
      else await api.post('/frameworks', payload);
      await load(); setShowFrameworkForm(false); setFrameworkForm(emptyFramework); setEditingFrameworkId(null);
      setNotice(editingFrameworkId ? 'Framework updated successfully.' : 'Framework created successfully.');
    } catch (e2) { setError(e2.response?.data?.message || 'Unable to save framework.'); }
    finally { setSavingFramework(false); }
  }
  async function removeFramework(fw) {
    if (!window.confirm(`Delete framework “${fw.name}”?`)) return;
    setError(''); setNotice('');
    try { await api.delete(`/frameworks/${fw.id}`); await load(); setNotice('Framework deleted successfully.'); }
    catch (e) { setError(e.response?.data?.message || 'Unable to delete framework.'); }
  }

  function openCreate(frameworkId = frameworks[0]?.id || '') {
    setEditingId(null);
    setForm({ ...emptyForm, frameworkId });
    setNotice(''); setError(''); setShowForm(true);
  }

  function openEdit(c) {
    setEditingId(c.id);
    setForm({
      frameworkId: c.framework_id,
      code: c.code,
      title: c.title,
      description: c.description || '',
      keywords: arrayToCsv(c.keywords),
      requiredSections: arrayToCsv(c.required_sections),
      evidenceExpectations: arrayToCsv(c.evidence_expectations),
      minConfidence: c.min_confidence,
      weightRelevance: c.weight_relevance,
      weightSpecificity: c.weight_specificity,
      weightCompleteness: c.weight_completeness,
      weightMeasurability: c.weight_measurability,
      weightTraceability: c.weight_traceability,
    });
    setNotice(''); setError(''); setShowForm(true);
  }

  function updateField(name, value) { setForm((f) => ({ ...f, [name]: value })); }

  async function save(e) {
    e.preventDefault(); setSaving(true); setError(''); setNotice('');
    const payload = {
      frameworkId: form.frameworkId,
      code: form.code,
      title: form.title,
      description: form.description,
      keywords: csvToArray(form.keywords),
      requiredSections: csvToArray(form.requiredSections),
      evidenceExpectations: csvToArray(form.evidenceExpectations),
      minConfidence: Number(form.minConfidence),
      weightRelevance: Number(form.weightRelevance),
      weightSpecificity: Number(form.weightSpecificity),
      weightCompleteness: Number(form.weightCompleteness),
      weightMeasurability: Number(form.weightMeasurability),
      weightTraceability: Number(form.weightTraceability),
    };
    try {
      if (editingId) await api.patch(`/criteria/${editingId}`, payload);
      else await api.post('/criteria', payload);
      await load();
      setShowForm(false); setForm(emptyForm); setEditingId(null);
      setNotice(editingId ? 'Criterion updated successfully.' : 'Criterion created successfully.');
    } catch (e2) {
      setError(e2.response?.data?.message || 'Unable to save criterion.');
    } finally { setSaving(false); }
  }

  async function remove(c) {
    if (!window.confirm(`Delete ${c.code} — ${c.title}?`)) return;
    setError(''); setNotice('');
    try {
      await api.delete(`/criteria/${c.id}`);
      await load(); setNotice('Criterion deleted successfully.');
    } catch (e) { setError(e.response?.data?.message || 'Unable to delete criterion.'); }
  }

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1>Criteria</h1>
          <p className="subtitle">Configurable evidence expectations per accreditation/academic framework.</p>
        </div>
        {isAdmin && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-outline" onClick={openFrameworkCreate}>+ Create Framework</button><button className="btn btn-primary" onClick={() => openCreate()}>+ Create Criterion</button></div>}
      </div>

      {notice && <div className="card" style={{ borderColor: '#16a34a' }}>{notice}</div>}
      {error && <div className="card" style={{ borderColor: '#dc2626' }}>{error}</div>}

      {isAdmin && showFrameworkForm && (
        <form className="card" onSubmit={saveFramework}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{editingFrameworkId ? 'Edit Framework' : 'Create Framework'}</h2>
            <button type="button" className="btn btn-outline" onClick={() => setShowFrameworkForm(false)}>Cancel</button>
          </div>
          <p className="form-help">Framework management is available to Super Admin and Accreditation Admin.</p>
          <div className="form-grid">
            <div className="form-group"><label>Framework name</label><input required maxLength="200" value={frameworkForm.name} onChange={(e) => setFrameworkForm((f) => ({ ...f, name: e.target.value }))} placeholder="NBA, NAAC, ABET, etc." /></div>
            <div className="form-group"><label>Official framework</label><select value={frameworkForm.isOfficial ? 'true' : 'false'} onChange={(e) => setFrameworkForm((f) => ({ ...f, isOfficial: e.target.value === 'true' }))}><option value="false">No</option><option value="true">Yes</option></select></div>
          </div>
          <div className="form-group"><label>Description</label><textarea rows="3" value={frameworkForm.description} onChange={(e) => setFrameworkForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the accreditation framework and its purpose." /></div>
          <button className="btn btn-primary" disabled={savingFramework}>{savingFramework ? 'Saving…' : editingFrameworkId ? 'Update Framework' : 'Create Framework'}</button>
        </form>
      )}

      {isAdmin && showForm && (
        <form className="card" onSubmit={save}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{editingId ? 'Edit Criterion' : 'Create Criterion'}</h2>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <p className="form-help">Only Super Admin and Accreditation Admin can create or modify criteria. Scoring weights must total 1.00.</p>
          <div className="form-grid">
            <div className="form-group"><label>Framework</label><select required value={form.frameworkId} onChange={(e) => updateField('frameworkId', e.target.value)} disabled={!!editingId}><option value="">Select framework</option>{frameworks.map((fw) => <option key={fw.id} value={fw.id}>{fw.name}</option>)}</select></div>
            <div className="form-group"><label>Code</label><input required value={form.code} onChange={(e) => updateField('code', e.target.value)} placeholder="C11" /></div>
            <div className="form-group"><label>Title</label><input required value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="Criterion title" /></div>
            <div className="form-group"><label>Minimum confidence</label><input type="number" min="0" max="100" value={form.minConfidence} onChange={(e) => updateField('minConfidence', e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Description</label><textarea rows="2" value={form.description} onChange={(e) => updateField('description', e.target.value)} /></div>
          <div className="form-grid">
            <div className="form-group"><label>Keywords</label><textarea rows="3" required value={form.keywords} onChange={(e) => updateField('keywords', e.target.value)} placeholder="security, authentication, authorization" /><span className="form-help">Comma or newline separated.</span></div>
            <div className="form-group"><label>Required sections</label><textarea rows="3" required value={form.requiredSections} onChange={(e) => updateField('requiredSections', e.target.value)} placeholder="Security, Implementation" /></div>
            <div className="form-group"><label>Evidence expectations</label><textarea rows="3" required value={form.evidenceExpectations} onChange={(e) => updateField('evidenceExpectations', e.target.value)} placeholder="authentication evidence, authorization evidence" /></div>
          </div>
          <h3>Quality weights</h3>
          <div className="form-grid">
            {['Relevance','Specificity','Completeness','Measurability','Traceability'].map((label) => { const key = `weight${label}`; return <div className="form-group" key={key}><label>{label}</label><input type="number" min="0" max="1" step="0.01" value={form[key]} onChange={(e) => updateField(key, e.target.value)} /></div>; })}
          </div>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Criterion' : 'Create Criterion'}</button>
        </form>
      )}

      {grouped.map((fw) => (
        <div className="card" key={fw.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div><h2>{fw.name} {fw.is_official && <span className="badge badge-green">Official</span>}</h2><p className="form-help">{fw.description}</p></div>
            {isAdmin && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-outline" onClick={() => openFrameworkEdit(fw)}>Edit Framework</button><button className="btn btn-outline" onClick={() => removeFramework(fw)}>Delete Framework</button><button className="btn btn-outline" onClick={() => openCreate(fw.id)}>+ Add Criterion</button></div>}
          </div>
          {fw.criteria.length === 0 ? <div className="empty-state">No criteria configured for this framework.</div> : (
            <table><thead><tr><th>Code</th><th>Title</th><th>Required Sections</th><th>Evidence Expectations</th>{isAdmin && <th>Actions</th>}</tr></thead><tbody>
              {fw.criteria.map((c) => <tr key={c.id}><td><strong>{c.code}</strong></td><td>{c.title}<div className="form-help">{c.description}</div></td><td>{c.required_sections.join(', ')}</td><td>{c.evidence_expectations.join(', ')}</td>{isAdmin && <td><button className="btn btn-outline" onClick={() => openEdit(c)}>Edit</button>{' '}<button className="btn btn-outline" onClick={() => remove(c)}>Delete</button></td>}</tr>)}
            </tbody></table>
          )}
        </div>
      ))}
    </div>
  );
}
