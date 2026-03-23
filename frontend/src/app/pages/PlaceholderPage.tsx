import { Card } from '../components/ui/card';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex-1 overflow-auto">
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