import { useMemo, useState } from 'react';
import { Check, CreditCard, ExternalLink, Minus, Plus, Receipt, Users, Wallet } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api-client';

interface PlanResponse {
  plans: Array<{
    id: string;
    name: string;
    priceId: string;
    amount: number;
    features: string[];
  }>;
  bundles: Array<{
    id: string;
    label: string;
    credits: number;
    amount: number;
  }>;
  pricing?: {
    baseAmount: number;
    seatAmount: number;
    contactAmount: number;
    includedSeats: number;
    freeContacts: number;
  };
}

interface SubscriptionRecord {
  id: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface CreditBalanceResponse {
  balance: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
}

interface UsageSummary {
  seats: { used: number; limit: number; additionalAvailable: number };
  contacts: { total: number; freeLimit: number; overage: number; isFirstYear: boolean };
}

interface InvoiceRecord {
  id: string;
  created: number;
  status: string | null;
  amount_paid: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  number: string | null;
}

function formatMoney(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCents(amount: number, currency = 'usd'): string {
  return formatMoney(amount / 100, currency);
}

export default function Billing() {
  const { user } = useAuth();
  const plans = useApiData<PlanResponse>('/billing/plans');
  const subscription = useApiData<SubscriptionRecord | null>('/billing/subscription');
  const creditBalance = useApiData<CreditBalanceResponse>('/billing/credits/balance');
  const invoices = useApiData<InvoiceRecord[]>('/billing/invoices');
  const usage = useApiData<UsageSummary>('/billing/usage');
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [additionalSeats, setAdditionalSeats] = useState(0);
  const statusMessage = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') === 'required') return 'Choose a subscription plan to complete onboarding and unlock the workspace.';
    if (params.get('required') === 'subscription') return 'An active subscription is required before you can access the rest of the application.';
    if (params.get('checkout') === 'success') return 'Checkout completed successfully. Your subscription will be updated shortly.';
    if (params.get('checkout') === 'cancelled') return 'Checkout was cancelled before completion.';
    if (params.get('portal') === 'returned') return 'Returned from the billing portal.';
    return null;
  }, []);

  const isLoading =
    plans.loading || subscription.loading || creditBalance.loading || invoices.loading || usage.loading;
  const error = plans.error || subscription.error || creditBalance.error || invoices.error || usage.error;

