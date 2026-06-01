import { useState } from 'react';
import { createUser, createDoc, checkUserExists } from '../api/frappe';

const commonPasswords = ['password', '123456', '12345678', 'qwerty', 'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'login', 'abc123', 'passw0rd'];

const getPasswordError = (pw) => {
  if (pw.length < 6) return 'Password must be at least 6 characters';
  if (commonPasswords.includes(pw.toLowerCase())) return 'This password is too common. Choose a stronger one.';
  if (pw === pw.toLowerCase()) return 'Add at least one uppercase letter for a stronger password.';
  if (pw === pw.toUpperCase()) return 'Add at least one lowercase letter for a stronger password.';
  if (!/\d/.test(pw)) return 'Add at least one number for a stronger password.';
  if (!/[^a-zA-Z0-9]/.test(pw)) return 'Add at least one special character for a stronger password.';
  return null;
};

const roleOptions = ['Principal', 'Instructor', 'Accountant'];

export default function UserModal({ show, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    mobile_no: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!show) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.first_name || !formData.password || !formData.role) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const pwError = getPasswordError(formData.password);
    if (pwError) {
      setError(pwError);
      return;
    }

    setLoading(true);
    try {
      const exists = await checkUserExists(formData.email);
      if (exists) {
        setError('A user with this email already exists');
        setLoading(false);
        return;
      }

      await createUser({
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        mobile_no: formData.mobile_no,
        password: formData.password,
        roles: [{ role: formData.role }],
      });

      if (formData.role === 'Instructor') {
        await createDoc('Instructor', {
          instructor_name: `${formData.first_name} ${formData.last_name}`.trim(),
          user: formData.email,
        }).catch(() => {});
      }

      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        mobile_no: '',
        password: '',
        confirmPassword: '',
        role: '',
      });
      onSuccess();
    } catch (err) {
      const msg = err.readableMessage || err.message || 'Failed to create user';
      if (msg.includes('already exists') || msg.includes('Duplicate entry')) {
        setError('A user with this email already exists');
      } else if (msg.includes('password') && (msg.includes('common') || msg.includes('weak'))) {
        setError('Password is too weak. Use a mix of uppercase, lowercase, numbers, and special characters.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#1e293b]">Add New User</h2>
          <button onClick={onClose} className="p-2 text-[#475569] hover:text-[#1e293b] transition-colors cursor-pointer group">
            <span className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center transition-all duration-300 group-hover:bg-black/10">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl text-sm bg-red-50 text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-2">Email <span className="text-red-500">*</span></label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="input" placeholder="user@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-2">Role <span className="text-red-500">*</span></label>
              <select name="role" value={formData.role} onChange={handleChange} className="input" required>
                <option value="">Select Role</option>
                {roleOptions.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-2">First Name <span className="text-red-500">*</span></label>
              <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="input" placeholder="John" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-2">Last Name</label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="input" placeholder="Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-2">Mobile Number</label>
              <input type="tel" name="mobile_no" value={formData.mobile_no} onChange={handleChange} className="input" placeholder="+91 9876543210" />
            </div>
            <div />
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-2">Password <span className="text-red-500">*</span></label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} className="input" placeholder="Min 6 chars, uppercase, number, special char" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-2">Confirm Password <span className="text-red-500">*</span></label>
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="input" placeholder="Re-enter password" required />
            </div>
          </div>
          <div className="flex items-center justify-end pt-4 border-t border-gray-100">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-50 group">
              {loading && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
