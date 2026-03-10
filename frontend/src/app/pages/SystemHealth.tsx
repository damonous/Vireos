import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  uptime: string;
  responseTime: string;
  note?: string;
}

const services: ServiceStatus[] = [
  {
    name: 'API Gateway',
    status: 'operational',
    uptime: '99.98%',
    responseTime: '142ms',
  },
  {
    name: 'Database (PostgreSQL)',
    status: 'operational',
    uptime: '99.95%',
    responseTime: '28ms',
  },
  {
    name: 'Stripe Payments',
    status: 'operational',
    uptime: '99.99%',
    responseTime: '210ms',
  },
  {
    name: 'SendGrid Email',
    status: 'operational',
    uptime: '99.87%',
    responseTime: '445ms',
  },
  {
    name: 'LinkedIn API',
    status: 'degraded',
    uptime: '97.2%',
    responseTime: '1,240ms',
    note: 'Rate limiting in effect',
  },
  {
    name: 'Redis Cache',
    status: 'operational',
    uptime: '100%',
    responseTime: '3ms',
  },
];

// 24 hours of API response time data (hourly)
const responseTimeData = [
  { hour: '00:00', ms: 145 },
  { hour: '01:00', ms: 138 },
  { hour: '02:00', ms: 142 },
  { hour: '03:00', ms: 155 },
  { hour: '04:00', ms: 148 },
  { hour: '05:00', ms: 152 },
  { hour: '06:00', ms: 168 },
  { hour: '07:00', ms: 195 },
  { hour: '08:00', ms: 220 },
  { hour: '09:00', ms: 245 },
  { hour: '10:00', ms: 210 },
  { hour: '11:00', ms: 190 },
  { hour: '12:00', ms: 185 },
  { hour: '13:00', ms: 175 },
  { hour: '14:00', ms: 800 }, // LinkedIn degradation spike
  { hour: '15:00', ms: 420 },
  { hour: '16:00', ms: 280 },
  { hour: '17:00', ms: 240 },
  { hour: '18:00', ms: 210 },
  { hour: '19:00', ms: 185 },
  { hour: '20:00', ms: 165 },
  { hour: '21:00', ms: 155 },
  { hour: '22:00', ms: 150 },
  { hour: '23:00', ms: 142 },
];

interface Incident {
  id: number;
  dateTime: string;
  service: string;
  severity: 'warning' | 'minor' | 'major';
  description: string;
  duration: string;
  status: 'open' | 'resolved';
}

const incidents: Incident[] = [
  {
    id: 1,
    dateTime: 'Feb 27, 2:15 PM',
    service: 'LinkedIn API',
    severity: 'warning',
    description: 'Rate limit threshold reached (80%)',
    duration: 'Ongoing',
    status: 'open',
  },
  {
    id: 2,
    dateTime: 'Feb 26, 11:30 AM',
    service: 'SendGrid',
    severity: 'minor',
    description: 'Email delivery delay 5-10 min',
    duration: '45 min',
    status: 'resolved',
  },
  {
    id: 3,
    dateTime: 'Feb 24, 3:00 AM',
    service: 'API Gateway',
    severity: 'major',
    description: 'Increased error rate (2.1%)',
    duration: '18 min',
    status: 'resolved',
  },
  {
    id: 4,
    dateTime: 'Feb 20, 8:45 PM',
    service: 'Database',
    severity: 'minor',
    description: 'Slow query alert',
    duration: '12 min',
    status: 'resolved',
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'operational':
      return {
        icon: CheckCircle,
        text: 'Operational',
        className: 'bg-green-100 text-green-700',
        iconColor: 'text-green-600',
      };
    case 'degraded':
      return {
        icon: AlertTriangle,
        text: 'Degraded',
        className: 'bg-yellow-100 text-yellow-700',
        iconColor: 'text-yellow-600',
      };
    case 'down':
      return {
        icon: XCircle,
        text: 'Down',
        className: 'bg-red-100 text-red-700',
        iconColor: 'text-red-600',
      };
    default:
      return {
        icon: CheckCircle,
        text: 'Unknown',
        className: 'bg-gray-100 text-gray-700',
        iconColor: 'text-gray-600',
      };
  }
};

const getSeverityBadge = (severity: string) => {
  const colors = {
    warning: 'bg-orange-100 text-orange-700',
    minor: 'bg-yellow-100 text-yellow-700',
    major: 'bg-red-100 text-red-700',
  };
  return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-700';
};

const getIncidentStatusBadge = (status: string) => {
  return status === 'open'
    ? 'bg-orange-100 text-orange-700'
    : 'bg-green-100 text-green-700';
};

export default function SystemHealth() {
  const navigate = useNavigate();
  
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">System Health</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor platform infrastructure and services</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Last updated: just now</span>
            <Button className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Service Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {services.map((service) => {
            const statusInfo = getStatusBadge(service.status);
            const StatusIcon = statusInfo.icon;
            const isDegraded = service.status === 'degraded';
            return (
              <Card 
                key={service.name} 
                className={`p-6 rounded-lg shadow-sm border border-gray-200 ${isDegraded ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={isDegraded ? () => navigate('/super-admin/flags') : undefined}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-base font-semibold text-[#1E3A5F]">{service.name}</h3>
                  <StatusIcon className={`w-5 h-5 ${statusInfo.iconColor}`} />
                </div>
                <div className="mb-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${statusInfo.className}`}>
                    {statusInfo.text}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium">{service.uptime}</span> uptime
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">{service.responseTime}</span> avg
                  </p>
                  {service.note && (
                    <p className="text-orange-600 font-medium mt-2">{service.note}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* API Response Time Chart */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">
            API Response Time (Last 24 Hours)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={responseTimeData}>
              <defs>
                <linearGradient id="colorMs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} interval={2} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="ms"
                stroke="#0EA5E9"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMs)"
                name="Response Time (ms)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Incident Log */}
        <Card className="rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Incident Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {incidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {incident.dateTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E3A5F]">
                      {incident.service}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getSeverityBadge(incident.severity)}`}>
                        {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {incident.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {incident.duration}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getIncidentStatusBadge(incident.status)}`}>
                        {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}