  if (isLoading) {
    return <LoadingState label="Loading billing..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          void plans.reload();
          void subscription.reload();
          void creditBalance.reload();
          void invoices.reload();
          void usage.reload();
        }}
      />
    );
  }

  const planList = plans.data?.plans ?? [];
  const bundleList = plans.data?.bundles ?? [];
  const pricing = plans.data?.pricing;
  const currentSubscription = subscription.data;
  const hasSubscription = !!currentSubscription;
  const balance = creditBalance.data?.balance ?? 0;
  const transactions = creditBalance.data?.transactions ?? [];
  const invoiceRows = invoices.data ?? [];
  const usageData = usage.data;
  const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  const baseAmount = pricing?.baseAmount ?? 29900;
  const seatAmount = pricing?.seatAmount ?? 5000;
  const totalAmount = baseAmount + additionalSeats * seatAmount;

  const runBillingAction = async (
    actionKey: string,
    request: () => Promise<{ url: string }>
  ) => {
    setProcessingAction(actionKey);
    setActionError(null);
    try {
      const result = await request();
      window.location.assign(result.url);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Billing action failed.');
    } finally {
      setProcessingAction(null);
    }
  };

  const platformPlan = planList[0];

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Billing & Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">Live billing state, credits, and Stripe invoice history</p>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {statusMessage ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {statusMessage}
          </div>
        ) : null}
        {actionError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        {/* Usage Summary */}
        {usageData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="p-5 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-[#0EA5E9]" />
                <p className="text-sm font-semibold text-gray-700">Seats Used</p>
              </div>
              <p className="text-3xl font-bold text-[#1E3A5F]">
                {usageData.seats.used} <span className="text-lg font-normal text-gray-400">/ {usageData.seats.limit}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">{usageData.seats.additionalAvailable} available</p>
            </Card>
            <Card className="p-5 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="w-5 h-5 text-[#0EA5E9]" />
                <p className="text-sm font-semibold text-gray-700">Contacts</p>
              </div>
              <p className="text-3xl font-bold text-[#1E3A5F]">
                {usageData.contacts.total.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {usageData.contacts.isFirstYear
                  ? `${usageData.contacts.freeLimit.toLocaleString()} free (first year)`
                  : 'Free contacts expired'}
                {usageData.contacts.overage > 0 ? ` | ${usageData.contacts.overage.toLocaleString()} overage` : ''}
              </p>
            </Card>
            <Card className="p-5 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <Wallet className="w-5 h-5 text-[#0EA5E9]" />
                <p className="text-sm font-semibold text-gray-700">Credit Balance</p>
              </div>
              <p className="text-3xl font-bold text-[#1E3A5F]">{balance.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Available credits</p>
            </Card>
            <Card className="p-5 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <Receipt className="w-5 h-5 text-[#0EA5E9]" />
                <p className="text-sm font-semibold text-gray-700">Status</p>
              </div>
              <p className="text-xl font-bold text-[#1E3A5F]">
                {currentSubscription?.status ?? user?.organization?.subscriptionStatus ?? 'TRIALING'}
              </p>
              {currentSubscription?.currentPeriodEnd ? (
                <p className="text-xs text-gray-500 mt-1">
                  Renews {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              ) : null}
            </Card>
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Plan Card */}
          <Card className="p-6 rounded-lg shadow-sm border-2 border-[#0EA5E9] bg-gradient-to-br from-blue-50 to-white xl:col-span-2">
            <div className="flex items-start justify-between gap-6 mb-6">
              <div>
                <p className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-wide mb-2">
                  {hasSubscription ? 'Current Plan' : 'Subscribe'}
                </p>
                <h3 className="text-2xl font-semibold text-[#1E3A5F]">
                  {platformPlan?.name ?? 'Vireos Platform'}
                </h3>
                <p className="text-3xl font-bold text-[#1E3A5F] mt-2">
                  {formatCents(baseAmount)}/month
                </p>
                <p className="text-sm text-gray-500 mt-1">Includes {pricing?.includedSeats ?? 3} users</p>
              </div>
              <div className="w-14 h-14 bg-white rounded-xl border border-blue-100 flex items-center justify-center">
                <CreditCard className="w-7 h-7 text-[#0EA5E9]" />
              </div>
            </div>

            {platformPlan ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
                <ul className="space-y-2">
                  {platformPlan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!hasSubscription && isAdmin ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Additional Seats</p>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdditionalSeats(Math.max(0, additionalSeats - 1))}
                      disabled={additionalSeats === 0}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="text-2xl font-bold text-[#1E3A5F] w-12 text-center">{additionalSeats}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdditionalSeats(additionalSeats + 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-gray-500">
                      {additionalSeats > 0 ? `+${formatCents(additionalSeats * seatAmount)}/mo` : 'No additional seats'}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Base platform ({pricing?.includedSeats ?? 3} users)</span>
                      <span className="font-medium text-[#1E3A5F]">{formatCents(baseAmount)}/mo</span>
                    </div>
                    {additionalSeats > 0 ? (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">{additionalSeats} additional seat{additionalSeats > 1 ? 's' : ''}</span>
                        <span className="font-medium text-[#1E3A5F]">{formatCents(additionalSeats * seatAmount)}/mo</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-base font-semibold mt-2 pt-2 border-t border-gray-100">
                      <span className="text-[#1E3A5F]">Total</span>
                      <span className="text-[#0EA5E9]">{formatCents(totalAmount)}/mo</span>
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                  onClick={() => void runBillingAction('checkout', () => apiClient.post('/billing/checkout', { additionalSeats }))}
                  disabled={processingAction === 'checkout'}
                >
                  {processingAction === 'checkout' ? 'Redirecting...' : `Subscribe — ${formatCents(totalAmount)}/mo`}
                </Button>
              </div>
            ) : null}

            {hasSubscription && isAdmin ? (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => void runBillingAction('portal', () => apiClient.post('/billing/portal'))}
                  disabled={processingAction === 'portal'}
                >
                  {processingAction === 'portal' ? 'Opening...' : 'Open Billing Portal'}
                </Button>
              </div>
            ) : null}

            {!isAdmin ? (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  You have read-only access to billing details for this organization.
                </p>
              </div>
            ) : null}
          </Card>

          {/* Credits Card */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Credits</h3>
            <div className="rounded-xl bg-slate-900 text-white p-5 mb-5">
              <p className="text-sm text-slate-300">Current Balance</p>
              <p className="text-4xl font-semibold mt-2">{balance.toLocaleString()}</p>
              <p className="text-sm text-slate-300 mt-2">Latest org credit balance from the backend</p>
            </div>
            <div className="space-y-3">
              {isAdmin ? (
                <div className="grid grid-cols-1 gap-2">
                  {bundleList.map((bundle) => (
                    <Button
                      key={bundle.id}
                      variant="outline"
                      className="justify-between"
                      onClick={() => void runBillingAction(`bundle:${bundle.id}`, () => apiClient.post('/billing/credits/purchase', { bundleId: bundle.id }))}
                      disabled={processingAction === `bundle:${bundle.id}`}
                    >
                      <span>{bundle.label}</span>
                      <span>{processingAction === `bundle:${bundle.id}` ? 'Redirecting...' : formatCents(bundle.amount)}</span>
                    </Button>
                  ))}
                </div>
              ) : null}
              {transactions.slice(0, 4).map((transaction) => (
                <div key={transaction.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <div>
                    <p className="text-sm font-medium text-[#1E3A5F]">{transaction.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(transaction.createdAt).toLocaleString()} • {transaction.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.amount >= 0 ? '+' : ''}
                      {transaction.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">Bal {transaction.balanceAfter.toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {transactions.length === 0 ? (
                <EmptyState title="No credit activity yet" description="Credit purchases and deductions will appear here." />
              ) : null}
            </div>
          </Card>
        </div>

        {/* Invoice History */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Invoice History</h3>
          </div>
          {invoiceRows.length === 0 ? (
            <div className="p-10">
              <EmptyState
                title="No Stripe invoices yet"
                description="This organization does not have a Stripe customer or issued invoices yet."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Invoice</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4 text-sm text-[#1E3A5F] font-medium">
                        {invoice.number ?? invoice.id}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {new Date(invoice.created * 1000).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {formatCents(invoice.amount_paid, invoice.currency)}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700">
                          <Receipt className="w-3 h-3" />
                          {invoice.status ?? 'unknown'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {invoice.hosted_invoice_url || invoice.invoice_pdf ? (
                          <a
                            className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:text-[#0284C7]"
                            href={invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">Unavailable</span>
                        )}
                      </td>
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
