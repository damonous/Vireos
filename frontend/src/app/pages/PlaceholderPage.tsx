import { Bell } from 'lucide-react';
import { Card } from '../components/ui/card';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex-1 overflow-auto">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Pinnacle Financial</span>
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>

      <div className="p-8">
        <Card className="p-12 rounded-lg shadow-sm border border-gray-200 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-[#0EA5E9] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🚀</span>
            </div>
            <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2">{title}</h2>
            <p className="text-gray-600">{description}</p>
            <p className="text-sm text-gray-500 mt-4">This feature is coming soon!</p>
          </div>
        </Card>
      </div>
    </div>
  );
}