import { useEffect, useState } from "react";
import { listAllUsers, createUserAdmin, updateUserAdmin, updateUserRoleAdmin, deleteUserAdmin } from "../util/api";
import BackArrow from "../components/BackArrow";
import './AdminUsers.css'

type User = {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // New user form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<'student'|'teacher'|'admin'>('student');

  useEffect(() => {
    fetchUsers();
  }, []);

  // Determine currently logged-in user (from localStorage) so we can prevent self-delete
  const stored = localStorage.getItem('user');
  const currentUser = stored ? JSON.parse(stored) : null;
  const currentUserId: number | null = currentUser ? currentUser.id : null;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await listAllUsers();
      setUsers(data || []);
      setPage(1);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUserAdmin(newName, newEmail, newPassword, newRole, true);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('student');
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Create failed');
    }
  }

  const handleSave = async (userId: number, updated: Partial<User>) => {
    try {
      const payload: { name?: string; email?: string } = {};
      if (updated.name !== undefined) payload.name = updated.name;
      if (updated.email !== undefined) payload.email = updated.email;
      if (Object.keys(payload).length > 0) await updateUserAdmin(userId, payload);
      if (updated.role) {
        await updateUserRoleAdmin(userId, updated.role);
      }
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Update failed');
    }
  }

  const handleDelete = async (userId: number) => {
    try {
      await deleteUserAdmin(userId);
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cannot delete user: related records exist/i.test(msg) || /related records exist \(reviews, submissions, etc\./i.test(msg)) {
        setError(`Cannot delete user because related records exist (reviews, submissions, group memberships, or course links).

    Suggested actions:
    - Reassign or delete the related records (reviews/submissions) before deleting the user.
    - If the user is a teacher, reassign their courses to another teacher first.`);
      } else if (/cannot delete teacher/i.test(msg) || /assigned to one or more courses/i.test(msg)) {
        setError('Cannot delete teacher: this account still owns one or more courses. Reassign or delete those courses before deleting the teacher.');
      } else if (/cannot delete your own account/i.test(msg)) {
          setError('Cannot delete the account you are currently signed in with. Log in as a different admin to remove this account.');
      } else {
        setError(msg || 'Delete failed');
      }
    }
  }

  return (
    <div className="AdminUsers Page">
      <BackArrow />
      <h1>Admin — Manage Users</h1>

      {error && <div className="Error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}

      <div className="admin-controls">
        <input placeholder="Search name, email or role" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <label>
          Show
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          per page
        </label>
        <div className="admin-total-count">{users.length} total users</div>
      </div>

      <section className="NewUser">
        <h2>Create new user</h2>
        <form onSubmit={handleCreate}>
          <input placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} required />
          <input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
          <input placeholder="Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
          <select value={newRole} onChange={e => setNewRole(e.target.value as User['role'])}>
            <option value="student">student</option>
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>
          <button type="submit">Create</button>
        </form>
      </section>

      <section className="UsersList">
        <h2>Existing users</h2>
        {loading ? <p className="PageStatusText">Loading…</p> : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const q = search.trim().toLowerCase();
                const filtered = users.filter(u => {
                  if (!q) return true;
                  return (
                    u.name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    u.role.toLowerCase().includes(q)
                  );
                });
                const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
                const normalizedPage = Math.min(Math.max(1, page), totalPages);
                const start = (normalizedPage - 1) * pageSize;
                const pageItems = filtered.slice(start, start + pageSize);
                return (
                  <>
                    {pageItems.map((u) => (
                      <UserRow key={u.id} user={u} currentUserId={currentUserId} onSave={handleSave} onDelete={handleDelete} />
                    ))}
                    {pageItems.length === 0 && (
                      <tr><td colSpan={5}>No users match your search.</td></tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        )}
        {!loading && users.length > 0 && (
          (() => {
            const q = search.trim().toLowerCase();
            const filtered = users.filter(u => {
              if (!q) return true;
              return (
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                u.role.toLowerCase().includes(q)
              );
            });
            const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
            return (
              <div className="admin-pagination">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
              </div>
            );
          })()
        )}
      </section>
    </div>
  )
}

function UserRow({ user, onSave, onDelete, currentUserId }: { user: User; onSave: (id: number, upd: Partial<User>) => void; onDelete: (id: number) => void; currentUserId: number | null }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<User['role']>(user.role);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
  }, [user]);

  return (
    <tr>
      <td>{user.id}</td>
      <td>{editing ? <input value={name} onChange={e => setName(e.target.value)} /> : (<>{name}{currentUserId === user.id ? ' (you)' : ''}</>)}</td>
      <td>{editing ? <input value={email} onChange={e => setEmail(e.target.value)} /> : email}</td>
      <td>{editing ? (
        <select value={role} onChange={e => setRole(e.target.value as User['role'])}>
          <option value="student">student</option>
          <option value="teacher">teacher</option>
          <option value="admin">admin</option>
        </select>
      ) : role}</td>
      <td>
        {editing ? (
          <>
            <button onClick={() => { onSave(user.id, { name, email, role }); setEditing(false); }}>Save</button>
            <button onClick={() => { setEditing(false); setName(user.name); setEmail(user.email); setRole(user.role); }}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)}>Edit</button>
            {currentUserId === user.id ? (
              <button disabled title="Cannot delete your own account">Delete</button>
            ) : (
              <button onClick={() => onDelete(user.id)}>Delete</button>
            )}
          </>
        )}
      </td>
    </tr>
  )
}
