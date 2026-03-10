import { CreditCard, Download, Check, Zap, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const invoices = [
  { date: 'Jan 1, 2026', description: 'Professional Plan', amount: 299, status: 'Paid' },
  { date: 'Dec 1, 2025', description: 'Professional Plan', amount: 299, status: 'Paid' },
  { date: 'Nov 1, 2025', description: 'Professional Plan', amount: 299, status: 'Paid' },
  { date: 'Oct 1, 2025', description: 'Professional Plan', amount: 299, status: 'Paid' },
];

const planFeatures = [
  'AI Content Generation',
  'LinkedIn Outreach',
  'Facebook Ads',
  'Prospect Finder',
  'Email Campaigns',
  'Analytics',
  '1 User',
];

export default function Billing() {
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Billing & Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your subscription and payment methods</p>
        </div>
      </div>

      <div className="p-8">
        {/* Current Plan Card */}
        <Card className="p-6 rounded-lg shadow-sm border-2 border-[#0EA5E9] bg-gradient-to-br from-blue-50 to-white mb-8 max-w-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-[#0EA5E9]" />
                <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-wide">Current Plan</span>
              </div>
              <h3 className="text-2xl font-semibold text-[#1E3A5F]">Professional Plan</h3>
              <p className="text-3xl font-bold text-[#1E3A5F] mt-2">
                $299<span className="text-lg font-normal text-gray-600">/month</span>
              </p>
            </div>
          </div>

          <div className="my-6 border-t border-gray-200 pt-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">Plan includes:</p>
            <ul className="space-y-2">
              {planFeatures.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <Button className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white mt-4">
            <TrendingUp className="w-4 h-4 mr-2" />
            Upgrade to Enterprise
          </Button>
        </Card>

        {/* Payment Method Section */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Payment Method</h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                <CreditCard className="w-6 h-6 text-[#1E3A5F]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-[#1E3A5F]">Visa ending in ****4242</p>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Primary</span>
                </div>
                <p className="text-sm text-gray-600">Expires 04/27</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Update Payment
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
            <svg className="w-16 h-5" viewBox="0 0 64 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M13.3 6.9c-.2-1-.9-1.7-1.9-1.7-.4 0-.8.1-1.1.3-.3.2-.4.5-.4.8 0 .4.2.6.6.8.4.2 1 .3 1.7.5 1.1.3 2 .7 2.7 1.3.7.6 1 1.5 1 2.6 0 1.1-.4 2-1.2 2.7-.8.7-1.9 1-3.3 1-2 0-3.4-.8-4.2-2.5l2.3-1c.2.5.5.9.9 1.2.4.3.9.4 1.4.4.5 0 .9-.1 1.2-.3.3-.2.5-.5.5-.9 0-.3-.2-.6-.5-.8-.3-.2-.8-.4-1.5-.6-1.2-.3-2.1-.7-2.8-1.3-.7-.6-1-1.4-1-2.5 0-1.1.4-2 1.1-2.7.8-.7 1.8-1 3.1-1 1.8 0 3.1.7 3.9 2.2l-2.2 1z"
                fill="#6B7C93"
              />
              <path
                d="M19.5 3.5v2.4h2v2.3h-2v4.3c0 .4.1.7.2.9.2.2.4.3.8.3.3 0 .6 0 .9-.1v2.4c-.6.2-1.2.2-1.8.2-1 0-1.8-.3-2.3-.8-.6-.5-.8-1.3-.8-2.3V8.2h-1.7V5.9h.5c.5 0 .9-.2 1.1-.5.2-.3.4-.7.4-1.2V3.5h2.7z"
                fill="#6B7C93"
              />
              <path
                d="M25.9 5.7c.5 0 1 .1 1.4.2V8c-.4-.2-.9-.3-1.4-.3-1.3 0-2 .8-2 2.3v5.7h-2.8V5.9h2.7v1.3c.5-.9 1.3-1.4 2.3-1.5h.2-.4z"
                fill="#6B7C93"
              />
              <path
                d="M29 2.5c0-.4.1-.8.4-1 .3-.3.6-.4 1-.4s.7.1 1 .4c.3.3.4.6.4 1s-.1.8-.4 1c-.3.3-.6.4-1 .4s-.7-.1-1-.4c-.3-.2-.4-.6-.4-1zm.1 3.4h2.8v9.8h-2.8V5.9z"
                fill="#6B7C93"
              />
              <path
                d="M35.9 5.7c1 0 1.8.3 2.4.9.6.6.9 1.5.9 2.6v6.5h-2.7v-1c-.6.8-1.4 1.2-2.6 1.2-1.5 0-2.6-.7-3.2-2.2-.2-.5-.3-1.1-.3-1.7 0-1.2.4-2.1 1.2-2.8.8-.7 1.9-1 3.3-1 .7 0 1.3.1 1.9.3v-.3c0-.5-.2-.9-.5-1.2-.3-.3-.8-.5-1.4-.5-.9 0-1.6.4-2 1.1l-2.4-1.3c.9-1.5 2.3-2.3 4.4-2.3v-.3zm-1.5 7.9c.4 0 .8-.1 1.1-.4.3-.3.5-.6.5-1.1-.5-.3-1.1-.4-1.6-.4-.5 0-.9.1-1.2.3-.3.2-.4.5-.4.9s.2.6.4.8c.3.1.7.2 1.2.2v-.3z"
                fill="#6B7C93"
              />
              <path
                d="M48.4 10.8c0 1.5-.5 2.8-1.5 3.8-1 1-2.3 1.5-3.9 1.5-1.6 0-2.9-.5-3.9-1.5-1-1-1.5-2.3-1.5-3.8 0-1.5.5-2.8 1.5-3.8 1-1 2.3-1.5 3.9-1.5 1.6 0 2.9.5 3.9 1.5 1 1 1.5 2.3 1.5 3.8zm-7.1 2.3c.5.5 1.2.8 2 .8s1.5-.3 2-.8c.5-.5.8-1.2.8-2.3s-.3-1.8-.8-2.3c-.5-.5-1.2-.8-2-.8s-1.5.3-2 .8c-.5.5-.8 1.2-.8 2.3s.3 1.8.8 2.3z"
                fill="#6B7C93"
              />
              <path
                d="M52 15.7h-2.8V5.9h2.7v1.3c.6-1 1.5-1.5 2.8-1.5 1 0 1.9.4 2.5 1.1.6.7.9 1.7.9 2.9v6h-2.8V9.2c0-.6-.2-1-.5-1.3-.3-.3-.7-.5-1.3-.5-.6 0-1 .2-1.3.6-.3.4-.5.9-.5 1.6v6.1h.3z"
                fill="#6B7C93"
              />
            </svg>
            <span className="text-xs text-gray-500">Powered by Stripe</span>
          </div>
        </Card>

        {/* Invoice History */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Invoice History</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4 text-sm text-gray-700">{invoice.date}</td>
                      <td className="py-4 px-4 text-sm text-[#1E3A5F] font-medium">{invoice.description}</td>
                      <td className="py-4 px-4 text-sm text-gray-700">${invoice.amount}</td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          <Check className="w-3 h-3" />
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                          <Download className="w-4 h-4 text-gray-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}