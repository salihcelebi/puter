import UserDashboard from '../components/dashboard/UserDashboard';
import AdminDashboard from '../components/dashboard/AdminDashboard';

export default function Dashboard() {
  const isAdmin = false; // TODO: Implement real role check

  return (
    <div className="p-6">
      {isAdmin ? <AdminDashboard /> : <UserDashboard />}
    </div>
  );
}
