import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => { setProfile({ name: user?.name || '', email: user?.email || '' }); }, [user]);

  async function saveProfile(e) {
    e.preventDefault(); setProfileMsg(''); setSavingProfile(true);
    try {
      const res = await api.patch('/auth/profile', profile);
      updateUser(res.data.data);
      setProfileMsg('Profile updated successfully.');
    } catch (e2) { setProfileMsg(e2.response?.data?.message || 'Unable to update profile.'); }
    finally { setSavingProfile(false); }
  }

  async function savePassword(e) {
    e.preventDefault(); setPasswordMsg('');
    if (password.newPassword !== password.confirmPassword) { setPasswordMsg('New passwords do not match.'); return; }
    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', { currentPassword: password.currentPassword, newPassword: password.newPassword });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMsg('Password changed successfully.');
    } catch (e2) { setPasswordMsg(e2.response?.data?.message || 'Unable to change password.'); }
    finally { setSavingPassword(false); }
  }

  return <div>
    <h1>My Settings</h1>
    <p className="subtitle">Manage your account details and password. Your role is controlled by an administrator.</p>

    <div className="card">
      <h2>Profile</h2>
      <form onSubmit={saveProfile} className="form-grid">
        <label>Full name<input required value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label>
        <label>Email / username<input required type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} /></label>
        <div><label>Role</label><input value={user?.role?.replace(/_/g, ' ') || ''} disabled /></div>
        <div><label>Account status</label><input value={user?.isActive ? 'Active' : 'Deactivated'} disabled /></div>
        <button className="btn btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save Profile'}</button>
      </form>
      {profileMsg && <p style={{ marginTop: 12 }}>{profileMsg}</p>}
    </div>

    <div className="card">
      <h2>Change Password</h2>
      <p className="form-help">Enter your current password before choosing a new one. Minimum 8 characters.</p>
      <form onSubmit={savePassword} className="form-grid">
        <label>Current password<input required type="password" value={password.currentPassword} onChange={e => setPassword({ ...password, currentPassword: e.target.value })} /></label>
        <label>New password<input required type="password" minLength={8} value={password.newPassword} onChange={e => setPassword({ ...password, newPassword: e.target.value })} /></label>
        <label>Confirm new password<input required type="password" minLength={8} value={password.confirmPassword} onChange={e => setPassword({ ...password, confirmPassword: e.target.value })} /></label>
        <button className="btn btn-primary" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Change Password'}</button>
      </form>
      {passwordMsg && <p style={{ marginTop: 12 }}>{passwordMsg}</p>}
    </div>
  </div>;
}
