import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  lastLoginAt?: string | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function PlatformUsers() {
  const users = useApiData<PlatformUser[]>('/admin/users?page=1&limit=100');
  const rows = users.data ?? [];

  if (users.loading) return <LoadingState label="Loading platform users..." />;
  if (users.error) return <ErrorState message={users.error} onRetry={() => void users.reload()} />;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Platform Users</h1>
          <p className="text-sm text-gray-500 mt-1">Live user directory across all organizations</p>
        </div>
      </div>

      <div className="p-8">
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10">
              <EmptyState title="No users found" description="Platform users will appear here once users have registered." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-[#1E3A5F]">{user.firstName} {user.lastName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.role}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.organization?.name ?? 'No organization'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
